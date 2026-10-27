import {
	ChatInputCommandInteraction,
	TextChannel,
	GuildMember,
	PermissionFlagsBits,
	ChannelType,
	EmbedBuilder,
	MessageFlags,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
} from "discord.js";
import { CONFIG } from "../config";
import { GiveawayData, getGiveaway, getActiveGiveaways, updateGiveaway } from "./storage";
import { buildGiveawayEmbed, buildGiveawayContainer, buildGiveawayActionRow } from "./views";
import { startGiveaway, forceEndGiveaway, rerollGiveaway } from "./handler";
import { createLogger } from "../utils/logger";

const log = createLogger("giveawayCommands");

function parseDuration(duration: string): number | null {
	const match = duration.match(/^(\d+)([mhdw])$/i);
	if (!match) return null;

	const value = parseInt(match[1], 10);
	const unit = match[2].toLowerCase();

	switch (unit) {
		case "m":
			return value * 60 * 1000;
		case "h":
			return value * 60 * 60 * 1000;
		case "d":
			return value * 24 * 60 * 60 * 1000;
		case "w":
			return value * 7 * 24 * 60 * 60 * 1000;
		default:
			return null;
	}
}

function timestamp(seconds: number): string {
	return "<t:" + seconds + ":R>";
}

function userMention(id: string): string {
	return "<@" + id + ">";
}

function channelMention(id: string): string {
	return "<#" + id + ">";
}

function hasGiveawayPermission(interaction: ChatInputCommandInteraction): boolean {
	const member = interaction.member;
	if (!member || typeof member !== "object") return false;
	if (!("roles" in member)) return false;
	const roles = member.roles;
	if (typeof roles === "string") return false;
	if (Array.isArray(roles)) return false;
	if (!CONFIG.giveaway.manageRoleId) return true;
	return roles.cache.has(CONFIG.giveaway.manageRoleId);
}

export async function handleGiveawayCreate(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasGiveawayPermission(interaction)) {
			return void interaction.reply({
				content: "You don't have permission to create giveaways.",
				ephemeral: true,
			});
		}

		const modal = new ModalBuilder()
			.setCustomId("av:giveaway_create_modal")
			.setTitle("Create a Giveaway");

		const durationInput = new TextInputBuilder()
			.setCustomId("duration")
			.setLabel("Duration")
			.setPlaceholder("Ex: 10m, 2h, 1d, 1w")
			.setStyle(TextInputStyle.Short)
			.setRequired(true);

		const winnersInput = new TextInputBuilder()
			.setCustomId("winners")
			.setLabel("Number of Winners")
			.setPlaceholder("1")
			.setStyle(TextInputStyle.Short)
			.setRequired(true);

		const prizeInput = new TextInputBuilder()
			.setCustomId("prize")
			.setLabel("Prize")
			.setStyle(TextInputStyle.Short)
			.setRequired(true);

		const descriptionInput = new TextInputBuilder()
			.setCustomId("description")
			.setLabel("Description")
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(false);

		modal.addComponents(
			new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
			new ActionRowBuilder<TextInputBuilder>().addComponents(winnersInput),
			new ActionRowBuilder<TextInputBuilder>().addComponents(prizeInput),
			new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
		);

		await interaction.showModal(modal);

		const submitted = await interaction.awaitModalSubmit({
			filter: (i) => i.customId === "av:giveaway_create_modal" && i.user.id === interaction.user.id,
			time: 300_000,
		}).catch(() => null);
		if (!submitted) return;

		const durationStr = submitted.fields.getTextInputValue("duration");
		const winnersStr = submitted.fields.getTextInputValue("winners");
		const prize = submitted.fields.getTextInputValue("prize");
		const description = submitted.fields.getTextInputValue("description");

		const durationMs = parseDuration(durationStr);
		if (durationMs === null || durationMs <= 0) {
			return void submitted.reply({ content: "Invalid duration. Use format like `10m`, `2h`, `1d`, `1w`.", ephemeral: true });
		}

		const winners = parseInt(winnersStr, 10);
		if (isNaN(winners) || winners < 1 || winners > 20) {
			return void submitted.reply({ content: "Winner count must be a number between 1 and 20.", ephemeral: true });
		}

		const targetChannel = interaction.channel as TextChannel;
		if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
			return void submitted.reply({ content: "Could not determine the target channel.", ephemeral: true });
		}

		await submitted.deferReply({ ephemeral: true });

		const startTime = Date.now();
		const endTime = startTime + durationMs;

		const data: GiveawayData = {
			messageId: "",
			channelId: targetChannel.id,
			guildId: interaction.guildId!,
			prize,
			description: description || "",
			winnerCount: winners,
			createdBy: interaction.user.id,
			startTime,
			endTime,
			ended: false,
			winners: [],
			entries: [],
			requirements: { roleId: null, minAccountAgeDays: null },
		};

		const container = buildGiveawayContainer(data);
		const message = await targetChannel.send({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});

		data.messageId = message.id;

		const actionRow = buildGiveawayActionRow(data);
		await message.edit({
			components: [container, actionRow],
			flags: MessageFlags.IsComponentsV2,
		});

		startGiveaway(interaction.client, data);

		await submitted.editReply({
			content: "\u2705 Giveaway created! Ends " + timestamp(Math.floor(endTime / 1000)) + ".",
		});
	} catch (error) {
		log.error({ err: error, userId: interaction.user.id }, "Giveaway create failed");
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ content: "Failed to create giveaway.", ephemeral: true }).catch(() => {});
		}
	}
}

export async function handleGiveawayEnd(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasGiveawayPermission(interaction)) {
			return void interaction.reply({
				content: "You don't have permission to end giveaways.",
				ephemeral: true,
			});
		}

		const messageId = interaction.options.getString("message_id", true);
		const data = getGiveaway(messageId);

		if (!data) {
			return void interaction.reply({ content: "Giveaway not found.", ephemeral: true });
		}

		if (data.ended) {
			return void interaction.reply({ content: "This giveaway has already ended.", ephemeral: true });
		}

		const result = forceEndGiveaway(interaction.client, messageId);
		if (!result) {
			return void interaction.reply({ content: "Failed to end giveaway.", ephemeral: true });
		}

		await interaction.reply({ content: "Giveaway ended and winner(s) drawn!", ephemeral: true });
	} catch (error) {
		log.error({ err: error, userId: interaction.user.id }, "Giveaway end failed");
		await interaction.reply({ content: "Failed to end giveaway.", ephemeral: true });
	}
}

export async function handleGiveawayReroll(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasGiveawayPermission(interaction)) {
			return void interaction.reply({
				content: "You don't have permission to re-roll giveaways.",
				ephemeral: true,
			});
		}

		const messageId = interaction.options.getString("message_id", true);
		const result = rerollGiveaway(interaction.client, messageId);

		if (!result) {
			return void interaction.reply({
				content: "Giveaway not found or has not ended yet.",
				ephemeral: true,
			});
		}

		const winnerText =
			result.winners.length > 0 ? result.winners.map((id) => userMention(id)).join(", ") : "No valid entries.";

		const replyContent = "Re-rolled! New winner(s): " + winnerText;

		await interaction.reply({ content: replyContent, ephemeral: true });
	} catch (error) {
		log.error({ err: error, userId: interaction.user.id }, "Giveaway reroll failed");
		await interaction.reply({ content: "Failed to re-roll giveaway.", ephemeral: true });
	}
}

export async function handleGiveawayList(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		const giveaways = getActiveGiveaways();

		if (giveaways.length === 0) {
			return void interaction.reply({ content: "No active giveaways.", ephemeral: true });
		}

		const embed = new EmbedBuilder()
			.setTitle("\uD83C\uDF89 Active Giveaways")
			.setColor(CONFIG.branding.color)
			.setFooter({ text: CONFIG.branding.footer });

		for (const g of giveaways.slice(0, 25)) {
			const remaining = g.endTime - Date.now();
			const status = remaining > 0 ? "Ends " + timestamp(Math.floor(g.endTime / 1000)) : "Ending...";

			embed.addFields({
				name: g.prize,
				value: [
					"**Winners:** " + g.winnerCount,
					"**Entries:** " + g.entries.length,
					"**Status:** " + status,
					"**Channel:** " + channelMention(g.channelId),
					"**ID:** `" + g.messageId + "`",
				].join("\n"),
				inline: false,
			});
		}

		await interaction.reply({ embeds: [embed], ephemeral: true });
	} catch (error) {
		log.error({ err: error, userId: interaction.user.id }, "Giveaway list failed");
		await interaction.reply({ content: "Failed to list giveaways.", ephemeral: true });
	}
}

export async function handleGiveawayEdit(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasGiveawayPermission(interaction)) {
			return void interaction.reply({
				content: "You don't have permission to edit giveaways.",
				ephemeral: true,
			});
		}

		const messageId = interaction.options.getString("message_id", true);
		const data = getGiveaway(messageId);

		if (!data) {
			return void interaction.reply({ content: "Giveaway not found.", ephemeral: true });
		}

		if (data.ended) {
			return void interaction.reply({
				content: "Cannot edit a giveaway that has already ended.",
				ephemeral: true,
			});
		}

		const newPrize = interaction.options.getString("prize");
		const newWinners = interaction.options.getInteger("winners");

		if (newPrize) data.prize = newPrize;
		if (newWinners && newWinners >= 1 && newWinners <= 20) data.winnerCount = newWinners;

		updateGiveaway(messageId, {
			prize: data.prize,
			winnerCount: data.winnerCount,
		});

		const guild = interaction.client.guilds.cache.get(data.guildId);
		if (guild) {
			const channel = guild.channels.cache.get(data.channelId) as TextChannel | undefined;
			if (channel) {
				const message = await channel.messages.fetch(messageId).catch(() => null);
				if (message) {
					const container = buildGiveawayContainer(data);
					const actionRow = buildGiveawayActionRow(data);
					await message
						.edit({
							components: [container, actionRow],
							flags: MessageFlags.IsComponentsV2,
						})
						.catch(() => {});
				}
			}
		}

		await interaction.reply({ content: "Giveaway updated!", ephemeral: true });
	} catch (error) {
		log.error({ err: error, userId: interaction.user.id }, "Giveaway edit failed");
		await interaction.reply({ content: "Failed to edit giveaway.", ephemeral: true });
	}
}
