import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config";
import { createLogger } from "../utils/logger";

const log = createLogger("fivem-status");

export interface FivemStatus {
	online: boolean;
	hostname: string;
	players: number;
	maxPlayers: number;
	connect?: string;
	txAdmin?: string;
	uptime?: string;
}

async function fetchCfxStatus(): Promise<FivemStatus | null> {
	const id = CONFIG.fivem.cfxServerId.trim();
	if (!id) return null;

	try {
		const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${id}`, {
			headers: { Accept: "application/json" },
		});
		if (!res.ok) return null;
		const body = (await res.json()) as {
			Data?: {
				hostname?: string;
				clients?: number;
				svMaxclients?: number;
				vars?: Record<string, string>;
				connectEndPoints?: string[];
			};
		};
		const data = body.Data;
		if (!data) return null;

		const connect =
			CONFIG.fivem.connect.trim() ||
			(data.connectEndPoints?.[0] ? `cfx.re/join/${id}` : undefined);

		return {
			online: true,
			hostname: data.hostname ?? CONFIG.branding.serverName,
			players: data.clients ?? 0,
			maxPlayers: data.svMaxclients ?? Number(data.vars?.sv_maxClients ?? 48),
			connect,
			txAdmin: CONFIG.fivem.txAdminUrl.trim() || undefined,
		};
	} catch (err) {
		log.warn({ err }, "CFX status fetch failed");
		return null;
	}
}

async function fetchDirectStatus(): Promise<FivemStatus | null> {
	const host = CONFIG.fivem.serverHost.trim();
	const port = CONFIG.fivem.serverPort.trim() || "30120";
	if (!host) return null;

	const base = host.startsWith("http") ? host.replace(/\/$/, "") : `http://${host}:${port}`;

	try {
		const [infoRes, dynamicRes] = await Promise.all([
			fetch(`${base}/info.json`, { signal: AbortSignal.timeout(8000) }),
			fetch(`${base}/dynamic.json`, { signal: AbortSignal.timeout(8000) }),
		]);
		if (!infoRes.ok || !dynamicRes.ok) return null;

		const info = (await infoRes.json()) as { vars?: Record<string, string> };
		const dynamic = (await dynamicRes.json()) as { hostname?: string; clients?: number; sv_maxclients?: number };

		return {
			online: true,
			hostname: dynamic.hostname ?? CONFIG.branding.serverName,
			players: dynamic.clients ?? 0,
			maxPlayers: dynamic.sv_maxclients ?? Number(info.vars?.sv_maxClients ?? 48),
			connect: CONFIG.fivem.connect.trim() || undefined,
			txAdmin: CONFIG.fivem.txAdminUrl.trim() || undefined,
		};
	} catch (err) {
		log.debug({ err }, "Direct FiveM status fetch failed");
		return null;
	}
}

async function fetchTxAdminHeartbeat(): Promise<boolean | null> {
	const url = CONFIG.fivem.txAdminUrl.trim();
	if (!url) return null;

	try {
		const res = await fetch(url.replace(/\/$/, "") + "/host/status", {
			headers: CONFIG.fivem.txAdminToken
				? { Authorization: `Bearer ${CONFIG.fivem.txAdminToken}` }
				: {},
			signal: AbortSignal.timeout(8000),
		});
		return res.ok;
	} catch {
		return false;
	}
}

export async function getFivemStatus(): Promise<FivemStatus> {
	const fromCfx = await fetchCfxStatus();
	if (fromCfx) {
		const tx = await fetchTxAdminHeartbeat();
		if (tx === false) fromCfx.txAdmin = `${fromCfx.txAdmin ?? "txAdmin"} (unreachable)`;
		return fromCfx;
	}

	const direct = await fetchDirectStatus();
	if (direct) return direct;

	return {
		online: false,
		hostname: CONFIG.branding.serverName,
		players: 0,
		maxPlayers: 0,
		connect: CONFIG.fivem.connect.trim() || undefined,
		txAdmin: CONFIG.fivem.txAdminUrl.trim() || undefined,
	};
}

export function buildStatusEmbed(status: FivemStatus): EmbedBuilder {
	const color = status.online ? CONFIG.branding.color : 0xef4444;
	const state = status.online ? "🟢 Online" : "🔴 Offline";

	const lines = [
		`**${status.hostname}**`,
		"",
		`**Status:** ${state}`,
		`**Players:** ${status.players}/${status.maxPlayers || "—"}`,
	];

	if (status.connect) lines.push(`**Connect:** \`${status.connect}\``);
	if (status.txAdmin) lines.push(`**txAdmin:** ${status.txAdmin}`);

	return new EmbedBuilder()
		.setTitle(`${CONFIG.branding.serverName} — Server Status`)
		.setDescription(lines.join("\n"))
		.setColor(color)
		.setFooter({ text: `${CONFIG.branding.footer} • txAdmin / FiveM` })
		.setTimestamp();
}
