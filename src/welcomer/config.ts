import { CONFIG } from "../config";

export const welcomeConfig = {
	get welcomeChannelId(): string {
		return CONFIG.welcome.channelId;
	},
	get embedColor(): number {
		return CONFIG.branding.color;
	},
	get links(): { tickets: string; store: string } {
		return {
			tickets: CONFIG.welcome.ticketsUrl,
			store: CONFIG.tebex.storeUrl,
		};
	},
};
