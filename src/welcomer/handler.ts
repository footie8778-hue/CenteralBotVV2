import {
	Client,
	GuildMember,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	TextChannel,
} from "discord.js";
import { welcomeConfig } from "./config";
import { CONFIG } from "../config";
import { createLogger } from "../utils/logger";

const log = createLogger("welcomer");

async function syncBoosterRole(member: GuildMember): Promise<void> {
	const roleId = CONFIG.roles.boosterId;
	if (!roleId || member.user.bot) return;

	const role = member.guild.roles.cache.get(roleId);
	if (!role) return;

	const boosting = Boolean(member.premiumSince);
	const hasRole = member.roles.cache.has(roleId);
	if (boosting && !hasRole) {
		await member.roles.add(role).catch((err) => log.warn({ err, userId: member.id }, "Failed to add booster role"));
	} else if (!boosting && hasRole) {
		await member.roles.remove(role).catch((err) => log.warn({ err, userId: member.id }, "Failed to remove booster role"));
	}
}

export function registerWelcomeHandler(client: Client) {
	client.on("guildMemberAdd", async (member: GuildMember) => {
		try {
			const roleId = CONFIG.welcome.roleId;
			if (roleId) {
				const role = member.guild.roles.cache.get(roleId);
				if (role) {
					await member.roles.add(role).catch((err) => log.warn({ err, userId: member.id }, "Failed to assign member role"));
				}
			}

			await syncBoosterRole(member);

			const channel = member.guild.channels.cache.get(welcomeConfig.welcomeChannelId) as TextChannel | undefined;
			if (!channel) return;

			const embed = new EmbedBuilder()
				.setColor(welcomeConfig.embedColor)
				.setTitle(`Welcome to ${CONFIG.branding.serverName}, ${member.user.username}`)
				.setDescription(
					[
						`You are member **#${member.guild.memberCount}**.`,
						"",
						`Welcome to **${CONFIG.branding.serverName}** — our FiveM community Discord.`,
						"Read the rules, then hop in when the server is online.",
						"Need help? Open a ticket in the support channel.",
						"Check live player count anytime with `/status`.",
					].join("\n")
				)
				.setThumbnail(member.user.displayAvatarURL({ size: 256 }))
				.setFooter({ text: CONFIG.branding.footer })
				.setTimestamp();

			const row = new ActionRowBuilder<ButtonBuilder>();
			if (/^https?:\/\//i.test(welcomeConfig.links.store)) {
				row.addComponents(
					new ButtonBuilder().setLabel("Store").setURL(welcomeConfig.links.store).setStyle(ButtonStyle.Link)
				);
			}
			if (CONFIG.welcome.ticketChannelId) {
				row.addComponents(
					new ButtonBuilder()
						.setLabel("Tickets")
						.setURL(`https://discord.com/channels/${member.guild.id}/${CONFIG.welcome.ticketChannelId}`)
						.setStyle(ButtonStyle.Link)
				);
			}
			if (CONFIG.reviews.channelId) {
				row.addComponents(
					new ButtonBuilder()
						.setLabel("Reviews")
						.setURL(`https://discord.com/channels/${member.guild.id}/${CONFIG.reviews.channelId}`)
						.setStyle(ButtonStyle.Link)
				);
			}

			await channel.send({
				content: `<@${member.id}>`,
				embeds: [embed],
				components: row.components.length ? [row] : [],
			});
		} catch (error) {
			log.error({ err: error, userId: member.id }, "Failed to send welcome message");
		}
	});

	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		try {
			if (oldMember.partial) return;
			if (Boolean(oldMember.premiumSince) === Boolean(newMember.premiumSince)) return;
			await syncBoosterRole(newMember);
		} catch (error) {
			log.error({ err: error, userId: newMember.id }, "Failed to update booster role");
		}
	});
}
