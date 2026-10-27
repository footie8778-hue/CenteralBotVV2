import { MessageFlags } from "discord.js";
import { BotError } from "./errors";
import { createLogger } from "./logger";

const log = createLogger("errorHandler");

type ReplyableInteraction = {
	replied: boolean;
	deferred: boolean;
	reply: (...args: any[]) => Promise<any>;
	editReply: (...args: any[]) => Promise<any>;
	user: { id: string };
};

function isRepliedOrDeferred(interaction: ReplyableInteraction): boolean {
	return interaction.replied || interaction.deferred;
}

export async function handleCommandError(
	interaction: ReplyableInteraction,
	error: unknown,
	context?: string
): Promise<void> {
	const err = error instanceof Error ? error : new Error(String(error));
	const commandName = context ?? interaction.constructor.name;

	if (err instanceof BotError) {
		log.error({ err, command: commandName, userId: interaction.user.id }, err.message);
	} else {
		log.error(
			{
				err,
				command: commandName,
				userId: interaction.user.id,
				stack: err.stack,
				name: err.name,
				message: err.message,
			},
			"Unhandled error in command"
		);
	}

	if (isRepliedOrDeferred(interaction)) {
		try {
			await interaction.editReply({
				content: `❌ ${err instanceof BotError ? err.userMessage : "An unexpected error occurred."}`,
			});
		} catch {
			log.debug({ command: commandName }, "Failed to edit reply after error");
		}
		return;
	}

	try {
		await interaction.reply({
			content: `❌ ${err instanceof BotError ? err.userMessage : "An unexpected error occurred."}`,
			flags: MessageFlags.Ephemeral,
		});
	} catch {
		log.debug({ command: commandName }, "Failed to send error reply");
	}
}

export async function safeAsync(fn: () => Promise<void>, context?: string): Promise<void> {
	try {
		await fn();
	} catch (error) {
		log.debug({ err: error, context }, "Suppressed async error");
	}
}
