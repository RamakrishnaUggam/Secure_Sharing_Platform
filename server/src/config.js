import dotenv from "dotenv";

import path from "path";
import { fileURLToPath } from "url";

// Always load server/.env regardless of the process working directory.
try {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
} catch {
	// ignore
}

// Also load a root .env (if present) for convenience.
dotenv.config();


function readEnv(name) {
	const value = process.env[name];
	if (value == null) return null;
	const trimmed = String(value).trim();
	return trimmed.length ? trimmed : null;
}

function isProd() {
	return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function requiredInProd(name) {
	const value = readEnv(name);
	if (!value && isProd()) {
		throw new Error(`Missing required env var in production: ${name}`);
	}
	return value;
}

export const config = {
	port: Number(process.env.PORT || 3001),
	storageDir: readEnv("STORAGE_DIR"),
	adminEmails: String(process.env.ADMIN_EMAILS || "")
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean),
	adminAllowAll: String(process.env.ADMIN_ALLOW_ALL || "").trim() === "1",
	corsOrigins: String(
		process.env.CORS_ORIGIN ||
		"http://localhost:8000,http://127.0.0.1:8000,https://ramakrishnauggam.github.io"
	)
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean),
	corsAllowAll: String(process.env.CORS_ORIGIN || "")
		.split(",")
		.map((s) => s.trim())
		.includes("*"),
	mongoUri: requiredInProd("MONGODB_URI"),
	masterKeyHex: requiredInProd("MASTER_KEY_HEX"),
	firebaseServiceAccountJson: readEnv("FIREBASE_SERVICE_ACCOUNT_JSON"),
	missing: []
};

if (!config.mongoUri) config.missing.push("MONGODB_URI");
if (!config.masterKeyHex) config.missing.push("MASTER_KEY_HEX");
