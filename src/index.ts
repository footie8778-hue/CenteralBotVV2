import http from "http";
import { CONFIG } from "./config";
import { registerTicketHandlers } from "./tickets";
import { handleAdd, handleRemove } from "./tickets/commands";
import { handleCategoryAutocomplete, handleConfigList, handleCategoryAdd, handleCategoryRemove, handleCategoryEdit, handleCategoryList, handleConfigRoles, handleConfigTranscript, handleConfigModlog, handleConfigGiveaway } from "./commands/config";
import { Client, GatewayIntentBits, Interaction, Events } from "discord.js";
import { createLogger, setLogForwarder } from "./utils/logger";
import { handleCommandError } from "./utils/errorHandler";
import { initDiscordLogger, forwardToDiscord } from "./utils/discordLogger";
import { runWithCommand, getCommandContext } from "./utils/context";
import { handleHello, handlePing, handleSetupPanel } from "./commands/slash";
import { handleWarn, handleWarnings, handleClearWarnings, handleMute, handleUnmute, handleKick, handleBan, handleUnban, handlePurge, handleSlowmode, handleLock, handleUnlock, RegisterSpamDetector } from "./moderation";
import { registerWelcomeHandler } from "./welcomer/handler";
import { registerGiveawayHandlers } from "./giveaway/handler";
import { handleGiveawayCreate, handleGiveawayEnd, handleGiveawayReroll, handleGiveawayList, handleGiveawayEdit } from "./giveaway/commands";
import { handleOrderLookup, handleVerify } from "./tebex/commands";
import { handleReview } from "./reviews/commands";
import { handleStatus, handleSetupStatus } from "./fivem/commands";
import { registerStatusUpdater } from "./fivem/updater";

const log = createLogger("index");

const port = Number(process.env.PORT ?? 0);
if (port > 0) {
	http
		.createServer((_req, res) => {
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end("Central Roleplay Bot OK");
		})
		.listen(port, () => log.info("Health listener on port %s", port));
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
});



client.once(Events.ClientReady, function (ReadyClient) {
	log.info("Logged in as %s", ReadyClient.user?.tag);
	setLogForwarder(forwardToDiscord);
	initDiscordLogger(ReadyClient);
	RegisterSpamDetector(ReadyClient);
	registerTicketHandlers(ReadyClient);
	registerWelcomeHandler(ReadyClient);
	registerGiveawayHandlers(ReadyClient);
	registerStatusUpdater(ReadyClient);
});



client.on(Events.Error, (error) => {
	const cmdCtx = getCommandContext();
	if (cmdCtx) {
		log.error({ err: error, ...cmdCtx }, "Discord client error");
	} else {
		log.error({ err: error }, "Discord client error");
	}
});

process.on("unhandledRejection", (reason) => {
	const cmdCtx = getCommandContext();
	if (cmdCtx) {
		log.error({ err: reason, ...cmdCtx }, "Unhandled promise rejection");
	} else {
		log.error({ err: reason }, "Unhandled promise rejection");
	}
});

process.on("uncaughtException", (error) => {
	log.fatal({ err: error }, "Uncaught exception - shutting down");
	process.exit(1);
});



// ===== Slash Command Router =====
client.on("interactionCreate", (interaction: Interaction) => {
	const commandName =
		"commandName" in interaction && typeof interaction.commandName === "string"
			? interaction.commandName
			: "unknown";
	const userId = "user" in interaction && interaction.user ? interaction.user.id : "unknown";

	return runWithCommand(commandName, userId, async () => {
		try {
			if (interaction.isAutocomplete()) {
				const focused = interaction.options.getFocused(true);
				if (focused.name === "name" && interaction.commandName === "config") {
					await handleCategoryAutocomplete(interaction);
				}
				return;
			}

			if (!interaction.isChatInputCommand()) return;

			// General
			if (commandName === "hello") return handleHello(interaction);
			if (commandName === "ping") return handlePing(interaction);
			if (commandName === "status") return handleStatus(interaction);
			if (commandName === "setupstatus") return handleSetupStatus(interaction);
			if (commandName === "verify") return handleVerify(interaction);
			if (commandName === "order") return handleOrderLookup(interaction);
			if (commandName === "review") return handleReview(interaction);

			// Tickets
			if (commandName === "setuppanel") return handleSetupPanel(interaction);
			if (commandName === "add") return handleAdd(interaction);
			if (commandName === "remove") return handleRemove(interaction);

			// Config
			if (commandName === "config") {
				const group = interaction.options.getSubcommandGroup(false);
				const sub = interaction.options.getSubcommand();

				if (sub === "list" && !group) return handleConfigList(interaction);

				if (group === "category") {
					if (sub === "add") return handleCategoryAdd(interaction);
					if (sub === "remove") return handleCategoryRemove(interaction);
					if (sub === "edit") return handleCategoryEdit(interaction);
					if (sub === "list") return handleCategoryList(interaction);
				}

				if (sub === "roles") return handleConfigRoles(interaction);
				if (sub === "transcript") return handleConfigTranscript(interaction);
				if (sub === "modlog") return handleConfigModlog(interaction);
				if (sub === "giveaway") return handleConfigGiveaway(interaction);
			}

			// Moderation
			if (commandName === "warn") return handleWarn(interaction);
			if (commandName === "warnings") return handleWarnings(interaction);
			if (commandName === "clearwarnings") return handleClearWarnings(interaction);
			if (commandName === "mute") return handleMute(interaction);
			if (commandName === "unmute") return handleUnmute(interaction);
			if (commandName === "kick") return handleKick(interaction);
			if (commandName === "ban") return handleBan(interaction);
			if (commandName === "unban") return handleUnban(interaction);
			if (commandName === "purge") return handlePurge(interaction);
			if (commandName === "slowmode") return handleSlowmode(interaction);
			if (commandName === "lock") return handleLock(interaction);
			if (commandName === "unlock") return handleUnlock(interaction);

			// Giveaways
			if (commandName === "giveaway") {
				const sub = interaction.options.getSubcommand();
				if (sub === "create") return handleGiveawayCreate(interaction);
				if (sub === "end") return handleGiveawayEnd(interaction);
				if (sub === "reroll") return handleGiveawayReroll(interaction);
				if (sub === "list") return handleGiveawayList(interaction);
				if (sub === "edit") return handleGiveawayEdit(interaction);
			}
		} catch (error) {
			if ("reply" in interaction && "user" in interaction) {
				await handleCommandError(interaction as any, error, commandName);
			} else {
				log.error({ err: error }, "Interaction handling failed");
			}
		}
	});
});

client.login(CONFIG.token);

