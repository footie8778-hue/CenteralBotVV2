import { Client, TextChannel } from "discord.js";
import { createLogger } from "../utils/logger";
import { listStatusPanels } from "./storage";
import { refreshStatusEmbed } from "./commands";
import { CONFIG } from "../config";

const log = createLogger("fivem-updater");

export function registerStatusUpdater(client: Client): void {
	const intervalMs = Math.max(60, CONFIG.fivem.refreshSeconds) * 1000;

	client.once("ready", () => {
		const tick = async () => {
			for (const panel of listStatusPanels()) {
				try {
					const guild = client.guilds.cache.get(panel.guildId);
					const channel = guild?.channels.cache.get(panel.channelId) as TextChannel | undefined;
					if (!channel?.isTextBased()) continue;
					await refreshStatusEmbed(channel, panel.messageId);
				} catch (err) {
					log.warn({ err, guildId: panel.guildId }, "Status refresh failed");
				}
			}
		};

		void tick();
		setInterval(() => void tick(), intervalMs);
	});
}
