import {
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	EmbedBuilder,
	GuildChannel,
	ChannelType,
	Role,
	TextChannel,
	GuildMember,
	MessageFlags,
} from "discord.js";
import { CONFIG, CategoryConfig, saveConfig } from "../config";
import { handleCommandError } from "../utils/errorHandler";

function hasAdminPermission(interaction: ChatInputCommandInteraction): boolean {
	const member = interaction.member;
	if (!member || typeof member !== "object") return false;
	if (!("permissions" in member)) return false;
	const perms = member.permissions;
	if (typeof perms === "string") return false;
	return perms.has(PermissionFlagsBits.Administrator);
}

export async function handleConfigList(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasAdminPermission(interaction)) {
			return void interaction.reply({
				content: "❌ You need **Administrator** permission to use this command.",
				flags: MessageFlags.Ephemeral,
			});
		}

		const catEntries = Object.entries(CONFIG.categories)
			.map(
				([key, cat]) =>
					`**${cat.emoji} ${key}** → <#${cat.id}>\n` +
					`  ${cat.description.slice(0, 80)}...\n` +
					`  Mgmt Only: ${cat.mgmtOnly ? "Yes" : "No"} | Questions: ${cat.questions.length}`
			)
			.join("\n\n");

		const embed = new EmbedBuilder()
			.setTitle("⚙️ Current Configuration")
			.setColor(CONFIG.branding.color)
			.addFields(
				{
					name: "📋 Ticket Categories",
					value: catEntries || "No categories configured.",
					inline: false,
				},
				{
					name: "👥 Roles",
					value:
						`Staff: ${CONFIG.roles.staffId ? `<@&${CONFIG.roles.staffId}>` : "Not set"}\n` +
						`Management: ${CONFIG.roles.mgmtId ? `<@&${CONFIG.roles.mgmtId}>` : "Not set"}\n` +
						`Customer: ${CONFIG.roles.customerId ? `<@&${CONFIG.roles.customerId}>` : "Not set"}\n` +
						`Member: ${CONFIG.welcome.roleId ? `<@&${CONFIG.welcome.roleId}>` : "Not set"}\n` +
						`Booster: ${CONFIG.roles.boosterId ? `<@&${CONFIG.roles.boosterId}>` : "Not set"}`,
					inline: true,
				},
				{
					name: "🛒 Tebex",
					value:
						`Secret: ${CONFIG.tebex.secret ? "Set" : "Missing"}\n` +
						`Store: ${CONFIG.tebex.storeUrl || "Not set"}\n` +
						`Sales log: ${CONFIG.tebex.salesChannelId ? `<#${CONFIG.tebex.salesChannelId}>` : "Not set"}`,
					inline: true,
				},
				{
					name: "👋 Server",
					value:
						`Welcome: ${CONFIG.welcome.channelId ? `<#${CONFIG.welcome.channelId}>` : "Not set"}\n` +
						`Tickets: ${CONFIG.welcome.ticketChannelId ? `<#${CONFIG.welcome.ticketChannelId}>` : "Not set"}\n` +
						`Reviews: ${CONFIG.reviews.channelId ? `<#${CONFIG.reviews.channelId}>` : "Not set"}`,
					inline: false,
				},
				{
					name: "📝 Transcript",
					value: CONFIG.transcript.channelId ? `<#${CONFIG.transcript.channelId}>` : "Not set",
					inline: true,
				},
			)
			.setFooter({ text: CONFIG.branding.footer });

		await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
	} catch (error) {
		await handleCommandError(interaction, error, "handleConfigList");
	}
}

export async function handleCategoryAdd(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasAdminPermission(interaction)) {
			return void interaction.reply({
				content: "❌ You need **Administrator** permission to use this command.",
				flags: MessageFlags.Ephemeral,
			});
		}

		const name = interaction.options.getString("name")!.toLowerCase().trim();
		const channel = interaction.options.getChannel("channel") as GuildChannel;
		const description = interaction.options.getString("description")!;
		const emoji = interaction.options.getString("emoji")!;
		const mgmtOnly = interaction.options.getBoolean("mgmt_only") ?? false;
		const questionsRaw = interaction.options.getString("questions") ?? "";
		const questions = questionsRaw
			? questionsRaw
					.split(",")
					.map((q) => q.trim())
					.filter(Boolean)
			: [];

		if (CONFIG.categories[name]) {
			return void interaction.reply({
				content: `❌ Category **${name}** already exists. Use \`/config category edit\` instead.`,
				ephemeral: true,
			});
		}

		if (channel.type !== ChannelType.GuildCategory) {
			return void interaction.reply({
				content: "❌ The channel must be a **Category Channel**.",
				ephemeral: true,
			});
		}

		CONFIG.categories[name] = {
			id: channel.id as any,
			description,
			questions,
			emoji,
			mgmtOnly,
			mentionRole: "",
		};
		saveConfig();

		const embed = new EmbedBuilder()
			.setTitle("✅ Category Added")
			.setColor(0x00ff00)
			.addFields(
				{ name: "Name", value: name, inline: true },
				{ name: "Channel", value: `${channel}`, inline: true },
				{ name: "Emoji", value: emoji, inline: true },
				{ name: "Description", value: description, inline: false },
				{ name: "Mgmt Only", value: mgmtOnly ? "Yes" : "No", inline: true },
				{
					name: "Questions",
					value: questions.length > 0 ? questions.map((q) => `• ${q}`).join("\n") : "None",
					inline: false,
				}
			);

		await interaction.reply({ embeds: [embed], ephemeral: true });
	} catch (error) {
		await handleCommandError(interaction, error, "handleCategoryAdd");
	}
}

export async function handleCategoryRemove(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasAdminPermission(interaction)) {
			return void interaction.reply({
				content: "❌ You need **Administrator** permission to use this command.",
				ephemeral: true,
			});
		}

		const name = interaction.options.getString("name")!.toLowerCase().trim();

		if (!CONFIG.categories[name]) {
			return void interaction.reply({
				content: `❌ Category **${name}** does not exist.`,
				ephemeral: true,
			});
		}

		delete CONFIG.categories[name];
		saveConfig();

		await interaction.reply({
			content: `✅ Category **${name}** has been removed.`,
			ephemeral: true,
		});
	} catch (error) {
		await handleCommandError(interaction, error, "handleCategoryRemove");
	}
}

export async function handleCategoryEdit(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasAdminPermission(interaction)) {
			return void interaction.reply({
				content: "❌ You need **Administrator** permission to use this command.",
				ephemeral: true,
			});
		}

		const name = interaction.options.getString("name")!.toLowerCase().trim();

		if (!CONFIG.categories[name]) {
			return void interaction.reply({
				content: `❌ Category **${name}** does not exist.`,
				ephemeral: true,
			});
		}

		const cat = CONFIG.categories[name];

		const channel = interaction.options.getChannel("channel") as GuildChannel | null;
		const description = interaction.options.getString("description");
		const emoji = interaction.options.getString("emoji");
		const mgmtOnly = interaction.options.getBoolean("mgmt_only");
		const questionsRaw = interaction.options.getString("questions");

		if (channel) {
			if (channel.type !== ChannelType.GuildCategory) {
				return void interaction.reply({
					content: "❌ The channel must be a **Category Channel**.",
					ephemeral: true,
				});
			}
			cat.id = channel.id as any;
		}
		if (description) cat.description = description;
		if (emoji) cat.emoji = emoji;
		if (mgmtOnly !== null) cat.mgmtOnly = mgmtOnly;
		if (questionsRaw !== null) {
			cat.questions = questionsRaw
				? questionsRaw
						.split(",")
						.map((q) => q.trim())
						.filter(Boolean)
				: [];
		}
		saveConfig();

		const embed = new EmbedBuilder()
			.setTitle("✅ Category Updated")
			.setColor(0x00ff00)
			.addFields(
				{ name: "Name", value: name, inline: true },
				{ name: "Channel", value: `<#${cat.id}>`, inline: true },
				{ name: "Emoji", value: cat.emoji, inline: true },
				{ name: "Description", value: cat.description, inline: false },
				{ name: "Mgmt Only", value: cat.mgmtOnly ? "Yes" : "No", inline: true },
				{
					name: "Questions",
					value: cat.questions.length > 0 ? cat.questions.map((q) => `• ${q}`).join("\n") : "None",
					inline: false,
				}
			);

		await interaction.reply({ embeds: [embed], ephemeral: true });
	} catch (error) {
		await handleCommandError(interaction, error, "handleCategoryEdit");
	}
}

export async function handleCategoryList(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasAdminPermission(interaction)) {
			return void interaction.reply({
				content: "❌ You need **Administrator** permission to use this command.",
				ephemeral: true,
			});
		}

		const entries = Object.entries(CONFIG.categories);

		if (entries.length === 0) {
			return void interaction.reply({
				content: "📋 No categories configured yet.",
				ephemeral: true,
			});
		}

		const embed = new EmbedBuilder().setTitle("📋 Ticket Categories").setColor(CONFIG.branding.color);

		for (const [key, cat] of entries) {
			embed.addFields({
				name: `${cat.emoji} ${key}`,
				value:
					`Channel: <#${cat.id}>\n` +
					`Description: ${cat.description.slice(0, 100)}\n` +
					`Mgmt Only: ${cat.mgmtOnly ? "Yes" : "No"}\n` +
					`Questions: ${cat.questions.length}`,
				inline: true,
			});
		}

		embed.setFooter({ text: `${entries.length} categories total` });

		await interaction.reply({ embeds: [embed], ephemeral: true });
	} catch (error) {
		await handleCommandError(interaction, error, "handleCategoryList");
	}
}

export async function handleConfigRoles(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasAdminPermission(interaction)) {
			return void interaction.reply({
				content: "❌ You need **Administrator** permission to use this command.",
				ephemeral: true,
			});
		}

		const staffRole = interaction.options.getRole("staff_role") as Role | null;
		const mgmtRole = interaction.options.getRole("mgmt_role") as Role | null;
		const customerRole = interaction.options.getRole("customer_role") as Role | null;

		if (!staffRole && !mgmtRole && !customerRole) {
			return void interaction.reply({
				content: "❌ Provide at least one role to update.",
				ephemeral: true,
			});
		}

		const changes: string[] = [];

		if (staffRole) {
			CONFIG.roles.staffId = staffRole.id as any;
			changes.push(`Staff Role: ${staffRole}`);
		}
		if (mgmtRole) {
			CONFIG.roles.mgmtId = mgmtRole.id as any;
			changes.push(`Management Role: ${mgmtRole}`);
		}
		if (customerRole) {
			CONFIG.roles.customerId = customerRole.id;
			changes.push(`Customer Role: ${customerRole}`);
		}
		saveConfig();

		await interaction.reply({
			content: `✅ Roles updated:\n${changes.map((c) => `• ${c}`).join("\n")}`,
			ephemeral: true,
		});
	} catch (error) {
		await handleCommandError(interaction, error, "handleConfigRoles");
	}
}

export async function handleConfigTranscript(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasAdminPermission(interaction)) {
			return void interaction.reply({
				content: "❌ You need **Administrator** permission to use this command.",
				ephemeral: true,
			});
		}

		const logChannel = interaction.options.getChannel("log_channel") as GuildChannel | null;

		if (!logChannel) {
			return void interaction.reply({
				content: "❌ Provide a log channel.",
				ephemeral: true,
			});
		}

		CONFIG.transcript.channelId = logChannel.id as any;
		saveConfig();

		await interaction.reply({
			content: `✅ Transcript log channel set to ${logChannel}`,
			ephemeral: true,
		});
	} catch (error) {
		await handleCommandError(interaction, error, "handleConfigTranscript");
	}
}

export async function handleConfigModlog(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasAdminPermission(interaction)) {
			return void interaction.reply({
				content: "❌ You need **Administrator** permission to use this command.",
				ephemeral: true,
			});
		}

		const logChannel = interaction.options.getChannel("log_channel");

		if (!logChannel) {
			return void interaction.reply({
				content: "❌ Provide a log channel.",
				ephemeral: true,
			});
		}

		CONFIG.modlog.channelId = logChannel.id as any;
		saveConfig();

		await interaction.reply({
			content: `✅ Mod-log channel set to ${logChannel}`,
			ephemeral: true,
		});
	} catch (error) {
		await handleCommandError(interaction, error, "handleConfigModlog");
	}
}

export async function handleCategoryAutocomplete(interaction: any): Promise<void> {
	const focused = interaction.options.getFocused();
	const choices = Object.keys(CONFIG.categories)
		.filter((key) => key.startsWith(focused.toLowerCase()))
		.slice(0, 25)
		.map((key) => ({ name: key, value: key }));

	await interaction.respond(choices);
}

export async function handleConfigGiveaway(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		if (!hasAdminPermission(interaction)) {
			return void interaction.reply({
				content: "❌ You need **Administrator** permission to use this command.",
				flags: MessageFlags.Ephemeral,
			});
		}

		const channel = interaction.options.getChannel("channel");
		const defaultDuration = interaction.options.getInteger("default_duration_minutes");
		const emoji = interaction.options.getString("emoji");
		const manageRole = interaction.options.getRole("manage_role");

		const changes: string[] = [];

		if (channel) {
			CONFIG.giveaway.channelId = channel.id as any;
			changes.push("Default Channel: " + channel);
		}
		if (defaultDuration !== null) {
			CONFIG.giveaway.defaultDurationMinutes = defaultDuration;
			changes.push("Default Duration: " + defaultDuration + " minutes");
		}
		if (emoji) {
			CONFIG.giveaway.emoji = emoji;
			changes.push("Entry Emoji: " + emoji);
		}
		if (manageRole) {
			CONFIG.giveaway.manageRoleId = manageRole.id as any;
			changes.push("Manage Role: " + manageRole);
		}

		if (changes.length === 0) {
			return void interaction.reply({
				content: "❌ Provide at least one setting to update.",
				ephemeral: true,
			});
		}

		saveConfig();

		await interaction.reply({
			content: "✅ Giveaway settings updated:\n" + changes.map((c) => "• " + c).join("\n"),
			ephemeral: true,
		});
	} catch (error) {
		await handleCommandError(interaction, error, "handleConfigGiveaway");
	}
}
