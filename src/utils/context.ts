import { AsyncLocalStorage } from "async_hooks";

export interface CommandContext {
	commandName: string;
	userId: string;
}

export const asyncContext = new AsyncLocalStorage<CommandContext | null>();

export function runWithCommand(commandName: string, userId: string, fn: () => Promise<void>): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		asyncContext.run({ commandName, userId }, () => {
			fn().then(resolve).catch(reject);
		});
	});
}

export function getCommandContext(): CommandContext | null {
	return asyncContext.getStore() ?? null;
}
