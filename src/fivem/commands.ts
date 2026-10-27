import {
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	TextChannel,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} from "discord.js";
import { CONFIG } from "../config";
import { handleCommandError } from "../utils/errorHandler";
import { hasStaffRole } from "../utils/roles";
import { buildStatusEmbed, getFivemStatus } from "./status";
import { loadStatusMessageId, saveStatusMessageId } from "./storage";
import { createLogger } from "../utils/logger";

const log = createLogger("fivem-commands");

function connectButton(connect?: string): ActionRowBuilder<ButtonBuilder> | null {
	if (!connect) return null;
	const url = connect.startsWith("http")
		? connect
		: connect.includes("cfx.re")
			? `https://${connect.replace(/^https?:\/\//, "")}`
			: null;
	if (!url) return null;
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setLabel("Connect").setStyle(ButtonStyle.Link).setURL(url)
	);
}

export async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		await interaction.deferReply();
		const status = await getFivemStatus();
		const embed = buildStatusEmbed(status);
		const row = connectButton(status.connect);
		await interaction.editReply({ embeds: [embed], components: row ? [row] : [] });
	} catch (error) {
		await handleCommandError(interaction, error, "status");
	}
}

export async function handleSetupStatus(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		const member = interaction.member;
		if (!hasStaffRole(member) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: "❌ Staff only.", ephemeral: true });
			return;
		}

		await interaction.deferReply({ ephemeral: true });
		const channel = interaction.channel as TextChannel;
		const status = await getFivemStatus();
		const embed = buildStatusEmbed(status);
		const row = connectButton(status.connect);

		const existingId = loadStatusMessageId(interaction.guildId!);
		if (existingId) {
			try {
				const msg = await channel.messages.fetch(existingId);
				await msg.edit({ embeds: [embed], components: row ? [row] : [] });
				saveStatusMessageId(interaction.guildId!, existingId, channel.id);
				await interaction.editReply("✅ Status message updated in this channel.");
				return;
			} catch {
				log.debug("Previous status message missing, posting new one");
			}
		}

		const msg = await channel.send({ embeds: [embed], components: row ? [row] : [] });
		saveStatusMessageId(interaction.guildId!, msg.id, channel.id);
		await interaction.editReply("✅ Live status panel posted. It will refresh automatically.");
	} catch (error) {
		await handleCommandError(interaction, error, "setupstatus");
	}
}

export async function refreshStatusEmbed(
	channel: TextChannel,
	messageId: string
): Promise<void> {
	const status = await getFivemStatus();
	const embed = buildStatusEmbed(status);
	const row = connectButton(status.connect);
	const msg = await channel.messages.fetch(messageId);
	await msg.edit({ embeds: [embed], components: row ? [row] : [] });
}
