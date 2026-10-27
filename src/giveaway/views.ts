import {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	SectionBuilder,
	TextDisplayBuilder,
	ThumbnailBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	codeBlock,
	inlineCode,
} from "discord.js";
import { CONFIG, brandLogoUrl } from "../config";
import { GiveawayData } from "./storage";

function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const parts: string[] = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

	return parts.join(" ");
}

function timestamp(seconds: number): string {
	return "<t:" + seconds + ":R>";
}

function userMention(id: string): string {
	return "<@" + id + ">";
}

function roleMention(id: string): string {
	return "<@&" + id + ">";
}

function channelMention(id: string): string {
	return "<#" + id + ">";
}

function buildRequirementsText(data: GiveawayData): string {
	const reqs: string[] = [];
	if (data.requirements.roleId) {
		const mention = data.requirements.roleId === data.guildId ? "@everyone" : roleMention(data.requirements.roleId);
		reqs.push("Must have " + mention + " role");
	}
	if (data.requirements.minAccountAgeDays) {
		reqs.push("Account must be at least " + data.requirements.minAccountAgeDays + " days old");
	}
	return reqs.length > 0 ? reqs.join("\n") : "None";
}

export function buildGiveawayEmbed(data: GiveawayData): EmbedBuilder {
	const remaining = data.endTime - Date.now();
	const isActive = remaining > 0 && !data.ended;

	return new EmbedBuilder()
		.setTitle("\uD83C\uDF89 " + data.prize)
		.setDescription(
			(data.description ? data.description + "\n\n" : "") +
				"**Ends:** " +
				timestamp(Math.floor(data.endTime / 1000)) +
				"\n" +
				"**Hosted by:** " +
				userMention(data.createdBy)
		)
		.addFields(
			{
				name: "\uD83C\uDFC6 Winners",
				value: inlineCode(data.winnerCount.toString()),
				inline: true,
			},
			{
				name: "\uD83D\uDC65 Entries",
				value: inlineCode(data.entries.length.toString()),
				inline: true,
			},
			{
				name: "\u23F1\uFE0F Duration",
				value: inlineCode(formatDuration(data.endTime - data.startTime)),
				inline: true,
			},
		)
		.setColor(isActive ? CONFIG.branding.color : 0x808080)
		.setFooter({ text: CONFIG.branding.footer + " \u2022 ID: " + data.messageId })
		.setTimestamp(data.startTime);
}

export function buildGiveawayContainer(data: GiveawayData, mentionRoleId?: string | null): ContainerBuilder {
	const lines: string[] = [];

	lines.push("**" + data.prize + "**");

	if (data.description) {
		lines.push(data.description);
	}

	lines.push("");
	lines.push("Ends: " + timestamp(Math.floor(data.endTime / 1000)));
	lines.push("Hosted by: " + userMention(data.createdBy));
	lines.push("Entries: **" + data.entries.length + "**");
	lines.push("Winners: **" + data.winnerCount + "**");
	lines.push("");
	lines.push("<t:" + Math.floor(data.endTime / 1000) + ":F>");

	const section = new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));
	const logo = brandLogoUrl();
	if (logo) section.setThumbnailAccessory(new ThumbnailBuilder().setURL(logo));

	return new ContainerBuilder().addSectionComponents(section);
}

export function buildGiveawayActionRow(data: GiveawayData): ActionRowBuilder<ButtonBuilder> {
	const remaining = data.endTime - Date.now();
	const isActive = remaining > 0 && !data.ended;

	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId("av:giveaway_enter:" + data.messageId)
			.setLabel(isActive ? "Enter Giveaway" : "Giveaway Ended")
			.setStyle(isActive ? ButtonStyle.Success : ButtonStyle.Secondary)
			.setEmoji(CONFIG.giveaway.emoji)
			.setDisabled(!isActive)
	);
}

export function buildGiveawayEndActionRow(data: GiveawayData): ContainerBuilder {
	const winnerText =
		data.winners.length > 0 ? data.winners.map((id) => userMention(id)).join(", ") : "\u274C No valid entries";

	const ended = new SectionBuilder().addTextDisplayComponents(
		new TextDisplayBuilder().setContent(["## \uD83D\uDD12 " + data.prize, "**Giveaway has ended.**"].join("\n"))
	);
	const endedLogo = brandLogoUrl();
	if (endedLogo) ended.setThumbnailAccessory(new ThumbnailBuilder().setURL(endedLogo));

	return new ContainerBuilder()
		.addSectionComponents(ended)
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				[
					"\uD83C\uDFC6 **Winner(s):** " + winnerText,
					"\uD83D\uDC65 **Total Entries:** " + inlineCode(data.entries.length.toString()),
					"",
					"\uD83C\uDFAB Winners — open a ticket to claim your prize.",
				].join("\n")
			)
		);
}

export function buildWinnerAnnouncement(data: GiveawayData, winnerIds: string[]): string {
	if (winnerIds.length === 0) {
		return (
			"\uD83C\uDF89 **Giveaway Ended!**\n\n**" +
			data.prize +
			"**\n\n\u274C No valid entries \u2014 no winner selected."
		);
	}

	const winners = winnerIds.map((id) => userMention(id)).join(", ");
	return (
		"\uD83C\uDF89 **Giveaway Ended!**\n\n**" +
		data.prize +
		"**\n\n\uD83C\uDFC6 **Winner(s):** " +
		winners +
		"\n\nCongratulations! \uD83C\uDF89\n\n\uD83C\uDFAB To claim your prize, please **open a ticket** with staff."
	);
}
