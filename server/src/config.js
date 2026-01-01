import dotenv from "dotenv";

dotenv.config();

function required(name) {
	const value = process.env[name];
	if (!value || String(value).trim().length === 0) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

export const config = {
	port: Number(process.env.PORT || 3001),
	storageDir: process.env.STORAGE_DIR ? String(process.env.STORAGE_DIR).trim() : null,
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
	mongoUri: required("MONGODB_URI"),
	masterKeyHex: required("MASTER_KEY_HEX"),
	firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
};
