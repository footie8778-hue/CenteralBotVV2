import {
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	EmbedBuilder,
	GuildMember,
	TextChannel,
	MessageFlags,
} from "discord.js";
import { CONFIG } from "../config";
import { handleCommandError } from "../utils/errorHandler";
import { hasStaffRole } from "../utils/roles";

function hasStaffPermission(interaction: ChatInputCommandInteraction): boolean {
	const perms = interaction.memberPermissions;
	if (!perms) return false;
	if (perms.has(PermissionFlagsBits.Administrator)) return true;
	if (perms.has(PermissionFlagsBits.ModerateMembers)) return true;
	const member = interaction.member as GuildMember;
	if (hasStaffRole(member)) return true;
	return false;
}

function getTicketCategoryId(channel: TextChannel): string | null {
	const parentId = channel.parentId;
	if (!parentId) return null;
	for (const [key, cat] of Object.entries(CONFIG.categories)) {
		if (cat.id === parentId) return key;
	}
	return null;
}

export async function handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!interaction.guild) {
			await interaction.reply({
				content: "❌ This command can only be used in a server.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		if (!hasStaffPermission(interaction)) {
			await interaction.reply({
				content: "❌ You don't have permission to add users to tickets.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const channel = interaction.channel as TextChannel;
		const categoryKey = getTicketCategoryId(channel);
		if (!categoryKey) {
			await interaction.reply({
				content: "❌ This command can only be used in a ticket channel.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const target = interaction.options.getUser("user")!;

		const existing = channel.permissionOverwrites.cache.get(target.id);
		if (existing && existing.allow.has(PermissionFlagsBits.ViewChannel)) {
			await interaction.reply({
				content: `❌ ${target} already has access to this ticket.`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await channel.permissionOverwrites.edit(target, {
			ViewChannel: true,
			SendMessages: true,
		});

		const embed = new EmbedBuilder()
			.setTitle("➕ User Added to Ticket")
			.setColor(0x00cc66)
			.addFields(
				{ name: "User", value: `${target} (${target.id})`, inline: true },
				{ name: "Added By", value: `${interaction.user}`, inline: true },
				{ name: "Category", value: categoryKey.toUpperCase(), inline: true }
			)
			.setTimestamp()
			.setFooter({ text: CONFIG.branding.footer });

		await interaction.reply({ embeds: [embed] });
	} catch (error) {
		await handleCommandError(interaction, error, "handleAdd");
	}
}

export async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!interaction.guild) {
			await interaction.reply({
				content: "❌ This command can only be used in a server.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		if (!hasStaffPermission(interaction)) {
			await interaction.reply({
				content: "❌ You don't have permission to remove users from tickets.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const channel = interaction.channel as TextChannel;
		const categoryKey = getTicketCategoryId(channel);
		if (!categoryKey) {
			await interaction.reply({
				content: "❌ This command can only be used in a ticket channel.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const target = interaction.options.getUser("user")!;

		const existing = channel.permissionOverwrites.cache.get(target.id);
		if (!existing || !existing.allow.has(PermissionFlagsBits.ViewChannel)) {
			await interaction.reply({
				content: `❌ ${target} does not have access to this ticket.`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await channel.permissionOverwrites.delete(target.id);

		const embed = new EmbedBuilder()
			.setTitle("➖ User Removed from Ticket")
			.setColor(0xff6666)
			.addFields(
				{ name: "User", value: `${target} (${target.id})`, inline: true },
				{ name: "Removed By", value: `${interaction.user}`, inline: true },
				{ name: "Category", value: categoryKey.toUpperCase(), inline: true }
			)
			.setTimestamp()
			.setFooter({ text: CONFIG.branding.footer });

		await interaction.reply({ embeds: [embed] });
	} catch (error) {
		await handleCommandError(interaction, error, "handleRemove");
	}
}
