import {
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	EmbedBuilder,
	GuildMember,
	TextChannel,
	MessageFlags,
} from "discord.js";
import { CONFIG } from "../config";
import { sendModLog } from "./modlog";
import { hasStaffRole } from "../utils/roles";
import { addWarning, getWarnings, clearWarnings } from "./warnings";
import { handleCommandError, safeAsync } from "../utils/errorHandler";

function hasStaffPermission(interaction: ChatInputCommandInteraction): boolean {
	const perms = interaction.memberPermissions;
	if (!perms) return false;
	if (perms.has(PermissionFlagsBits.Administrator)) return true;
	if (perms.has(PermissionFlagsBits.ModerateMembers)) return true;
	const member = interaction.member as GuildMember;
	if (hasStaffRole(member)) return true;
	return false;
}

function formatDuration(ms: number): string {
	const s = Math.floor(ms / 1000);
	const m = Math.floor(s / 60);
	const h = Math.floor(m / 60);
	const d = Math.floor(h / 24);
	if (d > 0) return `${d}d ${h % 24}h`;
	if (h > 0) return `${h}h ${m % 60}m`;
	if (m > 0) return `${m}m`;
	return `${s}s`;
}

function parseDuration(input: string): number | null {
	const match = input.match(/^(\d+)\s*(s|m|h|d|w)$/);
	if (!match) return null;
	const v = parseInt(match[1]);
	const u = match[2];
	const mult: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
	return v * (mult[u] ?? 0);
}

export async function handleWarn(interaction: ChatInputCommandInteraction): Promise<void> {
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
				content: "❌ You don't have permission to warn users.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const target = interaction.options.getUser("user")!;
		const reason = interaction.options.getString("reason") ?? "No reason provided";
		const member = interaction.member as GuildMember;
		await interaction.guild.members.fetch(target.id).catch(() => null);
		const entry = addWarning(target.id, interaction.user.id, reason);
		const count = getWarnings(target.id).length;
		const embed = new EmbedBuilder()
			.setTitle("⚠️ Warning Issued")
			.setColor(0xffcc00)
			.addFields(
				{ name: "User", value: `${target} (${target.id})`, inline: true },
				{ name: "Moderator", value: `${interaction.user}`, inline: true },
				{ name: "Reason", value: reason, inline: false },
				{ name: "Warning #", value: `${count}`, inline: true },
				{ name: "ID", value: `#${entry.id}`, inline: true }
			)
			.setTimestamp()
			.setFooter({ text: CONFIG.branding.footer });
		await interaction.reply({ embeds: [embed] });
		safeAsync(async () => {
			await target.send(
				`⚠️ You have been warned in **${interaction.guild!.name}**.\n**Reason:** ${reason}\n**Warning #${count}**`
			);
		});
		await sendModLog(interaction.client, "Warn", member, target, reason, undefined, { "Warning #": `${count}` });
	} catch (error) {
		await handleCommandError(interaction, error, "handleWarn");
	}
}

export async function handleWarnings(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasStaffPermission(interaction)) {
			await interaction.reply({
				content: "❌ You don't have permission to view warnings.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const target = interaction.options.getUser("user")!;
		const entries = getWarnings(target.id);
		if (entries.length === 0) {
			await interaction.reply({
				content: `✅ **${target.tag}** has no warnings.`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const embed = new EmbedBuilder()
			.setTitle(`⚠️ Warnings for ${target.tag}`)
			.setColor(0xffcc00)
			.setThumbnail(target.displayAvatarURL())
			.setDescription(
				entries
					.map(
						(e) =>
							`**#${e.id}** - <t:${Math.floor(e.timestamp / 1000)}:R>\nMod: <@${e.moderatorId}>\nReason: ${e.reason}`
					)
					.join("\n\n")
			)
			.setFooter({ text: `Total: ${entries.length} warning(s)` });
		await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
	} catch (error) {
		await handleCommandError(interaction, error, "handleWarnings");
	}
}

export async function handleClearWarnings(interaction: ChatInputCommandInteraction): Promise<void> {
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
				content: "❌ You don't have permission to clear warnings.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const member = interaction.member as GuildMember;
		const target = interaction.options.getUser("user")!;
		const count = clearWarnings(target.id);
		if (count === 0) {
			await interaction.reply({
				content: `✅ **${target.tag}** had no warnings to clear.`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await interaction.reply({
			content: `✅ Cleared **${count}** warning(s) for **${target.tag}**.`,
			flags: MessageFlags.Ephemeral,
		});
		await sendModLog(interaction.client, "ClearWarnings", member, target, `Cleared ${count} warning(s)`);
	} catch (error) {
		await handleCommandError(interaction, error, "handleClearWarnings");
	}
}

export async function handleMute(interaction: ChatInputCommandInteraction): Promise<void> {
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
				content: "❌ You don't have permission to mute users.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const member = interaction.member as GuildMember;
		const target = interaction.options.getUser("user")!;
		const durationStr = interaction.options.getString("duration")!;
		const reason = interaction.options.getString("reason") ?? "No reason provided";
		const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
		if (!targetMember) {
			await interaction.reply({ content: "❌ That user is not in the server.", flags: MessageFlags.Ephemeral });
			return;
		}
		if (!targetMember.moderatable) {
			await interaction.reply({
				content: "❌ I cannot mute that user. They may have higher permissions.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const ms = parseDuration(durationStr);
		if (!ms || ms <= 0) {
			await interaction.reply({
				content: "❌ Invalid duration. Use format like `10m`, `2h`, `3d`, `1w`.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		if (ms > 28 * 24 * 60 * 60 * 1000) {
			await interaction.reply({ content: "❌ Maximum timeout is 28 days.", flags: MessageFlags.Ephemeral });
			return;
		}
		await targetMember.timeout(ms, reason);
		const formatted = formatDuration(ms);
		const embed = new EmbedBuilder()
			.setTitle("🔇 Member Muted")
			.setColor(0xff9900)
			.addFields(
				{ name: "User", value: `${target} (${target.id})`, inline: true },
				{ name: "Moderator", value: `${interaction.user}`, inline: true },
				{ name: "Duration", value: formatted, inline: true },
				{ name: "Reason", value: reason, inline: false }
			)
			.setTimestamp()
			.setFooter({ text: CONFIG.branding.footer });
		await interaction.reply({ embeds: [embed] });
		safeAsync(async () => {
			await target.send(
				`🔇 You have been muted in **${interaction.guild!.name}**.\n**Duration:** ${formatted}\n**Reason:** ${reason}`
			);
		});
		await sendModLog(interaction.client, "Mute", member, target, reason, formatted);
	} catch (error) {
		await handleCommandError(interaction, error, "handleMute");
	}
}

export async function handleUnmute(interaction: ChatInputCommandInteraction): Promise<void> {
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
				content: "❌ You don't have permission to unmute users.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const member = interaction.member as GuildMember;
		const target = interaction.options.getUser("user")!;
		const reason = interaction.options.getString("reason") ?? "No reason provided";
		const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
		if (!targetMember) {
			await interaction.reply({ content: "❌ That user is not in the server.", flags: MessageFlags.Ephemeral });
			return;
		}
		if (!targetMember.moderatable) {
			await interaction.reply({ content: "❌ I cannot unmute that user.", flags: MessageFlags.Ephemeral });
			return;
		}
		await targetMember.timeout(null, reason);
		const embed = new EmbedBuilder()
			.setTitle("🔊 Member Unmuted")
			.setColor(0x00cc66)
			.addFields(
				{ name: "User", value: `${target} (${target.id})`, inline: true },
				{ name: "Moderator", value: `${interaction.user}`, inline: true },
				{ name: "Reason", value: reason, inline: false }
			)
			.setTimestamp()
			.setFooter({ text: CONFIG.branding.footer });
		await interaction.reply({ embeds: [embed] });
		safeAsync(async () => {
			await target.send(`🔊 You have been unmuted in **${interaction.guild!.name}**.\n**Reason:** ${reason}`);
		});
		await sendModLog(interaction.client, "Unmute", member, target, reason);
	} catch (error) {
		await handleCommandError(interaction, error, "handleUnmute");
	}
}

export async function handleKick(interaction: ChatInputCommandInteraction): Promise<void> {
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
				content: "❌ You don't have permission to kick users.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const member = interaction.member as GuildMember;
		const target = interaction.options.getUser("user")!;
		const reason = interaction.options.getString("reason") ?? "No reason provided";
		const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
		if (!targetMember) {
			await interaction.reply({ content: "❌ That user is not in the server.", flags: MessageFlags.Ephemeral });
			return;
		}
		if (!targetMember.kickable) {
			await interaction.reply({
				content: "❌ I cannot kick that user. They may have higher permissions.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		safeAsync(async () => {
			await target.send(`👢 You have been kicked from **${interaction.guild!.name}**.\n**Reason:** ${reason}`);
		});
		await targetMember.kick(reason);
		const embed = new EmbedBuilder()
			.setTitle("👢 Member Kicked")
			.setColor(0xff6600)
			.addFields(
				{ name: "User", value: `${target} (${target.id})`, inline: true },
				{ name: "Moderator", value: `${interaction.user}`, inline: true },
				{ name: "Reason", value: reason, inline: false }
			)
			.setTimestamp()
			.setFooter({ text: CONFIG.branding.footer });
		await interaction.reply({ embeds: [embed] });
		await sendModLog(interaction.client, "Kick", member, target, reason);
	} catch (error) {
		await handleCommandError(interaction, error, "handleKick");
	}
}

export async function handleBan(interaction: ChatInputCommandInteraction): Promise<void> {
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
				content: "❌ You don't have permission to ban users.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const member = interaction.member as GuildMember;
		const target = interaction.options.getUser("user")!;
		const reason = interaction.options.getString("reason") ?? "No reason provided";
		const deleteDays = interaction.options.getInteger("delete_days") ?? 0;
		const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
		if (targetMember && !targetMember.bannable) {
			await interaction.reply({
				content: "❌ I cannot ban that user. They may have higher permissions.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		safeAsync(async () => {
			await target.send(`🔨 You have been banned from **${interaction.guild!.name}**.\n**Reason:** ${reason}`);
		});
		await interaction.guild.bans.create(target.id, { reason, deleteMessageSeconds: deleteDays * 86400 });
		const embed = new EmbedBuilder()
			.setTitle("🔨 Member Banned")
			.setColor(0xff0000)
			.addFields(
				{ name: "User", value: `${target} (${target.id})`, inline: true },
				{ name: "Moderator", value: `${interaction.user}`, inline: true },
				{ name: "Reason", value: reason, inline: false }
			)
			.setTimestamp()
			.setFooter({ text: CONFIG.branding.footer });
		if (deleteDays > 0) embed.addFields({ name: "Messages Deleted", value: `${deleteDays} day(s)`, inline: true });
		await interaction.reply({ embeds: [embed] });
		await sendModLog(
			interaction.client,
			"Ban",
			member,
			target,
			reason,
			undefined,
			deleteDays > 0 ? { "Deleted Messages": `${deleteDays} day(s)` } : undefined
		);
	} catch (error) {
		await handleCommandError(interaction, error, "handleBan");
	}
}

export async function handleUnban(interaction: ChatInputCommandInteraction): Promise<void> {
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
				content: "❌ You don't have permission to unban users.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const member = interaction.member as GuildMember;
		const userId = interaction.options.getString("user_id")!;
		const reason = interaction.options.getString("reason") ?? "No reason provided";
		try {
			await interaction.guild.bans.remove(userId, reason);
		} catch {
			await interaction.reply({
				content: "❌ Could not unban that user. Check the ID is correct.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const embed = new EmbedBuilder()
			.setTitle("🔓 Member Unbanned")
			.setColor(0x0099ff)
			.addFields(
				{ name: "User ID", value: userId, inline: true },
				{ name: "Moderator", value: `${interaction.user}`, inline: true },
				{ name: "Reason", value: reason, inline: false }
			)
			.setTimestamp()
			.setFooter({ text: CONFIG.branding.footer });
		await interaction.reply({ embeds: [embed] });
	} catch (error) {
		await handleCommandError(interaction, error, "handleUnban");
	}
}

export async function handlePurge(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasStaffPermission(interaction)) {
			await interaction.reply({
				content: "❌ You don't have permission to purge messages.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const member = interaction.member as GuildMember;
		const amount = interaction.options.getInteger("amount")!;
		const targetUser = interaction.options.getUser("user");
		const channel = interaction.channel as TextChannel;
		if (!channel) {
			await interaction.reply({
				content: "❌ This command can only be used in a server channel.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		if (amount < 1 || amount > 100) {
			await interaction.reply({ content: "❌ Amount must be between 1 and 100.", flags: MessageFlags.Ephemeral });
			return;
		}
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		let messages = await channel.messages.fetch({ limit: Math.min(amount, 100) });
		if (targetUser) messages = messages.filter((m) => m.author.id === targetUser.id);
		const deleted = await channel.bulkDelete(messages, true);
		await interaction.followUp({
			content: `✅ Deleted **${deleted.size}** message(s).`,
			flags: MessageFlags.Ephemeral,
		});
		if (targetUser) {
			await sendModLog(
				interaction.client,
				"Purge",
				member,
				targetUser,
				`${deleted.size} messages purged in #${channel.name}`
			);
		}
	} catch (error) {
		await handleCommandError(interaction, error, "handlePurge");
	}
}

export async function handleSlowmode(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasStaffPermission(interaction)) {
			await interaction.reply({
				content: "❌ You don't have permission to set slowmode.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const member = interaction.member as GuildMember;
		const seconds = interaction.options.getInteger("seconds")!;
		const reason = interaction.options.getString("reason") ?? "No reason provided";
		const channel = interaction.channel as TextChannel;
		if (!channel) {
			await interaction.reply({
				content: "❌ This command can only be used in a server channel.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		if (seconds < 0 || seconds > 21600) {
			await interaction.reply({
				content: "❌ Slowmode must be between 0 and 21600 seconds (6 hours).",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await channel.setRateLimitPerUser(seconds, reason);
		const display = seconds === 0 ? "Disabled" : `${seconds}s`;
		await interaction.reply({ content: `✅ Slowmode set to **${display}** in ${channel}.` });
		if (seconds > 0) {
			await sendModLog(interaction.client, "Slowmode", member, interaction.user, reason, undefined, {
				Duration: `${seconds}s`,
				Channel: `<#${channel.id}>`,
			});
		}
	} catch (error) {
		await handleCommandError(interaction, error, "handleSlowmode");
	}
}

export async function handleLock(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasStaffPermission(interaction)) {
			await interaction.reply({
				content: "❌ You don't have permission to lock channels.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const member = interaction.member as GuildMember;
		const reason = interaction.options.getString("reason") ?? "No reason provided";
		const channel = interaction.channel as TextChannel;
		if (!channel) {
			await interaction.reply({
				content: "❌ This command can only be used in a server channel.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: false });
		const embed = new EmbedBuilder()
			.setTitle("🔒 Channel Locked")
			.setColor(0xcc3333)
			.setDescription(`This channel has been locked.\n**Reason:** ${reason}`)
			.setFooter({ text: CONFIG.branding.footer });
		await interaction.reply({ embeds: [embed] });
		await sendModLog(interaction.client, "Lock", member, interaction.user, reason, undefined, {
			Channel: `<#${channel.id}>`,
		});
	} catch (error) {
		await handleCommandError(interaction, error, "handleLock");
	}
}

export async function handleUnlock(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasStaffPermission(interaction)) {
			await interaction.reply({
				content: "❌ You don't have permission to unlock channels.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const member = interaction.member as GuildMember;
		const reason = interaction.options.getString("reason") ?? "No reason provided";
		const channel = interaction.channel as TextChannel;
		if (!channel) {
			await interaction.reply({
				content: "❌ This command can only be used in a server channel.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: null });
		const embed = new EmbedBuilder()
			.setTitle("🔓 Channel Unlocked")
			.setColor(0x33cc33)
			.setDescription(`This channel has been unlocked.\n**Reason:** ${reason}`)
			.setFooter({ text: CONFIG.branding.footer });
		await interaction.reply({ embeds: [embed] });
		await sendModLog(interaction.client, "Unlock", member, interaction.user, reason, undefined, {
			Channel: `<#${channel.id}>`,
		});
	} catch (error) {
		await handleCommandError(interaction, error, "handleUnlock");
	}
}
