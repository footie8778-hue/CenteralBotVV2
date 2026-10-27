import * as fs from "fs";
import * as path from "path";
import { CONFIG } from "../config";
import discordTranscripts, { ExportReturnType } from "discord-html-transcripts";
import { TextChannel, Message, MessageType } from "discord.js";

const MAX_TRANSCRIPT_MESSAGES = 500;

function generateTxt(channel: TextChannel, category: string, messages: Message[]): string {
	const lines: string[] = [];
	lines.push("=".repeat(60));
	lines.push(`  TRANSCRIPT: #${channel.name}`);
	lines.push(`  Category: ${category}`);
	lines.push(
		`  Exported: ${new Date()
			.toISOString()
			.replace("T", " ")
			.replace(/\.\d+Z/, " UTC")}`
	);
	lines.push(`  Messages: ${messages.length}`);
	lines.push("=".repeat(60));
	lines.push("");

	for (const m of messages) {
		const ts = m.createdAt
			.toISOString()
			.replace("T", " ")
			.replace(/\.\d+Z/, "");

		if (m.type !== MessageType.Default) {
			lines.push(`[${ts}] SYSTEM: ${m.content}`);
		} else {
			lines.push(`[${ts}] ${m.author.tag} (${m.author.id}): ${m.content}`);
		}

		for (const [, att] of m.attachments) {
			lines.push(`  -> Attachment: ${att.name} (${Math.floor(att.size / 1024)} KB) ${att.url}`);
		}

		for (const e of m.embeds) {
			if (e.title) lines.push(`  -> Embed: ${e.title}`);
			if (e.description) lines.push(`     ${e.description}`);
			for (const f of e.fields) {
				lines.push(`     ${f.name}: ${f.value}`);
			}
		}

		lines.push("");
	}

	return lines.join("\n");
}

function saveToDisk(content: Buffer, channelName: string, category: string, ext: string): string {
	const saveDir = path.join(CONFIG.transcript.saveDir, category);
	fs.mkdirSync(saveDir, { recursive: true });

	const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
	const filename = `${channelName}-${timestamp}.${ext}`;
	const filepath = path.join(saveDir, filename);

	fs.writeFileSync(filepath, content);
	return filepath;
}

export interface TranscriptResult {
	txtBuffer: Buffer | null;
	htmlBuffer: Buffer | null;
	txtPath: string | null;
	htmlPath: string | null;
}

export async function generateTranscript(
	channel: TextChannel,
	category: string = "general"
): Promise<TranscriptResult> {
	let txtBuffer: Buffer | null = null;
	let htmlBuffer: Buffer | null = null;
	let txtPath: string | null = null;
	let htmlPath: string | null = null;

	if (CONFIG.transcript.formatTxt) {
		const messages: Message[] = [];
		let lastId: string | undefined;

		while (messages.length < MAX_TRANSCRIPT_MESSAGES) {
			const options: { limit: number; before?: string } = {
				limit: Math.min(100, MAX_TRANSCRIPT_MESSAGES - messages.length),
			};

			if (lastId) options.before = lastId;

			const fetched = await channel.messages.fetch(options);
			if (fetched.size === 0) break;

			messages.push(...fetched.values());
			lastId = fetched.last()?.id;
		}

		messages.reverse();

		const txtContent = generateTxt(channel, category, messages);
		const raw = Buffer.from(txtContent, "utf-8");

		txtBuffer = raw;
		txtPath = saveToDisk(raw, channel.name, category, "txt");
	}

	if (CONFIG.transcript.formatHtml) {
		const htmlName = `transcript-${channel.name}.html`;

		const raw = await discordTranscripts.createTranscript(channel, {
			filename: htmlName,
			limit: MAX_TRANSCRIPT_MESSAGES,
			hydrate: true,
			saveImages: false,
			poweredBy: false,
			returnType: ExportReturnType.Buffer,
			footerText: `${CONFIG.branding.serverName} exported {number} of message{s}`,
		});

		htmlBuffer = Buffer.from(raw);
		htmlPath = saveToDisk(htmlBuffer, channel.name, category, "html");
	}

	return { txtBuffer, htmlBuffer, txtPath, htmlPath };
}
