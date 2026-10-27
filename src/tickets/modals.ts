import {

	ModalBuilder,

	TextInputBuilder,

	TextInputStyle,

	ActionRowBuilder,

	ModalSubmitInteraction,

	TextChannel,

	MessageFlags,

	EmbedBuilder,

} from "discord.js";

import { CONFIG } from "../config";

import { createStandardTicket } from "./helpers";

import { Client } from "discord.js";

import { handleCommandError } from "../utils/errorHandler";

import { createTicket } from "./db";



export function buildGenericTicketModal(categoryKey: string): ModalBuilder {

	const categoryConfig = CONFIG.categories[categoryKey];

	const displayName = categoryKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());



	const modal = new ModalBuilder()

		.setCustomId(`av:generic_ticket:${categoryKey}`)

		.setTitle(`Open ${displayName} Ticket`);



	const questions = categoryConfig?.questions?.length ? categoryConfig.questions : ["How can we help you?"];



	for (let i = 0; i < questions.length; i++) {

		const question = questions[i];

		const input = new TextInputBuilder()

			.setCustomId(`question_${i}`)

			.setLabel(question.slice(0, 45))

			.setStyle(TextInputStyle.Paragraph)

			.setPlaceholder("Enter your answer...")

			.setRequired(true)

			.setMaxLength(1000);



		modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

	}



	return modal;

}



export async function handleGenericTicketSubmit(interaction: ModalSubmitInteraction): Promise<void> {

	try {

		const categoryKey = interaction.customId.split(":")[2];

		if (!categoryKey) {

			return void interaction.reply({ content: "❌ Invalid ticket form data.", ephemeral: true });

		}

		const categoryConfig = CONFIG.categories[categoryKey];

		const questions = categoryConfig?.questions?.length ? categoryConfig.questions : [];



		const answers: string[] = [];

		for (let i = 0; i < questions.length; i++) {

			const answer = interaction.fields.getTextInputValue(`question_${i}`);

			answers.push(`**Q:** ${questions[i]}\n${answer}`);

		}



		const issueDescription = answers.join("\n\n");



		await interaction.deferReply({ ephemeral: true });

		await createStandardTicket(interaction.client as Client, interaction, categoryKey, issueDescription);

	} catch (error) {

		await handleCommandError(interaction, error, "Generic ticket submit");

	}

}





export function buildInternalNoteModal(): ModalBuilder {

	const modal = new ModalBuilder().setCustomId("av:internal_note").setTitle("Add Staff Note");



	const noteInput = new TextInputBuilder()

		.setCustomId("note_input")

		.setLabel("Staff Note")

		.setStyle(TextInputStyle.Paragraph)

		.setPlaceholder("Enter details or notes about this ticket here...")

		.setRequired(true)

		.setMaxLength(500);



	modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput));



	return modal;

}



export function buildCloseReasonModal(): ModalBuilder {

	const modal = new ModalBuilder().setCustomId("av:close_reason").setTitle("Close Reason Entry");



	const reasonInput = new TextInputBuilder()

		.setCustomId("reason_input")

		.setLabel("Reason for Closing")

		.setStyle(TextInputStyle.Paragraph)

		.setPlaceholder("Resolved, Abandoned, Other...")

		.setRequired(false)

		.setValue("No reason provided.")

		.setMaxLength(400);



	modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));



	return modal;

}



export async function handleInternalNoteSubmit(interaction: ModalSubmitInteraction): Promise<void> {

	try {

		const noteValue = interaction.fields.getTextInputValue("note_input");



		const embed = new EmbedBuilder()

			.setTitle("📌 Staff Note Added")

			.setDescription(noteValue)

			.setColor(0xffd700)

			.setFooter({

				text: `Added by ${interaction.member?.user?.username ?? "Unknown"}`,

			});



		await (interaction.channel as TextChannel)?.send({ embeds: [embed] });

		await interaction.reply({ content: "✅ Note saved.", ephemeral: true });

	} catch (error) {

		await handleCommandError(interaction, error, "Internal note submit");

	}

}



export async function handleCloseReasonSubmit(

	interaction: ModalSubmitInteraction,

	parentView: {

		openerId: string;

		categoryKey: string;

		claimedBy: string | null;

	}

): Promise<void> {

	const reasonValue = interaction.fields.getTextInputValue("reason_input");



	await interaction.reply({

		content: "⚙️ Archiving and saving logs...",

		ephemeral: true,

	});



	const { executeTicketClosure } = await import("./helpers");

	await executeTicketClosure({

		channel: interaction.channel as import("discord.js").TextChannel,

		openerId: parentView.openerId,

		categoryKey: parentView.categoryKey,

		claimedBy: parentView.claimedBy,

		closedBy: interaction.user,

		reason: reasonValue,

	});

}



