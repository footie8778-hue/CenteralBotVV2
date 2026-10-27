import { Client, TextChannel } from "discord.js";
import { CONFIG } from "../config";
import { createLogger } from "./logger";

const log = createLogger("discordLogger");

const LEVEL_LABELS: Record<number, string> = {
	10: "TRACE",
	20: "DEBUG",
	30: "INFO",
	40: "WARN",
	50: "ERROR",
	60: "FATAL",
};

const LEVEL_COLORS: Record<number, number> = {
	10: 0x808080,
	20: 0x808080,
	30: 0x5865f2,
	40: 0xfee75c,
	50: 0xed4245,
	60: 0xed4245,
};

const MAX_MESSAGE_LENGTH = 2000;
const FLUSH_INTERVAL_MS = 5000;
const FLUSH_THRESHOLD = 10;

interface LogEntry {
	level: number;
	module: string;
	msg: string;
	time: string;
}

class DiscordLogBuffer {
	private buffer: LogEntry[] = [];
	private channel: TextChannel | null = null;
	private flushTimer: ReturnType<typeof setInterval> | null = null;

	setChannel(channel: TextChannel) {
		this.channel = channel;
		this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
		log.info({ channel: channel.name }, "Discord log forwarding enabled");
	}

	add(level: number, module: string, msg: string) {
		if (!this.channel || !CONFIG.logs.enabled) return;

		this.buffer.push({
			level,
			module,
			msg: typeof msg === "string" ? msg : String(msg ?? ""),
			time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
		});

		if (this.buffer.length >= FLUSH_THRESHOLD) {
			this.flush();
		}
	}

	private async flush() {
		if (this.buffer.length === 0 || !this.channel) return;

		const entries = this.buffer.splice(0);
		const text = entries
			.map((e) => {
				const label = LEVEL_LABELS[e.level] ?? "LOG";
				return `[${e.time}] ${label} [${e.module}] ${e.msg}`;
			})
			.join("\n");

		const chunks = splitMessage(text);
		for (const chunk of chunks) {
			try {
				await this.channel.send(chunk);
			} catch (err) {
				log.error({ err }, "Failed to send log to Discord");
			}
		}
	}

	destroy() {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}
		this.flush();
	}
}

function splitMessage(text: string): string[] {
	if (text.length <= MAX_MESSAGE_LENGTH) return [text];

	const chunks: string[] = [];
	let remaining = text;

	while (remaining.length > 0) {
		if (remaining.length <= MAX_MESSAGE_LENGTH) {
			chunks.push(remaining);
			break;
		}

		let splitAt = remaining.lastIndexOf("\n", MAX_MESSAGE_LENGTH);
		if (splitAt <= 0) splitAt = MAX_MESSAGE_LENGTH;

		chunks.push(remaining.slice(0, splitAt));
		remaining = remaining.slice(splitAt).trimStart();
	}

	return chunks;
}

const buffer = new DiscordLogBuffer();

export function initDiscordLogger(client: Client) {
	const channelId = CONFIG.logs.channelId;
	if (!channelId || !CONFIG.logs.enabled) {
		log.info("Discord log forwarding disabled");
		return;
	}

	client.channels
		.fetch(channelId)
		.then((channel) => {
			if (!channel?.isTextBased()) {
				log.error("Log channel %s is not a text channel", channelId);
				return;
			}
			buffer.setChannel(channel as TextChannel);
		})
		.catch((err) => {
			log.error({ err }, "Failed to fetch log channel %s", channelId);
		});
}

export function forwardToDiscord(level: number, module: string, msg: string) {
	buffer.add(level, module, msg);
}

export function destroyDiscordLogger() {
	buffer.destroy();
}
