import {
	ChatInputCommandInteraction,
	EmbedBuilder,
	MessageFlags,
	TextChannel,
} from "discord.js";
import { CONFIG } from "../config";
import { handleCommandError } from "../utils/errorHandler";
import { hasStaffRole } from "../utils/roles";
import { createLogger } from "../utils/logger";
import { TebexError, fetchTebexPayment, isCompletePayment, packageNames, type TebexPayment } from "./api";
import { getVerification, saveVerification } from "./storage";

const log = createLogger("tebex");

function cleanTransactionId(raw: string): string | null {
	const id = raw.trim();
	if (!/^[A-Za-z0-9-]{4,64}$/.test(id)) return null;
	return id;
}

function paymentEmbed(payment: TebexPayment, transactionId: string, title: string): EmbedBuilder {
	const currency = payment.currency?.iso_4217 ?? "";
	const amount = payment.amount ? `${payment.amount} ${currency}`.trim() : "Unknown";
	const packages = packageNames(payment);

	return new EmbedBuilder()
		.setColor(isCompletePayment(payment) ? CONFIG.branding.color : 0xef4444)
		.setTitle(title)
		.addFields(
			{ name: "Transaction", value: transactionId, inline: true },
			{ name: "Status", value: payment.status || "Unknown", inline: true },
			{ name: "Amount", value: amount, inline: true },
			{ name: "Packages", value: packages.length ? packages.join("\n").slice(0, 1024) : "None listed", inline: false },
			{ name: "Buyer", value: payment.player?.name || "Unknown", inline: true },
			{ name: "Gateway", value: payment.gateway?.name || "Unknown", inline: true }
		)
		.setFooter({ text: CONFIG.branding.footer })
		.setTimestamp(payment.date ? new Date(payment.date) : new Date());
}

async function grantCustomerRole(interaction: ChatInputCommandInteraction): Promise<string> {
	const roleId = CONFIG.roles.customerId;
	if (!roleId) return "Customer role is not set yet. Ask an admin to run `/config roles`.";

	const member = await interaction.guild?.members.fetch(interaction.user.id);
	if (!member) return "Could not find you in this server.";
	if (member.roles.cache.has(roleId)) return "You already have the customer role.";

	const role = interaction.guild?.roles.cache.get(roleId);
	if (!role) return "The customer role no longer exists. Ask an admin to set it again.";

	await member.roles.add(role);
	return `Customer role added: ${role}.`;
}

async function logSale(interaction: ChatInputCommandInteraction, payment: TebexPayment, transactionId: string): Promise<void> {
	const channelId = CONFIG.tebex.salesChannelId;
	if (!channelId || !interaction.guild) return;

	const channel = interaction.guild.channels.cache.get(channelId);
	if (!channel || !channel.isTextBased()) return;

	const embed = paymentEmbed(payment, transactionId, "Purchase verified").addFields({
		name: "Discord",
		value: `${interaction.user} (${interaction.user.tag})`,
		inline: false,
	});

	await (channel as TextChannel).send({ embeds: [embed] }).catch((err) => {
		log.warn({ err }, "Failed to post sale log");
	});
}

export async function handleVerify(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		const transactionId = cleanTransactionId(interaction.options.getString("transaction", true));
		if (!transactionId) {
			await interaction.reply({
				content: "That does not look like a Tebex transaction ID. It should look like `tbx-...`.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const existing = getVerification(transactionId);
		if (existing && existing.discord_id !== interaction.user.id) {
			await interaction.editReply("That transaction is already linked to another Discord account.");
			return;
		}

		const payment = await fetchTebexPayment(transactionId);
		if (!isCompletePayment(payment)) {
			await interaction.editReply(
				`That payment is **${payment.status || "not complete"}**. The customer role is only given for completed payments.`
			);
			return;
		}

		saveVerification({
			transaction_id: transactionId,
			discord_id: interaction.user.id,
			player_name: payment.player?.name ?? null,
			amount: payment.amount ?? null,
			currency: payment.currency?.iso_4217 ?? null,
			status: payment.status ?? null,
			packages: packageNames(payment).join(", ") || null,
			verified_at: Date.now(),
		});

		const roleNote = await grantCustomerRole(interaction);
		if (!existing) await logSale(interaction, payment, transactionId);

		const packages = packageNames(payment);
		await interaction.editReply(
			[
				`Purchase **${transactionId}** is verified.`,
				packages.length ? `Packages: ${packages.join(", ")}` : "",
				roleNote,
			]
				.filter(Boolean)
				.join("\n")
		);
	} catch (error) {
		if (error instanceof TebexError) {
			if (interaction.deferred || interaction.replied) await interaction.editReply(error.message);
			else await interaction.reply({ content: error.message, flags: MessageFlags.Ephemeral });
			return;
		}
		await handleCommandError(interaction, error, "handleVerify");
	}
}

export async function handleOrderLookup(interaction: ChatInputCommandInteraction): Promise<void> {
	try {
		const member = await interaction.guild?.members.fetch(interaction.user.id);
		if (!hasStaffRole(member)) {
			await interaction.reply({
				content: "Only staff can look up orders.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const transactionId = cleanTransactionId(interaction.options.getString("transaction", true));
		if (!transactionId) {
			await interaction.reply({
				content: "That does not look like a Tebex transaction ID.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const payment = await fetchTebexPayment(transactionId);
		const linked = getVerification(transactionId);
		const embed = paymentEmbed(payment, transactionId, "Tebex order");
		embed.addFields({
			name: "Linked Discord",
			value: linked ? `<@${linked.discord_id}>` : "Not verified in Discord yet",
			inline: false,
		});
		await interaction.editReply({ embeds: [embed] });
	} catch (error) {
		if (error instanceof TebexError) {
			if (interaction.deferred || interaction.replied) await interaction.editReply(error.message);
			else await interaction.reply({ content: error.message, flags: MessageFlags.Ephemeral });
			return;
		}
		await handleCommandError(interaction, error, "handleOrderLookup");
	}
}
