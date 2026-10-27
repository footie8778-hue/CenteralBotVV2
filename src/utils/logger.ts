import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

type LogForwarder = (level: number, module: string, msg: string) => void;
let logForwarder: LogForwarder | null = null;

export function setLogForwarder(forwarder: LogForwarder) {
	logForwarder = forwarder;
}

function extractMsg(args: any[]): string {
	if (args.length === 0) return "";
	if (typeof args[0] === "string") return args[0];
	if (typeof args[0] === "object" && args.length > 1 && typeof args[1] === "string") return args[1];
	return String(args[0] ?? "");
}

function buildForwardContext(args: any[]): string {
	if (args.length === 0 || typeof args[0] !== "object" || args[0] === null) return "";

	const ctx = args[0];
	const parts: string[] = [];

	if (ctx.command) parts.push(`Command: ${ctx.command}`);
	if (ctx.userId) parts.push(`User: <@${ctx.userId}>`);
	if (ctx.context) parts.push(`Context: ${ctx.context}`);
	if (ctx.err instanceof Error) {
		parts.push(`Error: ${ctx.err.message}`);
		if (ctx.err.stack) {
			const stackLines = ctx.err.stack
				.split("\n")
				.slice(1, 4)
				.map((l: string) => l.trim());
			if (stackLines.length > 0) parts.push(`Stack: ${stackLines.join(" → ")}`);
		}
	} else if (typeof ctx.err === "string") {
		parts.push(`Error: ${ctx.err}`);
	}

	return parts.length > 0 ? `\n${parts.join("\n")}` : "";
}

export const logger = pino(
	{
		level,
		timestamp: pino.stdTimeFunctions.isoTime,
		hooks: {
			logMethod(args, method, level) {
				if (logForwarder) {
					const bindings = (this as any).bindings?.() ?? {};
					const msg = extractMsg(args);
					const context = buildForwardContext(args);
					logForwarder(level, bindings.module ?? "unknown", msg + context);
				}
				method.apply(this, args as any);
			},
		},
	},
	pino.transport({
		target: "pino-pretty",
		options: {
			colorize: true,
			translateTime: "SYS:HH:mm:ss",
			ignore: "pid,hostname",
			messageFormat: "[{module}] {msg}",
			errorLikeObjectKeys: ["err", "error"],
		},
	})
);

export function createLogger(module: string): pino.Logger {
	return logger.child({ module });
}
