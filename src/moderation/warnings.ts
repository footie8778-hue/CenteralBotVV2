import * as fs from "fs";
import * as path from "path";
import { createLogger } from "../utils/logger";
import { dataPath } from "../utils/dataDir";

const log = createLogger("warnings");

const WARNINGS_FILE = dataPath("warnings.json");

export interface WarnEntry {
	id: number;
	userId: string;
	moderatorId: string;
	reason: string;
	timestamp: number;
}

let warnings: Record<string, WarnEntry[]> = {};
let nextId = 1;

function loadWarnings(): void {
	try {
		if (fs.existsSync(WARNINGS_FILE)) {
			const data = JSON.parse(fs.readFileSync(WARNINGS_FILE, "utf-8"));
			warnings = data.warnings ?? {};
			nextId = data.nextId ?? 1;
		}
	} catch {
		log.warn("Failed to load warnings file - starting with empty state");
		warnings = {};
		nextId = 1;
	}
}

function saveWarnings(): void {
	try {
		fs.writeFileSync(WARNINGS_FILE, JSON.stringify({ warnings, nextId }, null, 2));
	} catch (error) {
		log.error({ err: error }, "Failed to save warnings");
	}
}

loadWarnings();

export function addWarning(userId: string, moderatorId: string, reason: string): WarnEntry {
	if (!warnings[userId]) warnings[userId] = [];
	const entry: WarnEntry = { id: nextId++, userId, moderatorId, reason, timestamp: Date.now() };
	warnings[userId].push(entry);
	saveWarnings();
	return entry;
}

export function getWarnings(userId: string): WarnEntry[] {
	return warnings[userId] ?? [];
}

export function clearWarnings(userId: string): number {
	const count = (warnings[userId] ?? []).length;
	delete warnings[userId];
	saveWarnings();
	return count;
}

export function getAllWarnings(): Record<string, WarnEntry[]> {
	return warnings;
}
