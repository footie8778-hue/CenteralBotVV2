import {
	Client,
	ContainerBuilder,
	Events,
	MessageFlags,
	SectionBuilder,
	TextDisplayBuilder,
	ThumbnailBuilder,
} from "discord.js";
import { CONFIG, brandLogoUrl } from "../config";
import { createLogger } from "../utils/logger";

const log = createLogger("spamdetector");

export async function RegisterSpamDetector(client: Client) {
	const cfg = CONFIG.spamdetector;
	if (!cfg.enabled) return;

	client.on(Events.MessageCreate, async (message) => {
		if (message.author.bot) return;
		if (!cfg.channels.includes(message.channelId)) return;

		const member = message.member;
		if (!member || !member.moderatable) {
			log.info("Unable to moderate %s", member?.user.tag);
			return;
		}

		try {
			await member.timeout(cfg.duration);
			await message.delete();
			await member.send(cfg.message);
			log.info("%s has been timed out", member.user.tag);
		} catch (error) {
			log.error({ err: error }, "Spam detector action failed for %s", member.user.tag);
		}
	});

	for (const channelId of cfg.channels) {
		try {
			const spam_channel = await client.channels.fetch(channelId);
			if (!spam_channel || !("send" in spam_channel)) continue;

			const messages = await spam_channel.messages.fetch({ limit: 5 });
			const initialized = messages.some((msg) => msg.author.id === client.user?.id);
			if (initialized) continue;

			const review = CONFIG.roles.mgmtId ? `<@&${CONFIG.roles.mgmtId}>` : "management";
			const notice = new SectionBuilder().addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					[
						"## DO NOT SEND MESSAGES IN THIS CHANNEL",
						"",
						"Anyone who sends a message here will automatically be placed on timeout.",
						"This measure helps prevent spam from compromised accounts.",
						"",
						`If you have been timed out, reach out to ${review} to have it reviewed.`,
					].join("\n")
				)
			);
			const logo = brandLogoUrl();
			if (logo) notice.setThumbnailAccessory(new ThumbnailBuilder().setURL(logo));

			const container = new ContainerBuilder().addSectionComponents(notice);

			spam_channel.send({
				flags: MessageFlags.IsComponentsV2,
				components: [container],
			});
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			log.warn({ channelId, err: err.message }, "Cannot access spam detector channel — check bot permissions");
		}
	}
}
