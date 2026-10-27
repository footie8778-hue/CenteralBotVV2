import {
	Client,
	Guild,
	TextChannel,
	ButtonInteraction,
	MessageReaction,
	User,
	GuildMember,
	MessageFlags,
} from "discord.js";
import { CONFIG, saveConfig } from "../config";
import {
	GiveawayData,
	saveGiveaway,
	getGiveaway,
	updateGiveaway,
	endGiveaway,
	addEntry,
	removeEntry,
	hasEntry,
	getActiveGiveaways,
} from "./storage";
import {
	buildGiveawayContainer,
	buildGiveawayActionRow,
	buildGiveawayEndActionRow,
	buildWinnerAnnouncement,
} from "./views";
import { createLogger } from "../utils/logger";

const log = createLogger("giveawayHandler");

const activeTimers = new Map<string, NodeJS.Timeout>();

function checkRequirements(member: GuildMember, data: GiveawayData): { met: boolean; reason?: string } {
	if (data.requirements.roleId) {
		if (!member.roles.cache.has(data.requirements.roleId)) {
			return { met: false, reason: `You need the <@&${data.requirements.roleId}> role to enter.` };
		}
	}

	if (data.requirements.minAccountAgeDays) {
		const accountAgeMs = Date.now() - member.user.createdTimestamp;
		const requiredMs = data.requirements.minAccountAgeDays * 86400 * 1000;
		if (accountAgeMs < requiredMs) {
			const daysLeft = Math.ceil((requiredMs - accountAgeMs) / 86400000);
			return {
				met: false,
				reason: `Your account must be at least ${data.requirements.minAccountAgeDays} days old. (${daysLeft} days remaining)`,
			};
		}
	}

	return { met: true };
}

function pickWinners(data: GiveawayData, count: number): string[] {
	const entryUserIds = data.entries.map((e) => e.userId);
	const unique = [...new Set(entryUserIds)];

	if (unique.length === 0) return [];

	const shuffled = [...unique].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, Math.min(count, shuffled.length));
}

async function drawAndAnnounce(client: Client, data: GiveawayData): Promise<void> {
	const winners = pickWinners(data, data.winnerCount);

	updateGiveaway(data.messageId, { ended: true, winners });
	endGiveaway(data.messageId);

	try {
		const guild = client.guilds.cache.get(data.guildId);
		if (!guild) return;

		const channel = guild.channels.cache.get(data.channelId) as TextChannel | undefined;
		if (!channel) return;

		const message = await channel.messages.fetch(data.messageId).catch(() => null);

		const endedData = { ...data, ended: true, winners };

		if (message) {
			const endContainer = buildGiveawayEndActionRow(endedData);
			await message
				.edit({
					components: [endContainer],
					flags: MessageFlags.IsComponentsV2,
				})
				.catch(() => {});
		}
	} catch (error) {
		log.error({ err: error, messageId: data.messageId }, "Failed to draw and announce giveaway winners");
	}
}

function scheduleTimer(client: Client, data: GiveawayData): void {
	const remaining = data.endTime - Date.now();
	if (remaining <= 0) {
		drawAndAnnounce(client, data).catch((error) => {
			log.error({ err: error }, "Immediate draw failed");
		});
		return;
	}

	const timer = setTimeout(() => {
		activeTimers.delete(data.messageId);
		const current = getGiveaway(data.messageId);
		if (current && !current.ended) {
			drawAndAnnounce(client, current).catch((error) => {
				log.error({ err: error }, "Timer draw failed");
			});
		}
	}, remaining);

	activeTimers.set(data.messageId, timer);
}

export function registerGiveawayHandlers(client: Client): void {
	for (const data of getActiveGiveaways()) {
		scheduleTimer(client, data);
	}

	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isButton() && !interaction.isChatInputCommand()) return;

		if (interaction.isButton() && interaction.customId.startsWith("av:giveaway_enter:")) {
			await handleGiveawayEnter(interaction);
		}
	});

	client.on("messageReactionAdd", async (reaction, user) => {
		if (user.bot) return;
		if (reaction.partial) {
			try {
				await reaction.fetch();
			} catch {
				return;
			}
		}
		await handleReactionEntry(reaction as MessageReaction, user as User, true);
	});

	client.on("messageReactionRemove", async (reaction, user) => {
		if (user.bot) return;
		if (reaction.partial) {
			try {
				await reaction.fetch();
			} catch {
				return;
			}
		}
		await handleReactionEntry(reaction as MessageReaction, user as User, false);
	});
}

async function handleGiveawayEnter(interaction: ButtonInteraction): Promise<void> {
	try {
		const messageId = interaction.customId.split(":")[2];
		const data = getGiveaway(messageId);

		if (!data || data.ended) {
			return void interaction.reply({ content: "❌ This giveaway has ended.", ephemeral: true });
		}

		const member = interaction.member as GuildMember;
		const reqCheck = checkRequirements(member, data);
		if (!reqCheck.met) {
			return void interaction.reply({ content: `❌ ${reqCheck.reason}`, ephemeral: true });
		}

		const alreadyEntered = hasEntry(messageId, interaction.user.id);

		if (alreadyEntered) {
			removeEntry(messageId, interaction.user.id);
			const updated = getGiveaway(messageId);
			if (updated) {
				await interaction.update({
					components: [buildGiveawayContainer(updated), buildGiveawayActionRow(updated)],
					flags: MessageFlags.IsComponentsV2,
				});
			}
			await interaction.followUp({ content: "✅ You have been removed from the giveaway.", ephemeral: true });
		} else {
			addEntry(messageId, interaction.user.id, interaction.user.username);
			const updated = getGiveaway(messageId);
			if (updated) {
				await interaction.update({
					components: [buildGiveawayContainer(updated), buildGiveawayActionRow(updated)],
					flags: MessageFlags.IsComponentsV2,
				});
			}
			await interaction.followUp({ content: "🎉 You have entered the giveaway! Good luck!", ephemeral: true });
		}
	} catch (error) {
		log.error({ err: error, userId: interaction.user.id }, "Giveaway enter failed");
		try {
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: "❌ Failed to process entry.", ephemeral: true });
			}
		} catch {}
	}
}

async function handleReactionEntry(reaction: MessageReaction, user: User, added: boolean): Promise<void> {
	try {
		const emojiName = reaction.emoji.name;
		if (emojiName !== CONFIG.giveaway.emoji) return;

		const data = getGiveaway(reaction.message.id);
		if (!data || data.ended) return;

		const guild = reaction.message.guild;
		if (!guild) return;

		const member = await guild.members.fetch(user.id).catch(() => null);
		if (!member) return;

		const reqCheck = checkRequirements(member, data);
		if (!reqCheck.met) return;

		if (added) {
			addEntry(data.messageId, user.id, user.username);
		} else {
			removeEntry(data.messageId, user.id);
		}

		const updated = getGiveaway(data.messageId);
		if (updated) {
			const message = reaction.message;
			if ("edit" in message && typeof message.edit === "function") {
				await message
					.edit({
						components: [buildGiveawayContainer(updated), buildGiveawayActionRow(updated)],
						flags: MessageFlags.IsComponentsV2,
					})
					.catch(() => {});
			}
		}
	} catch (error) {
		log.error({ err: error }, "Reaction entry handling failed");
	}
}

export function startGiveaway(client: Client, data: GiveawayData): void {
	saveGiveaway(data);
	scheduleTimer(client, data);
}

export function forceEndGiveaway(client: Client, messageId: string): GiveawayData | null {
	const data = getGiveaway(messageId);
	if (!data || data.ended) return null;

	const timer = activeTimers.get(messageId);
	if (timer) {
		clearTimeout(timer);
		activeTimers.delete(messageId);
	}

	drawAndAnnounce(client, data).catch((error) => {
		log.error({ err: error }, "Force end draw failed");
	});

	return data;
}

export function rerollGiveaway(client: Client, messageId: string): { data: GiveawayData; winners: string[] } | null {
	const data = getGiveaway(messageId);
	if (!data || !data.ended) return null;

	const winners = pickWinners(data, data.winnerCount);
	updateGiveaway(messageId, { winners });

	try {
		const guild = client.guilds.cache.get(data.guildId);
		if (!guild) return null;

		const channel = guild.channels.cache.get(data.channelId) as TextChannel | undefined;
		if (!channel) return null;

		const announcement = buildWinnerAnnouncement({ ...data, winners }, winners);
		channel.send({
			content: `🔄 **Re-roll!**\n\n${announcement}`,
			allowedMentions: { parse: ["users"] },
		});
	} catch (error) {
		log.error({ err: error }, "Reroll announcement failed");
	}

	return { data, winners };
}

export function stopAllGiveawayTimers(): void {
	for (const [id, timer] of activeTimers) {
		clearTimeout(timer);
	}
	activeTimers.clear();
}
