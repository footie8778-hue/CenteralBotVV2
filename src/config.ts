import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { createLogger } from "./utils/logger";
import { dataPath } from "./utils/dataDir";

dotenv.config();

const log = createLogger("config");

const CONFIG_FILE = dataPath("config.json");

export interface BrandingConfig {
	serverName: string;
	logo: string;
	color: number;
	footer: string;
	ticketPrefix: string;
}

export interface TranscriptConfig {
	channelId: string;
	saveDir: string;
	formatHtml: boolean;
	formatTxt: boolean;
}

export interface CategoryConfig {
	id: string;
	description: string;
	questions: string[];
	emoji: string;
	mgmtOnly: boolean;
	mentionRole: string;
}

export interface RolesConfig {
	staffId: string;
	mgmtId: string;
	botdevId: string;
	customerId: string;
	boosterId: string;
	verifiedSupporterId: string;
	verifierRoleId: string;
}

export interface ModlogConfig {
	channelId: string;
}

export interface PanelConfig {
	title: string;
	description: string;
	footerText: string;
}

export interface GiveawayConfig {
	channelId: string;
	defaultDurationMinutes: number;
	emoji: string;
	manageRoleId: string;
}

export interface LogsConfig {
	channelId: string;
	enabled: boolean;
}

export interface SpamDetectorConfig {
	enabled: boolean;
	channels: string[];
	duration: number;
	message: string;
}

export interface TebexConfig {
	secret: string;
	storeUrl: string;
	salesChannelId: string;
}

export interface WelcomeSettings {
	channelId: string;
	roleId: string;
	ticketChannelId: string;
	ticketsUrl: string;
}

export interface ReviewConfig {
	channelId: string;
}

export interface FivemConfig {
	cfxServerId: string;
	connect: string;
	serverHost: string;
	serverPort: string;
	txAdminUrl: string;
	txAdminToken: string;
	refreshSeconds: number;
}

export interface Config {
	token: string;
	prefix: string;
	branding: BrandingConfig;
	transcript: TranscriptConfig;
	modlog: ModlogConfig;
	roles: RolesConfig;
	panel: PanelConfig;
	categories: Record<string, CategoryConfig>;
	giveaway: GiveawayConfig;
	logs: LogsConfig;
	spamdetector: SpamDetectorConfig;
	tebex: TebexConfig;
	welcome: WelcomeSettings;
	reviews: ReviewConfig;
	fivem: FivemConfig;
}

function loadConfigFromFile(): Partial<Config> {
	try {
		if (fs.existsSync(CONFIG_FILE)) {
			const data = fs.readFileSync(CONFIG_FILE, "utf-8");
			return JSON.parse(data);
		}
	} catch (error) {
		log.error({ err: error }, "Failed to load config from file");
	}
	return {};
}

function saveConfigToFile(config: Partial<Config>): void {
	try {
		const dir = path.dirname(CONFIG_FILE);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
	} catch (error) {
		log.error({ err: error }, "Failed to save config to file");
	}
}

export function saveConfig(): void {
	saveConfigToFile({
		branding: CONFIG.branding,
		transcript: CONFIG.transcript,
		modlog: CONFIG.modlog,
		roles: CONFIG.roles,
		panel: CONFIG.panel,
		categories: CONFIG.categories,
		giveaway: CONFIG.giveaway,
		logs: CONFIG.logs,
		spamdetector: CONFIG.spamdetector,
		tebex: {
			secret: "",
			storeUrl: CONFIG.tebex.storeUrl,
			salesChannelId: CONFIG.tebex.salesChannelId,
		},
		welcome: CONFIG.welcome,
		reviews: CONFIG.reviews,
	});
}

function envOr(name: string, fallback = ""): string {
	return process.env[name]?.trim() || fallback;
}

function withoutLegacyBrand(value: string | undefined, fallback: string): string {
	if (!value || value.includes("The Avenue") || value === "Script Store") return fallback;
	return value;
}

function isScriptStoreCategories(categories: Record<string, CategoryConfig> | undefined): boolean {
	if (!categories) return false;
	return "purchase" in categories || "commission" in categories || "install" in categories;
}

function isCrCategories(categories: Record<string, CategoryConfig> | undefined): boolean {
	if (!categories) return false;
	return "general_support" in categories || "player_report" in categories;
}

const fileConfig = loadConfigFromFile();

const serverName = withoutLegacyBrand(fileConfig.branding?.serverName, envOr("BRAND_NAME", "Central Roleplay"));

const BRANDING: BrandingConfig = {
	serverName,
	logo: withoutLegacyBrand(fileConfig.branding?.logo, envOr("LOGO_URL")),
	color: fileConfig.branding?.color ?? 0x2563eb,
	footer: withoutLegacyBrand(fileConfig.branding?.footer, `${serverName} • Discord`),
	ticketPrefix:
		!fileConfig.branding?.ticketPrefix || fileConfig.branding.ticketPrefix === "TBX"
			? envOr("TICKET_PREFIX", "CR")
			: fileConfig.branding.ticketPrefix,
};

const TRANSCRIPT: TranscriptConfig = {
	channelId: fileConfig.transcript?.channelId ?? envOr("TRANSCRIPT_CHANNEL_ID"),
	saveDir: fileConfig.transcript?.saveDir ?? "transcripts",
	formatHtml: fileConfig.transcript?.formatHtml ?? true,
	formatTxt: fileConfig.transcript?.formatTxt ?? true,
};

const MODLOG: ModlogConfig = {
	channelId: fileConfig.modlog?.channelId ?? envOr("MODLOG_CHANNEL_ID"),
};

const ROLES: RolesConfig = {
	staffId: envOr("STAFF_ROLE_ID", "1561886900426506331"),
	mgmtId: envOr("MGMT_ROLE_ID", "1561886384313213059"),
	botdevId: envOr("BOTDEV_ROLE_ID"),
	verifiedSupporterId: "",
	verifierRoleId: "",
	...fileConfig.roles,
	customerId: fileConfig.roles?.customerId || envOr("CUSTOMER_ROLE_ID"),
	boosterId: fileConfig.roles?.boosterId || envOr("BOOSTER_ROLE_ID"),
};

const PANEL: PanelConfig = {
	title: "Central Roleplay — Support",
	description: [
		`Welcome to **${serverName}**.`,
		"Open a ticket below and our team will assist you.",
		"",
		"**Before you open a ticket**",
		"• Do **not** ping staff — tickets are handled in order.",
		"• One ticket per issue.",
		"• For player reports, include IDs, clips, and what happened.",
		"• For donations, include your Tebex transaction ID if you have one.",
		"",
		"**Categories**",
		"💬 **General Support** — rules, gameplay, and general help.",
		"🚨 **Player Report** — report a player breaking server rules.",
		"💎 **Donation Enquiry** — Tebex, packages, and billing.",
		"👔 **Speak with Management** — escalations (management only).",
	].join("\n"),
	footerText: `${serverName} • FiveM`,
};

const CR_CATEGORIES: Record<string, CategoryConfig> = {
	general_support: {
		id: envOr("CATEGORY_GENERAL_SUPPORT", "1564591993378574426"),
		mentionRole: envOr("STAFF_ROLE_ID", "1561886900426506331"),
		description: "General Support - Rules, gameplay, and general help.",
		questions: ["What do you need help with?", "Any extra details we should know?"],
		emoji: "💬",
		mgmtOnly: false,
	},
	player_report: {
		id: envOr("CATEGORY_PLAYER_REPORT", "1564592012915638382"),
		mentionRole: envOr("STAFF_ROLE_ID", "1561886900426506331"),
		description: "Player Report - Report rule breaks (include proof if possible).",
		questions: [
			"Who are you reporting? (name / ID)",
			"What rule was broken?",
			"Do you have a clip or screenshot? (link or describe)",
		],
		emoji: "🚨",
		mgmtOnly: false,
	},
	donation: {
		id: envOr("CATEGORY_DONATION", "1564592036428914829"),
		mentionRole: envOr("STAFF_ROLE_ID", "1561886900426506331"),
		description: "Donation Enquiry - Tebex purchases, packages, and billing.",
		questions: ["What is your Tebex transaction ID (if any)?", "What do you need help with?"],
		emoji: "💎",
		mgmtOnly: false,
	},
	management: {
		id: envOr("CATEGORY_MANAGEMENT", "1564592059413823581"),
		mentionRole: envOr("MGMT_ROLE_ID", "1561886384313213059"),
		description: "Speak with Management - Escalations and senior staff only.",
		questions: ["What is this regarding?", "Why does this need management?"],
		emoji: "👔",
		mgmtOnly: true,
	},
};

const STORE_CATEGORIES: Record<string, CategoryConfig> = {
	general: {
		id: "",
		mentionRole: "",
		description: "General - Questions about our scripts before you buy.",
		questions: ["Which script are you asking about?", "What do you need to know?"],
		emoji: "💬",
		mgmtOnly: false,
	},
	purchase: {
		id: "",
		mentionRole: "",
		description: "Purchase - Tebex orders, payments, or missing packages.",
		questions: [
			"What is your Tebex transaction ID?",
			"Which package did you buy?",
			"What went wrong with the order?",
		],
		emoji: "🛒",
		mgmtOnly: false,
	},
	support: {
		id: "",
		mentionRole: "",
		description: "Script Support - Bugs, errors, or a script that is not working.",
		questions: ["Which script is this about?", "What is going wrong?", "What have you already tried?"],
		emoji: "🛠️",
		mgmtOnly: false,
	},
	install: {
		id: "",
		mentionRole: "",
		description: "Installation - Help installing or configuring a script you own.",
		questions: [
			"Which script are you installing?",
			"Which framework are you using? (ESX, QBCore, Qbox, or standalone)",
			"Where are you stuck?",
		],
		emoji: "📦",
		mgmtOnly: false,
	},
	commission: {
		id: "",
		mentionRole: "",
		description: "Commission - Custom script or feature requests.",
		questions: ["What do you want built?", "Which framework should it support?", "What is your budget and timeline?"],
		emoji: "🧾",
		mgmtOnly: true,
	},
};

const CATEGORIES: Record<string, CategoryConfig> = isCrCategories(fileConfig.categories)
	? (fileConfig.categories as Record<string, CategoryConfig>)
	: isScriptStoreCategories(fileConfig.categories)
		? CR_CATEGORIES
		: CR_CATEGORIES;

const GIVEAWAY: GiveawayConfig = fileConfig.giveaway ?? {
	channelId: envOr("GIVEAWAY_CHANNEL_ID"),
	defaultDurationMinutes: 60,
	emoji: "🎉",
	manageRoleId: envOr("MGMT_ROLE_ID"),
};

const LOGS: LogsConfig = fileConfig.logs ?? {
	channelId: envOr("LOG_CHANNEL_ID"),
	enabled: true,
};

const spamFallback = `You have been timed out because you sent a message in a restricted channel. - ${serverName} Management`;

const SPAMDETECTOR: SpamDetectorConfig = {
	enabled: fileConfig.spamdetector?.enabled ?? false,
	channels: fileConfig.spamdetector?.channels ?? [],
	duration: fileConfig.spamdetector?.duration ?? 28 * 24 * 60 * 60 * 1000,
	message: withoutLegacyBrand(fileConfig.spamdetector?.message, spamFallback),
};

const TEBEX: TebexConfig = {
	secret: envOr("TEBEX_SECRET"),
	storeUrl: fileConfig.tebex?.storeUrl || envOr("TEBEX_STORE_URL"),
	salesChannelId: fileConfig.tebex?.salesChannelId || envOr("SALES_CHANNEL_ID"),
};

const WELCOME: WelcomeSettings = {
	channelId: withoutLegacyBrand(fileConfig.welcome?.channelId, envOr("WELCOME_CHANNEL_ID", "1561787835172782111")),
	roleId: fileConfig.welcome?.roleId || envOr("WELCOME_ROLE_ID", "1561991548500189245"),
	ticketChannelId: fileConfig.welcome?.ticketChannelId || envOr("TICKET_CHANNEL_ID", "1561788333036806316"),
	ticketsUrl: withoutLegacyBrand(fileConfig.welcome?.ticketsUrl, envOr("TICKETS_URL")),
};

const FIVEM: FivemConfig = {
	cfxServerId: envOr("CFX_SERVER_ID"),
	connect: envOr("FIVEM_CONNECT"),
	serverHost: envOr("FIVEM_SERVER_HOST"),
	serverPort: envOr("FIVEM_SERVER_PORT", "30120"),
	txAdminUrl: envOr("TXADMIN_URL"),
	txAdminToken: envOr("TXADMIN_TOKEN"),
	refreshSeconds: Number(envOr("STATUS_REFRESH_SECONDS", "120")) || 120,
};

const REVIEWS: ReviewConfig = {
	channelId: fileConfig.reviews?.channelId || envOr("REVIEW_CHANNEL_ID", "1535334531358265384"),
};

export const CONFIG: Config = {
	token: process.env.DISCORD_TOKEN ?? "",
	prefix: process.env.BOT_PREFIX ?? "!",
	branding: BRANDING,
	transcript: TRANSCRIPT,
	modlog: MODLOG,
	roles: ROLES,
	panel: fileConfig.panel && !fileConfig.panel.description?.includes("The Avenue") ? fileConfig.panel : PANEL,
	categories: CATEGORIES,
	giveaway: GIVEAWAY,
	logs: LOGS,
	spamdetector: SPAMDETECTOR,
	tebex: TEBEX,
	welcome: WELCOME,
	reviews: REVIEWS,
	fivem: FIVEM,
};

export function brandLogoUrl(): string | null {
	const logo = CONFIG.branding.logo?.trim() ?? "";
	return /^https?:\/\//i.test(logo) ? logo : null;
}
