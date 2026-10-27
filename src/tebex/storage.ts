import { getDb } from "../tickets/db";

export interface VerificationRow {
	transaction_id: string;
	discord_id: string;
	player_name: string | null;
	amount: string | null;
	currency: string | null;
	status: string | null;
	packages: string | null;
	verified_at: number;
}

let ready = false;

function ensure(): void {
	if (ready) return;
	getDb().exec(`
		CREATE TABLE IF NOT EXISTS tebex_verifications (
			transaction_id TEXT PRIMARY KEY,
			discord_id     TEXT NOT NULL,
			player_name    TEXT,
			amount         TEXT,
			currency       TEXT,
			status         TEXT,
			packages       TEXT,
			verified_at    INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_tebex_discord ON tebex_verifications(discord_id);
	`);
	ready = true;
}

export function getVerification(transactionId: string): VerificationRow | undefined {
	ensure();
	return getDb()
		.prepare("SELECT * FROM tebex_verifications WHERE transaction_id = ?")
		.get(transactionId) as VerificationRow | undefined;
}

export function saveVerification(row: VerificationRow): void {
	ensure();
	getDb()
		.prepare(
			`INSERT INTO tebex_verifications (
				transaction_id, discord_id, player_name, amount, currency, status, packages, verified_at
			) VALUES (
				@transaction_id, @discord_id, @player_name, @amount, @currency, @status, @packages, @verified_at
			)
			ON CONFLICT(transaction_id) DO UPDATE SET
				discord_id = excluded.discord_id,
				player_name = excluded.player_name,
				amount = excluded.amount,
				currency = excluded.currency,
				status = excluded.status,
				packages = excluded.packages,
				verified_at = excluded.verified_at`
		)
		.run(row);
}
