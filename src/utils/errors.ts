export class BotError extends Error {
	public readonly code: string;
	public readonly userMessage: string;

	constructor(message: string, code: string, userMessage?: string, cause?: Error) {
		super(message, { cause });
		this.name = "BotError";
		this.code = code;
		this.userMessage = userMessage ?? "An unexpected error occurred.";
	}
}

export class CommandError extends BotError {
	constructor(message: string, code: string, userMessage?: string, cause?: Error) {
		super(message, code, userMessage ?? "An unexpected error occurred.", cause);
		this.name = "CommandError";
	}
}

export class ConfigError extends BotError {
	constructor(message: string, code: string, cause?: Error) {
		super(message, code, "A configuration error occurred. Contact an admin.", cause);
		this.name = "ConfigError";
	}
}

export class TicketError extends BotError {
	constructor(message: string, code: string, userMessage?: string, cause?: Error) {
		super(message, code, userMessage ?? "A ticket error occurred.", cause);
		this.name = "TicketError";
	}
}

export class PermissionError extends BotError {
	constructor(message: string, code: string = "MISSING_PERMISSIONS") {
		super(message, code, "You don't have permission to do that.");
		this.name = "PermissionError";
	}
}

export class ValidationError extends BotError {
	constructor(message: string, code: string, userMessage: string) {
		super(message, code, userMessage);
		this.name = "ValidationError";
	}
}

export class ExternalServiceError extends BotError {
	constructor(message: string, code: string, cause?: Error) {
		super(message, code, "A service error occurred. Please try again later.", cause);
		this.name = "ExternalServiceError";
	}
}
