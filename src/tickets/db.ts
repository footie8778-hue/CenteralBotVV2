import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import { createLogger } from "../utils/logger";
import { CONFIG } from "../config";
import { dataPath } from "../utils/dataDir";

const log = createLogger("ticketDb");

const DB_PATH = dataPath("tickets.db");

export type TicketStatus = "open" | "in_progress" | "wait_user" | "wait_team" | "resolve" | "close";

export interface TicketRow {
	row_id: number;
	ticket_id: string;
	channel_id: string;
	guild_id: string;
	opener_id: string;
	category_key: string;
	status: TicketStatus;
	claimed_by: string | null;
	created_at: number;
	claimed_at: number | null;
	resolved_at: number | null;
	closed_at: number | null;
	close_reason: string | null;
	progress_ms: number;
	progress_start: number | null;
	wait_user_start: number | null;
	wait_team_start: number | null;
}

export interface TicketEventRow {
	id: number;
	ticket_id: string;
	from_status: string | null;
	to_status: string;
	triggered_by: string | null;
	created_at: number;
}

let db: Database.Database;

export function getDb(): Database.Database {
	if (!db) {
		const dir = path.dirname(DB_PATH);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		db = new Database(DB_PATH);
		db.pragma("journal_mode = WAL");
		db.pragma("foreign_keys = ON");
		initSchema();
	}
	return db;
}

function initSchema(): void {
	const d = getDb();
	d.exec(`
		CREATE TABLE IF NOT EXISTS ticket_counter (
			id INTEGER PRIMARY KEY AUTOINCREMENT
		);

		CREATE TABLE IF NOT EXISTS tickets (
			row_id          INTEGER PRIMARY KEY AUTOINCREMENT,
			ticket_id       TEXT    UNIQUE NOT NULL,
			channel_id      TEXT    UNIQUE NOT NULL,
			guild_id        TEXT    NOT NULL,
			opener_id       TEXT    NOT NULL,
			category_key    TEXT    NOT NULL,
			status          TEXT    NOT NULL DEFAULT 'open',
			claimed_by      TEXT,
			created_at      INTEGER NOT NULL,
			claimed_at      INTEGER,
			resolved_at     INTEGER,
			closed_at       INTEGER,
			close_reason    TEXT,
			progress_ms     INTEGER NOT NULL DEFAULT 0,
			progress_start  INTEGER,
			wait_user_start INTEGER,
			wait_team_start INTEGER
		);

		CREATE TABLE IF NOT EXISTS ticket_events (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			ticket_id   TEXT    NOT NULL REFERENCES tickets(ticket_id),
			from_status TEXT,
			to_status   TEXT    NOT NULL,
			triggered_by TEXT,
			created_at  INTEGER NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_tickets_channel_id ON tickets(channel_id);
		CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
		CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON tickets(ticket_id);
		CREATE INDEX IF NOT EXISTS idx_events_ticket_id ON ticket_events(ticket_id);
	`);
}

export function generateTicketId(): string {
	const d = getDb();
	const info = d.prepare("INSERT INTO ticket_counter DEFAULT VALUES").run();
	const id = Number(info.lastInsertRowid);
	const padded = String(id).padStart(4, "0");
	const prefix = (CONFIG.branding.ticketPrefix || "TBX").replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "TBX";
	return `${prefix}-${padded}`;
}

export function getTicketByChannel(channelId: string): TicketRow | undefined {
	const d = getDb();
	return d.prepare("SELECT * FROM tickets WHERE channel_id = ?").get(channelId) as TicketRow | undefined;
}

export function getTicketByTicketId(ticketId: string): TicketRow | undefined {
	const d = getDb();
	return d.prepare("SELECT * FROM tickets WHERE ticket_id = ?").get(ticketId) as TicketRow | undefined;
}

export function createTicket(
	channelId: string,
	guildId: string,
	openerId: string,
	categoryKey: string
): TicketRow {
	const d = getDb();
	const ticketId = generateTicketId();
	const now = Date.now();
	d.prepare(
		`INSERT INTO tickets (ticket_id, channel_id, guild_id, opener_id, category_key, status, created_at)
		 VALUES (?, ?, ?, ?, ?, 'open', ?)`
	).run(ticketId, channelId, guildId, openerId, categoryKey, now);
	log.info({ ticketId, channelId }, "Ticket created");
	return getTicketByChannel(channelId)!;
}

function recordEvent(ticketId: string, fromStatus: string | null, toStatus: string, triggeredBy: string | null): void {
	const d = getDb();
	d.prepare(
		"INSERT INTO ticket_events (ticket_id, from_status, to_status, triggered_by, created_at) VALUES (?, ?, ?, ?, ?)"
	).run(ticketId, fromStatus, toStatus, triggeredBy, Date.now());
}

function transitionSlaStop(ticket: TicketRow, toStatus: TicketStatus): Partial<TicketRow> {
	const now = Date.now();
	const updates: Record<string, number | null> = {};

	if (ticket.status === "in_progress" && ticket.progress_start) {
		updates.progress_ms = ticket.progress_ms + (now - ticket.progress_start);
		updates.progress_start = null;
	}

	if (ticket.status === "wait_user" && ticket.wait_user_start) {
		updates.wait_user_start = null;
	}

	if (ticket.status === "wait_team" && ticket.wait_team_start) {
		updates.wait_team_start = null;
	}

	if (ticket.status === "resolve") {
		updates.resolved_at = null;
	}

	return updates;
}

function transitionSlaStart(ticket: TicketRow, toStatus: TicketStatus): Partial<TicketRow> {
	const now = Date.now();
	const updates: Record<string, number | null> = {};

	if (toStatus === "in_progress") {
		updates.progress_start = now;
		if (!ticket.claimed_at) {
			updates.claimed_at = now;
		}
	}

	if (toStatus === "wait_user") {
		updates.wait_user_start = now;
	}

	if (toStatus === "wait_team") {
		updates.wait_team_start = now;
	}

	if (toStatus === "resolve") {
		updates.resolved_at = now;
	}

	if (toStatus === "close") {
		updates.closed_at = now;
		updates.progress_start = null;
		updates.wait_user_start = null;
		updates.wait_team_start = null;
	}

	return updates;
}

export function setTicketStatus(
	channelId: string,
	toStatus: TicketStatus,
	triggeredBy: string | null
): TicketRow | undefined {
	const d = getDb();
	const ticket = getTicketByChannel(channelId);
	if (!ticket) return undefined;
	if (ticket.status === toStatus) return ticket;

	const stop = transitionSlaStop(ticket, toStatus);
	const start = transitionSlaStart(ticket, toStatus);
	const merged = { ...stop, ...start };

	merged.status = toStatus;

	const sets: string[] = [];
	const values: any[] = [];
	for (const [key, val] of Object.entries(merged)) {
		sets.push(`${key} = ?`);
		values.push(val ?? null);
	}
	values.push(channelId);

	d.prepare(`UPDATE tickets SET ${sets.join(", ")} WHERE channel_id = ?`).run(...values);

	recordEvent(ticket.ticket_id, ticket.status, toStatus, triggeredBy);

	log.info({ ticketId: ticket.ticket_id, from: ticket.status, to: toStatus, triggeredBy }, "Ticket status changed");

	return getTicketByChannel(channelId);
}

export function setTicketClaim(channelId: string, claimedBy: string | null): TicketRow | undefined {
	const d = getDb();
	const ticket = getTicketByChannel(channelId);
	if (!ticket) return undefined;

	const now = Date.now();
	const updates: Record<string, any> = { claimed_by: claimedBy };

	if (claimedBy && !ticket.claimed_at) {
		updates.claimed_at = now;
	}

	const sets = Object.entries(updates).map(([k]) => `${k} = ?`).join(", ");
	const values = Object.values(updates);
	values.push(channelId);

	d.prepare(`UPDATE tickets SET ${sets} WHERE channel_id = ?`).run(...values);

	return getTicketByChannel(channelId);
}

export function setTicketCloseReason(channelId: string, reason: string): void {
	const d = getDb();
	d.prepare("UPDATE tickets SET close_reason = ? WHERE channel_id = ?").run(reason, channelId);
}

export function closeTicketByChannelId(channelId: string, reason: string, closedBy: string | null): void {
	const ticket = getTicketByChannel(channelId);
	if (!ticket) return;
	setTicketCloseReason(channelId, reason);
	setTicketStatus(channelId, "close", closedBy);
}

export function getSlaStats(channelId: string): {
	firstResponseMs: number | null;
	progressMs: number;
	totalProgressMs: number;
} | undefined {
	const ticket = getTicketByChannel(channelId);
	if (!ticket) return undefined;

	const firstResponseMs = ticket.claimed_at ? ticket.claimed_at - ticket.created_at : null;

	const currentProgressMs =
		ticket.status === "in_progress" && ticket.progress_start
			? Date.now() - ticket.progress_start
			: 0;

	return {
		firstResponseMs,
		progressMs: ticket.progress_ms,
		totalProgressMs: ticket.progress_ms + currentProgressMs,
	};
}

export function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
	if (hours > 0) return `${hours}h ${minutes % 60}m`;
	if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
	return `${seconds}s`;
}
