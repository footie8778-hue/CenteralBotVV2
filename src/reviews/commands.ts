import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, TextChannel } from "discord.js";
import { CONFIG } from "../config";
import { handleCommandError } from "../utils/errorHandler";

export async function handleReview(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		const rating = interaction.options.getInteger("rating", true);
		const comment = interaction.options.getString("comment", true).trim();
		const channelId = CONFIG.reviews.channelId;
		const channel = interaction.guild?.channels.cache.get(channelId);

		if (!channel || !channel.isTextBased()) {
			await interaction.reply({
				content: "The review channel is not available. Check the bot can see it.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const embed = new EmbedBuilder()
			.setColor(CONFIG.branding.color)
			.setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
			.setTitle(`${"⭐".repeat(rating)}  ${rating}/5`)
			.setDescription(comment)
			.setFooter({ text: CONFIG.branding.footer })
			.setTimestamp();

		await (channel as TextChannel).send({ embeds: [embed] });
		await interaction.reply({
			content: `Thanks. Your review is in <#${channelId}>.`,
			flags: MessageFlags.Ephemeral,
		});
	} catch (error) {
		await handleCommandError(interaction, error, "handleReview");
	}
}
