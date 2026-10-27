import * as fs from "fs";
import * as path from "path";

export function dataDir(): string {
	const base = process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data");
	if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
	return base;
}

export function dataPath(...segments: string[]): string {
	return path.join(dataDir(), ...segments);
}
