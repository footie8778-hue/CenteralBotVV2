import { PermissionFlagsBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import * as dotenv from "dotenv";
import { createLogger } from "./utils/logger";

dotenv.config();

const log = createLogger("deploy");

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const commands = [
	// ===== General =====
	new SlashCommandBuilder().setName("hello").setDescription("Says hello to you!"),

	new SlashCommandBuilder().setName("ping").setDescription("Checks the bot's latency."),

	new SlashCommandBuilder()
		.setName("status")
		.setDescription("Shows Central Roleplay FiveM server status (players, online/offline)."),

	new SlashCommandBuilder()
		.setName("setupstatus")
		.setDescription("Post or refresh the live status embed in this channel (staff).")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

	new SlashCommandBuilder()
		.setName("review")
		.setDescription("Post a review for CSM Script.")
		.addIntegerOption((opt) =>
			opt
				.setName("rating")
				.setDescription("Star rating from 1 to 5")
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(5)
		)
		.addStringOption((opt) =>
			opt.setName("comment").setDescription("Your review").setRequired(true).setMaxLength(1000)
		),

	new SlashCommandBuilder()
		.setName("verify")
		.setDescription("Link a Tebex purchase and receive the customer role.")
		.addStringOption((opt) =>
			opt
				.setName("transaction")
				.setDescription("Your Tebex transaction ID, for example tbx-1234abcd")
				.setRequired(true)
				.setMaxLength(64)
		),

	new SlashCommandBuilder()
		.setName("order")
		.setDescription("Look up a Tebex order. Staff only.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		.addStringOption((opt) =>
			opt
				.setName("transaction")
				.setDescription("Tebex transaction ID")
				.setRequired(true)
				.setMaxLength(64)
		),

	// ===== Tickets =====
	new SlashCommandBuilder()
		.setName("setuppanel")
		.setDescription("Sends the support ticket panel to this channel.")
		.setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands),

	new SlashCommandBuilder()
		.setName("add")
		.setDescription("Add a user to this ticket channel.")
		.addUserOption((opt) => opt.setName("user").setDescription("User to add").setRequired(true)),

	new SlashCommandBuilder()
		.setName("remove")
		.setDescription("Remove a user from this ticket channel.")
		.addUserOption((opt) => opt.setName("user").setDescription("User to remove").setRequired(true)),

	// ===== Config =====
	new SlashCommandBuilder()
		.setName("config")
		.setDescription("Configure the ticket system.")
		.setDefaultMemberPermissions(0n)
		.addSubcommand((sub) => sub.setName("list").setDescription("Shows the current configuration."))
		.addSubcommandGroup((group) =>
			group
				.setName("category")
				.setDescription("Manage ticket categories.")
				.addSubcommand((sub) =>
					sub
						.setName("add")
						.setDescription("Add a new ticket category.")
						.addStringOption((opt) =>
							opt
								.setName("name")
								.setDescription("Category key (e.g. general, script)")
								.setRequired(true)
								.setMaxLength(30)
						)
						.addChannelOption((opt) =>
							opt
								.setName("channel")
								.setDescription("Discord category channel for tickets")
								.setRequired(true)
								.addChannelTypes(4)
						)
						.addStringOption((opt) =>
							opt
								.setName("description")
								.setDescription("Short description of this category")
								.setRequired(true)
								.setMaxLength(200)
						)
						.addStringOption((opt) =>
							opt
								.setName("emoji")
								.setDescription("Emoji for this category (e.g. ❓)")
								.setRequired(true)
								.setMaxLength(10)
						)
						.addBooleanOption((opt) =>
							opt
								.setName("mgmt_only")
								.setDescription("Only management role can see these tickets?")
								.setRequired(false)
						)
						.addStringOption((opt) =>
							opt
								.setName("questions")
								.setDescription("Comma-separated questions to ask the user")
								.setRequired(false)
								.setMaxLength(500)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName("remove")
						.setDescription("Remove a ticket category.")
						.addStringOption((opt) =>
							opt
								.setName("name")
								.setDescription("Category key to remove")
								.setRequired(true)
								.setAutocomplete(true)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName("edit")
						.setDescription("Edit an existing ticket category.")
						.addStringOption((opt) =>
							opt
								.setName("name")
								.setDescription("Category key to edit")
								.setRequired(true)
								.setAutocomplete(true)
						)
						.addChannelOption((opt) =>
							opt
								.setName("channel")
								.setDescription("New Discord category channel")
								.setRequired(false)
								.addChannelTypes(4)
						)
						.addStringOption((opt) =>
							opt
								.setName("description")
								.setDescription("New description")
								.setRequired(false)
								.setMaxLength(200)
						)
						.addStringOption((opt) =>
							opt.setName("emoji").setDescription("New emoji").setRequired(false).setMaxLength(10)
						)
						.addBooleanOption((opt) =>
							opt
								.setName("mgmt_only")
								.setDescription("Only management role can see these tickets?")
								.setRequired(false)
						)
						.addStringOption((opt) =>
							opt
								.setName("questions")
								.setDescription("New comma-separated questions (replaces existing)")
								.setRequired(false)
								.setMaxLength(500)
						)
				)
				.addSubcommand((sub) => sub.setName("list").setDescription("List all configured categories."))
		)
		.addSubcommand((sub) =>
			sub
				.setName("roles")
				.setDescription("Configure staff/management roles.")
				.addRoleOption((opt) =>
					opt.setName("staff_role").setDescription("The support staff role").setRequired(false)
				)
				.addRoleOption((opt) =>
					opt.setName("mgmt_role").setDescription("The management role").setRequired(false)
				)
				.addRoleOption((opt) =>
					opt.setName("customer_role").setDescription("Role given after a Tebex purchase is verified").setRequired(false)
				)
		)
		.addSubcommand((sub) =>
			sub
				.setName("transcript")
				.setDescription("Configure transcript settings.")
				.addChannelOption((opt) =>
					opt
						.setName("log_channel")
						.setDescription("Channel to send ticket logs to")
						.setRequired(false)
						.addChannelTypes(0, 5)
				)
		)
		.addSubcommand((sub) =>
			sub
				.setName("modlog")
				.setDescription("Configure the moderation log channel.")
				.addChannelOption((opt) =>
					opt
						.setName("log_channel")
						.setDescription("Channel to send moderation logs to")
						.setRequired(true)
						.addChannelTypes(0, 5)
				)
		)
		.addSubcommand((sub) =>
			sub
				.setName("giveaway")
				.setDescription("Configure the giveaway system.")
				.addChannelOption((opt) =>
					opt
						.setName("channel")
						.setDescription("Default channel for giveaways")
						.setRequired(false)
						.addChannelTypes(0, 5)
				)
				.addIntegerOption((opt) =>
					opt
						.setName("default_duration_minutes")
						.setDescription("Default giveaway duration in minutes")
						.setRequired(false)
						.setMinValue(1)
						.setMaxValue(10080)
				)
				.addStringOption((opt) =>
					opt
						.setName("emoji")
						.setDescription("Emoji used for giveaway entries")
						.setRequired(false)
						.setMaxLength(10)
				)
				.addRoleOption((opt) =>
					opt
						.setName("manage_role")
						.setDescription("Role required to create/edit/end giveaways")
						.setRequired(false)
				)
		),

	// ===== Moderation =====
	new SlashCommandBuilder()
		.setName("warn")
		.setDescription("Warn a user.")
		.addUserOption((opt) => opt.setName("user").setDescription("User to warn").setRequired(true))
		.addStringOption((opt) =>
			opt.setName("reason").setDescription("Reason for the warning").setRequired(false).setMaxLength(500)
		),

	new SlashCommandBuilder()
		.setName("warnings")
		.setDescription("View warnings for a user.")
		.addUserOption((opt) => opt.setName("user").setDescription("User to check").setRequired(true)),

	new SlashCommandBuilder()
		.setName("clearwarnings")
		.setDescription("Clear all warnings for a user.")
		.addUserOption((opt) => opt.setName("user").setDescription("User to clear warnings for").setRequired(true)),

	new SlashCommandBuilder()
		.setName("mute")
		.setDescription("Timeout/mute a user.")
		.addUserOption((opt) => opt.setName("user").setDescription("User to mute").setRequired(true))
		.addStringOption((opt) =>
			opt.setName("duration").setDescription("Duration (e.g. 10m, 2h, 3d, 1w)").setRequired(true).setMaxLength(10)
		)
		.addStringOption((opt) =>
			opt.setName("reason").setDescription("Reason for the mute").setRequired(false).setMaxLength(500)
		),

	new SlashCommandBuilder()
		.setName("unmute")
		.setDescription("Remove timeout from a user.")
		.addUserOption((opt) => opt.setName("user").setDescription("User to unmute").setRequired(true))
		.addStringOption((opt) =>
			opt.setName("reason").setDescription("Reason for the unmute").setRequired(false).setMaxLength(500)
		),

	new SlashCommandBuilder()
		.setName("kick")
		.setDescription("Kick a user from the server.")
		.addUserOption((opt) => opt.setName("user").setDescription("User to kick").setRequired(true))
		.addStringOption((opt) =>
			opt.setName("reason").setDescription("Reason for the kick").setRequired(false).setMaxLength(500)
		),

	new SlashCommandBuilder()
		.setName("ban")
		.setDescription("Ban a user from the server.")
		.addUserOption((opt) => opt.setName("user").setDescription("User to ban").setRequired(true))
		.addStringOption((opt) =>
			opt.setName("reason").setDescription("Reason for the ban").setRequired(false).setMaxLength(500)
		)
		.addIntegerOption((opt) =>
			opt
				.setName("delete_days")
				.setDescription("Delete messages from this many days back (0-7)")
				.setRequired(false)
				.setMinValue(0)
				.setMaxValue(7)
		),

	new SlashCommandBuilder()
		.setName("unban")
		.setDescription("Unban a user by ID.")
		.addStringOption((opt) =>
			opt.setName("user_id").setDescription("User ID to unban").setRequired(true).setMaxLength(20)
		)
		.addStringOption((opt) =>
			opt.setName("reason").setDescription("Reason for the unban").setRequired(false).setMaxLength(500)
		),

	new SlashCommandBuilder()
		.setName("purge")
		.setDescription("Bulk delete messages in this channel.")
		.addIntegerOption((opt) =>
			opt
				.setName("amount")
				.setDescription("Number of messages to delete (1-100)")
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(100)
		)
		.addUserOption((opt) =>
			opt.setName("user").setDescription("Only delete messages from this user").setRequired(false)
		),

	new SlashCommandBuilder()
		.setName("slowmode")
		.setDescription("Set slowmode in this channel.")
		.addIntegerOption((opt) =>
			opt
				.setName("seconds")
				.setDescription("Slowmode in seconds (0 to disable, max 21600)")
				.setRequired(true)
				.setMinValue(0)
				.setMaxValue(21600)
		)
		.addStringOption((opt) =>
			opt.setName("reason").setDescription("Reason for the slowmode change").setRequired(false).setMaxLength(500)
		),

	new SlashCommandBuilder()
		.setName("lock")
		.setDescription("Lock this channel (prevent @everyone from sending messages).")
		.addStringOption((opt) =>
			opt.setName("reason").setDescription("Reason for locking").setRequired(false).setMaxLength(500)
		),

	new SlashCommandBuilder()
		.setName("unlock")
		.setDescription("Unlock this channel.")
		.addStringOption((opt) =>
			opt.setName("reason").setDescription("Reason for unlocking").setRequired(false).setMaxLength(500)
		),

	// ===== Giveaways =====
	new SlashCommandBuilder()
		.setName("giveaway")
		.setDescription("Manage giveaways.")
		.addSubcommand((sub) =>
			sub
				.setName("create")
				.setDescription("Create a new giveaway.")
		)
		.addSubcommand((sub) =>
			sub
				.setName("end")
				.setDescription("End a giveaway early and draw the winner.")
				.addStringOption((opt) =>
					opt
						.setName("message_id")
						.setDescription("The giveaway message ID")
						.setRequired(true)
						.setMaxLength(20)
				)
		)
		.addSubcommand((sub) =>
			sub
				.setName("reroll")
				.setDescription("Re-roll the winner(s) of an ended giveaway.")
				.addStringOption((opt) =>
					opt
						.setName("message_id")
						.setDescription("The giveaway message ID")
						.setRequired(true)
						.setMaxLength(20)
				)
		)
		.addSubcommand((sub) => sub.setName("list").setDescription("List all active giveaways."))
		.addSubcommand((sub) =>
			sub
				.setName("edit")
				.setDescription("Edit a running giveaway.")
				.addStringOption((opt) =>
					opt
						.setName("message_id")
						.setDescription("The giveaway message ID")
						.setRequired(true)
						.setMaxLength(20)
				)
				.addStringOption((opt) =>
					opt.setName("prize").setDescription("New prize name").setRequired(false).setMaxLength(200)
				)
				.addIntegerOption((opt) =>
					opt
						.setName("winners")
						.setDescription("New winner count")
						.setRequired(false)
						.setMinValue(1)
						.setMaxValue(20)
				)
		),
].map((cmd) => cmd.toJSON());

async function deploy(): Promise<void> {
	if (!clientId) {
		log.error("CLIENT_ID is not set in .env");
		console.log("❌ CLIENT_ID is not set in .env");
		process.exit(1);
	}

	if (!process.env.DISCORD_TOKEN) {
		log.error("DISCORD_TOKEN is not set in .env");
		console.log("❌ DISCORD_TOKEN is not set in .env");
		process.exit(1);
	}

	const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

	try {
		console.log("🧹 Clearing global commands...");
		await rest.put(Routes.applicationCommands(clientId), { body: [] });
		console.log("   ✅ Global commands cleared.");

		if (guildId) {
			console.log(`🧹 Clearing guild commands for ${guildId}...`);
			await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
			console.log("   ✅ Guild commands cleared.");

			console.log(`🔄 Registering ${commands.length} commands to guild ${guildId}...`);
			await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
				body: commands,
			});
			console.log(`✅ Done! ${commands.length} commands available instantly.`);
		} else {
			console.log(`🔄 Registering ${commands.length} commands globally...`);
			await rest.put(Routes.applicationCommands(clientId), {
				body: commands,
			});
			console.log(`✅ Done! May take up to 1 hour to appear.`);
		}

		process.exit(0);
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		log.error({ err, clientId }, "Failed to register commands");

		if ((error as any)?.code === 20012) {
			console.error(
				`\n❌ Error 20012: The bot token does not match application ID "${clientId}".\n` +
					`   Possible fixes:\n` +
					`   1. Check that CLIENT_ID in .env matches your Discord Application ID\n` +
					`   2. Check that DISCORD_TOKEN in .env is the correct bot token\n` +
					`   3. Regenerate the token at https://discord.com/developers/applications\n`
			);
		} else {
			console.error("❌ Failed to register commands:", err.message);
		}
		process.exit(1);
	}
}

deploy();
