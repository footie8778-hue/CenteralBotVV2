import * as fs from "fs";
import * as path from "path";
import { createLogger } from "../utils/logger";
import { dataPath } from "../utils/dataDir";

const log = createLogger("giveawayStorage");

const GIVEAWAY_FILE = dataPath("giveaways.json");

export interface GiveawayEntry {
	userId: string;
	username: string;
	timestamp: number;
}

export interface GiveawayData {
	messageId: string;
	channelId: string;
	guildId: string;
	prize: string;
	description: string;
	winnerCount: number;
	createdBy: string;
	startTime: number;
	endTime: number;
	ended: boolean;
	winners: string[];
	entries: GiveawayEntry[];
	requirements: {
		roleId: string | null;
		minAccountAgeDays: number | null;
	};
}

interface GiveawayStore {
	active: Record<string, GiveawayData>;
	ended: Record<string, GiveawayData>;
}

function loadStore(): GiveawayStore {
	try {
		if (fs.existsSync(GIVEAWAY_FILE)) {
			const data = fs.readFileSync(GIVEAWAY_FILE, "utf-8");
			return JSON.parse(data);
		}
	} catch (error) {
		log.error({ err: error }, "Failed to load giveaway store");
	}
	return { active: {}, ended: {} };
}

function saveStore(store: GiveawayStore): void {
	try {
		const dir = path.dirname(GIVEAWAY_FILE);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(GIVEAWAY_FILE, JSON.stringify(store, null, 2));
	} catch (error) {
		log.error({ err: error }, "Failed to save giveaway store");
	}
}

export function saveGiveaway(data: GiveawayData): void {
	const store = loadStore();
	store.active[data.messageId] = data;
	saveStore(store);
}

export function getGiveaway(messageId: string): GiveawayData | null {
	const store = loadStore();
	return store.active[messageId] ?? store.ended[messageId] ?? null;
}

export function getActiveGiveaways(): GiveawayData[] {
	const store = loadStore();
	return Object.values(store.active).filter((g) => !g.ended);
}

export function getEndedGiveaways(): GiveawayData[] {
	const store = loadStore();
	return Object.values(store.ended);
}

export function updateGiveaway(messageId: string, updates: Partial<GiveawayData>): void {
	const store = loadStore();
	if (store.active[messageId]) {
		Object.assign(store.active[messageId], updates);
		saveStore(store);
	}
}

export function endGiveaway(messageId: string): GiveawayData | null {
	const store = loadStore();
	const giveaway = store.active[messageId];
	if (!giveaway) return null;

	giveaway.ended = true;
	store.ended[messageId] = giveaway;
	delete store.active[messageId];
	saveStore(store);
	return giveaway;
}

export function addEntry(messageId: string, userId: string, username: string): boolean {
	const store = loadStore();
	const giveaway = store.active[messageId];
	if (!giveaway || giveaway.ended) return false;

	const existing = giveaway.entries.find((e) => e.userId === userId);
	if (existing) return false;

	giveaway.entries.push({ userId, username, timestamp: Date.now() });
	saveStore(store);
	return true;
}

export function removeEntry(messageId: string, userId: string): boolean {
	const store = loadStore();
	const giveaway = store.active[messageId];
	if (!giveaway || giveaway.ended) return false;

	const index = giveaway.entries.findIndex((e) => e.userId === userId);
	if (index === -1) return false;

	giveaway.entries.splice(index, 1);
	saveStore(store);
	return true;
}

export function hasEntry(messageId: string, userId: string): boolean {
	const store = loadStore();
	const giveaway = store.active[messageId];
	if (!giveaway) return false;
	return giveaway.entries.some((e) => e.userId === userId);
}
