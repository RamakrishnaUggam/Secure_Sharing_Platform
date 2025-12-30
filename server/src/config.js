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
	corsOrigins: String(process.env.CORS_ORIGIN || "http://localhost:8000")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean),
	mongoUri: required("MONGODB_URI"),
	masterKeyHex: required("MASTER_KEY_HEX"),
	firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
};
