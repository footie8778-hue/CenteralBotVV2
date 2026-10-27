import * as fs from "fs";
import * as path from "path";
import { createLogger } from "../utils/logger";
import { dataPath } from "../utils/dataDir";

const log = createLogger("fivem-storage");

const FILE = dataPath("status-panel.json");

interface StatusPanelRecord {
	guildId: string;
	channelId: string;
	messageId: string;
}

function readAll(): StatusPanelRecord[] {
	try {
		if (!fs.existsSync(FILE)) return [];
		return JSON.parse(fs.readFileSync(FILE, "utf-8")) as StatusPanelRecord[];
	} catch (err) {
		log.warn({ err }, "Failed to read status panel file");
		return [];
	}
}

function writeAll(records: StatusPanelRecord[]): void {
	const dir = path.dirname(FILE);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(FILE, JSON.stringify(records, null, 2));
}

export function loadStatusMessageId(guildId: string): string | null {
	const row = readAll().find((r) => r.guildId === guildId);
	return row?.messageId ?? null;
}

export function loadStatusPanel(guildId: string): StatusPanelRecord | null {
	return readAll().find((r) => r.guildId === guildId) ?? null;
}

export function saveStatusMessageId(guildId: string, messageId: string, channelId: string): void {
	const all = readAll().filter((r) => r.guildId !== guildId);
	all.push({ guildId, channelId, messageId });
	writeAll(all);
}

export function listStatusPanels(): StatusPanelRecord[] {
	return readAll();
}
