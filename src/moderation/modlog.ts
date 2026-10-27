import { Client, EmbedBuilder, GuildMember, TextChannel, User } from "discord.js";
import { CONFIG } from "../config";
import { createLogger } from "../utils/logger";

const log = createLogger("modlog");

const ACTION_COLORS: Record<string, number> = {
	Warn: 0xffcc00,
	Mute: 0xff9900,
	Unmute: 0x00cc66,
	Kick: 0xff6600,
	Ban: 0xff0000,
	Unban: 0x0099ff,
	Purge: 0x9966ff,
	Slowmode: 0x66ccff,
	Lock: 0xcc3333,
	Unlock: 0x33cc33,
	ClearWarnings: 0xcc66ff,
};

export async function sendModLog(
	client: Client,
	action: string,
	moderator: GuildMember,
	target: GuildMember | User,
	reason: string,
	duration?: string,
	extra?: Record<string, string>
): Promise<void> {
	const channelId = CONFIG.modlog.channelId;
	if (!channelId) return;

	const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
	if (!channel) return;

	const color = ACTION_COLORS[action] ?? 0x808080;

	const tag = target instanceof GuildMember ? target.user.tag : target.tag;
	const avatar = target.displayAvatarURL();

	const embed = new EmbedBuilder()
		.setTitle(`${action} | ${tag}`)
		.setColor(color)
		.setThumbnail(avatar)
		.addFields(
			{ name: "User", value: `${target} (${target.id})`, inline: true },
			{ name: "Moderator", value: `${moderator} (${moderator.id})`, inline: true },
			{ name: "Reason", value: reason || "No reason provided", inline: false }
		)
		.setTimestamp();

	if (duration) {
		embed.addFields({ name: "Duration", value: duration, inline: true });
	}

	if (extra) {
		for (const [key, value] of Object.entries(extra)) {
			embed.addFields({ name: key, value, inline: true });
		}
	}

	embed.setFooter({ text: CONFIG.branding.footer });

	try {
		await channel.send({ embeds: [embed] });
	} catch (error) {
		log.error({ err: error, action, channelId }, "Failed to send mod log");
	}
}
