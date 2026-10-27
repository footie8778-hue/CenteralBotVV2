import { CONFIG } from "../config";

const TEBEX_API = "https://plugin.tebex.io";

export class TebexError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TebexError";
	}
}

export interface TebexPackage {
	id?: number;
	name?: string;
}

export interface TebexPayment {
	id: number | string;
	amount?: string;
	status?: string;
	date?: string;
	currency?: { iso_4217?: string; symbol?: string };
	gateway?: { name?: string };
	player?: { name?: string; uuid?: string };
	packages?: TebexPackage[];
	email?: string;
}

export function isCompletePayment(payment: TebexPayment): boolean {
	return (payment.status ?? "").toLowerCase() === "complete";
}

export function packageNames(payment: TebexPayment): string[] {
	return (payment.packages ?? []).map((pkg) => pkg.name).filter((name): name is string => Boolean(name));
}

export async function fetchTebexPayment(transactionId: string): Promise<TebexPayment> {
	const secret = CONFIG.tebex.secret;
	if (!secret) {
		throw new TebexError("Tebex is not configured. Set TEBEX_SECRET on the bot.");
	}

	const response = await fetch(`${TEBEX_API}/payments/${encodeURIComponent(transactionId)}`, {
		headers: { "X-Tebex-Secret": secret },
	});

	if (response.status === 404) {
		throw new TebexError("No Tebex payment was found for that transaction ID.");
	}
	if (response.status === 401 || response.status === 403) {
		throw new TebexError("Tebex rejected the secret key. Check TEBEX_SECRET.");
	}
	if (!response.ok) {
		throw new TebexError(`Tebex returned an error (${response.status}).`);
	}

	const body = (await response.json()) as TebexPayment;
	if (!body || body.id == null) {
		throw new TebexError("Tebex returned an unexpected payment response.");
	}
	return body;
}
