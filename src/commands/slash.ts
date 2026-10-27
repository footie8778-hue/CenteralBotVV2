import {
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	TextChannel,
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	GuildMember,
	MessageFlags,
	ContainerBuilder,
	SectionBuilder,
	TextDisplayBuilder,
	ThumbnailBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
} from "discord.js";
import { CONFIG, brandLogoUrl } from "../config";
import { handleCommandError } from "../utils/errorHandler";
import { hasStaffRole } from "../utils/roles";
import { getTicketByChannel, setTicketStatus } from "../tickets/db";
import type { TicketStatus } from "../tickets/db";

export async function handleHello(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.reply("Hello 👋");
}

export async function handlePing(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		const sent = await interaction.reply({ content: "Pong 🏓", fetchReply: true });
		const latency = sent.createdTimestamp - interaction.createdTimestamp;
		await interaction.editReply(`Pong 🏓 \`${latency}ms\``);
	} catch (error) {
		await handleCommandError(interaction, error, "handlePing");
	}
}

export async function handleSetupPanel(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		const member = await interaction.guild?.members.fetch(interaction.user.id);
		const canSetup =
			hasStaffRole(member) ||
			(CONFIG.roles.botdevId && member?.roles.cache.has(CONFIG.roles.botdevId));
		if (!canSetup) {
			interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You need staff or bot developer role to post the ticket panel.",
			});
			return;
		}

		await interaction.deferReply({ ephemeral: true });

		const panelDesc = CONFIG.panel.description;

		const options = Object.entries(CONFIG.categories).map(([key, cat]) => ({
			label: cat.description.split(" - ")[0] || key,
			value: key,
			description: (cat.description.split(" - ").slice(1).join(" - ") || cat.description).slice(0, 100),
			emoji: cat.emoji,
		}));

		const header = new SectionBuilder().addTextDisplayComponents(
			new TextDisplayBuilder().setContent([`# ${CONFIG.panel.title}`, panelDesc].join("\n\n"))
		);
		const logo = brandLogoUrl();
		if (logo) header.setThumbnailAccessory(new ThumbnailBuilder().setURL(logo));

		const container = new ContainerBuilder()
			.addSectionComponents(header)
			.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
			.addActionRowComponents(
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId("av:persistent_panel_select")
						.setPlaceholder("Choose a support category...")
						.setMinValues(1)
						.setMaxValues(1)
						.addOptions(options)
				)
			)
			.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					"Need help? Select a category above and our team will assist you shortly."
				)
			)


		const channel = interaction.channel;
		if (channel && "send" in channel) {
			const response = await channel.send({
				flags: MessageFlags.IsComponentsV2,
				components: [container],
			});
			if (response) {
				await interaction.followUp({
					content: "✅ Support panel sent!",
					ephemeral: true,
				});
			} else {
				await interaction.followUp({
					content: "⚠️ There has been a problem sending the panel.",
					ephemeral: true,
				});
			}
		} else {
			await interaction.followUp({
				content: "❌ Panel cannot be sent here.",
				ephemeral: true,
			});
		}
	} catch (error) {
		await handleCommandError(interaction, error, "handleSetupPanel");
	}
}

