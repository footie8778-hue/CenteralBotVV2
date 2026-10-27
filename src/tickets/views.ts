import {

	ActionRowBuilder,

	StringSelectMenuBuilder,

	StringSelectMenuInteraction,

	ButtonBuilder,

	ButtonStyle,

	ButtonInteraction,

	EmbedBuilder,

	PermissionFlagsBits,

	ChannelType,

	TextChannel,

	Guild,

	MessageFlags,

} from "discord.js";

import { CONFIG, CategoryConfig } from "../config";

import { buildGenericTicketModal } from "./modals";

import { executeTicketClosure } from "./helpers";

import { handleCommandError } from "../utils/errorHandler";

import { hasStaffRole } from "../utils/roles";

import { createLogger } from "../utils/logger";

import {

	getTicketByChannel,

	setTicketClaim,

	setTicketStatus,

	formatDuration,

	getSlaStats,

} from "./db";

import type { TicketStatus, TicketRow } from "./db";



const log = createLogger("ticketViews");



export function buildPanelActionRow(): ActionRowBuilder<StringSelectMenuBuilder> {

	const options = Object.entries(CONFIG.categories).map(([key, cat]) => ({

		label: cat.description.split(" - ")[0] || key,

		value: key,

		description: (cat.description.split(" - ").slice(1).join(" - ") || cat.description).slice(0, 100),

		emoji: cat.emoji,

	}));



	const select = new StringSelectMenuBuilder()

		.setCustomId("av:persistent_panel_select")

		.setPlaceholder("Choose a support category...")

		.setMinValues(1)

		.setMaxValues(1)

		.addOptions(options);



	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

}



export async function handlePanelSelect(interaction: StringSelectMenuInteraction): Promise<void> {

	try {

		const chosen = interaction.values[0];

		await interaction.showModal(buildGenericTicketModal(chosen));

	} catch (error) {

		await handleCommandError(interaction, error, "Panel select");

	}

}



function getStatusFromTicket(channelId: string): TicketStatus {

	const ticket = getTicketByChannel(channelId);

	return ticket?.status ?? "open";

}



function getClaimedByFromTicket(channelId: string): string | null {

	const ticket = getTicketByChannel(channelId);

	return ticket?.claimed_by ?? null;

}



export function buildTicketControlActionRow(

	openerId: string,

	categoryKey: string,

	claimedBy: string | null = null,

	_status?: TicketStatus

): ActionRowBuilder<ButtonBuilder>[] {

	const isClaimed = claimedBy !== null;

	const toggleCustomId = isClaimed

		? `av:claim_toggle:claimed:${openerId}:${categoryKey}`

		: `av:claim_toggle:unclaimed:${openerId}:${categoryKey}`;



	const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(

		new ButtonBuilder()

			.setCustomId(toggleCustomId)

			.setLabel(isClaimed ? "Unclaim Ticket" : "Claim Ticket")

			.setStyle(isClaimed ? ButtonStyle.Secondary : ButtonStyle.Success)

			.setEmoji(isClaimed ? "🔓" : "👤"),

		new ButtonBuilder()

			.setCustomId(`av:close_btn:${openerId}:${categoryKey}`)

			.setLabel("Close Ticket")

			.setStyle(ButtonStyle.Danger)

			.setEmoji("🔒")

	);



	return [row1];

}



export async function handleClaimToggleButton(

	interaction: ButtonInteraction,

	openerId: string,

	categoryKey: string,

	encodedState: string

): Promise<void> {

	try {

		const member = interaction.member;

		if (!member) {

			return void interaction.reply({

				content: "❌ Error: Could not verify your identity.",

				ephemeral: true,

			});

		}

		const isStaff = hasStaffRole(member);

		if (!isStaff) {

			return void interaction.reply({

				content: "❌ Only support staff can claim or unclaim tickets.",

				ephemeral: true,

			});

		}



		const channel = interaction.channel as TextChannel;

		const channelId = channel.id;

		const ticket = getTicketByChannel(channelId);



		if (!ticket) {

			return void interaction.reply({

				content: "❌ Ticket not found in database.",

				ephemeral: true,

			});

		}



		if (ticket.claimed_by === interaction.user.id) {

			// Unclaim

			setTicketClaim(channelId, null);

			setTicketStatus(channelId, "open", interaction.user.id);

			await interaction.deferUpdate();



			const rows = buildTicketControlActionRow(openerId, categoryKey, null, "open");

			await interaction.message.edit({ components: rows });



			const embed = new EmbedBuilder()

				.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })

				.setDescription("🔓 **Ticket unclaimed.** It is now back in the support queue for anyone to handle.")

				.setColor(0xffa500)

				.setTimestamp();

			await channel.send({ embeds: [embed] });



			try {

				await channel.edit({

					topic: `[${ticket.ticket_id}] Claimed by: None | Category: ${categoryKey.toUpperCase()}`,

				});

			} catch (topicErr) {

				log.warn({ err: topicErr }, "Failed to update channel topic on unclaim");

			}

		} else if (ticket.claimed_by) {

			return void interaction.reply({

				content: `⚠️ This ticket is already claimed by <@${ticket.claimed_by}>.`,

				ephemeral: true,

			});

		} else {

			// Claim

			setTicketClaim(channelId, interaction.user.id);

			setTicketStatus(channelId, "in_progress", interaction.user.id);

			await interaction.deferUpdate();



			const rows = buildTicketControlActionRow(openerId, categoryKey, interaction.user.id, "in_progress");

			await interaction.message.edit({ components: rows });



			const embed = new EmbedBuilder()

				.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })

				.setDescription(`💼 **Ticket claimed by:** ${interaction.user}\nThey will be helping you with your issue.`)

				.setColor(0x57f287)

				.setTimestamp();

			await channel.send({ embeds: [embed] });



			try {

				await channel.edit({

					topic: `[${ticket.ticket_id}] Claimed by: ${interaction.user.username} | Category: ${categoryKey.toUpperCase()}`,

				});

			} catch (topicErr) {

				log.warn({ err: topicErr }, "Failed to update channel topic on claim");

			}

		}

	} catch (error) {

		await handleCommandError(interaction, error, "Claim toggle");

	}

}



export async function handleCloseButton(

	interaction: ButtonInteraction,

	openerId: string,

	categoryKey: string

): Promise<void> {

	try {

		const member = interaction.member;

		const isStaff = hasStaffRole(member);

		if (interaction.user.id !== openerId && !isStaff) {

			return void interaction.reply({

				content: "❌ Only the person who opened this ticket or support staff can close it.",

				ephemeral: true,

			});

		}



		const { buildCloseReasonModal, handleCloseReasonSubmit } = await import("./modals");

		const ticket = getTicketByChannel((interaction.channel as TextChannel).id);



		await interaction.showModal(buildCloseReasonModal());



		const filter = (i: any) => i.customId === "av:close_reason" && i.user.id === interaction.user.id;

		try {

			const modalInteraction = await interaction.awaitModalSubmit({

				filter,

				time: 300_000,

			});

			await handleCloseReasonSubmit(modalInteraction, {

				openerId,

				categoryKey,

				claimedBy: ticket?.claimed_by ?? null,

			});

		} catch {

			// Modal timed out, ignore

		}

	} catch (error) {

		await handleCommandError(interaction, error, "Close button");

	}

}



