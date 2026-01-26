import admin from "firebase-admin";

import { config } from "./config.js";

let firebaseAdminConfigured = false;

function isDevEnv() {
	return String(process.env.NODE_ENV || "").toLowerCase() !== "production";
}

function hasFirebaseAdminCreds(serviceAccountJson) {
	if (serviceAccountJson) return true;
	if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return true;
	return false;
}

function base64UrlToString(value) {
	const v = String(value || "")
		.replace(/-/g, "+")
		.replace(/_/g, "/");
	const pad = v.length % 4 === 0 ? "" : "=".repeat(4 - (v.length % 4));
	try {
		return Buffer.from(v + pad, "base64").toString("utf8");
	} catch {
		return "";
	}
}

function decodeJwtPayload(token) {
	const t = String(token || "").trim();
	const parts = t.split(".");
	if (parts.length < 2) return null;
	const json = base64UrlToString(parts[1]);
	if (!json) return null;
	try {
		return JSON.parse(json);
	} catch {
		return null;
	}
}

function normalizeEmail(value) {
	const e = String(value || "")
		.trim()
		.toLowerCase();
	return e && e.includes("@") ? e : null;
}

export function isFirebaseAdminConfigured() {
	return firebaseAdminConfigured;
}

export function isAdminEmail(email, adminEmails) {
	const e = String(email || "")
		.trim()
		.toLowerCase();
	if (!e) return false;
	const list = Array.isArray(adminEmails) ? adminEmails : [];
	return list.includes(e);
}

export function initFirebaseAdmin(serviceAccountJson) {
	// If GOOGLE_APPLICATION_CREDENTIALS is set, firebase-admin will auto-use it.
	if (admin.apps.length > 0) return;
	firebaseAdminConfigured = hasFirebaseAdminCreds(serviceAccountJson);

	if (serviceAccountJson) {
		let creds;
		try {
			creds = JSON.parse(serviceAccountJson);
		} catch {
			throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
		}
		admin.initializeApp({ credential: admin.credential.cert(creds) });
		return;
	}

	admin.initializeApp();
}

export function requireAuth() {
	return async function (req, res, next) {
		try {
			const header = req.headers.authorization || "";
			const match = /^Bearer\s+(.+)$/i.exec(header);
			if (!match) return res.status(401).json({ error: "Missing Authorization Bearer token" });

			const token = String(match[1] || "").trim();
			if (!token) return res.status(401).json({ error: "Missing Authorization Bearer token" });

			const isDev = isDevEnv();
			// Dev fallback: if Firebase Admin isn't configured locally, accept the token but
			// decode the JWT payload without verification to extract uid/email.
			if (!firebaseAdminConfigured && isDev) {
				const payload = decodeJwtPayload(token) || {};
				const email = normalizeEmail(payload.email) || normalizeEmail(req.headers["x-dev-user-email"]);
				const uid = String(payload.user_id || payload.sub || payload.uid || req.headers["x-dev-user-uid"] || "dev-uid");
				req.user = { uid, email: email || null };
				return next();
			}

			const decoded = await admin.auth().verifyIdToken(token);
			if (decoded.email_verified === false) {
				return res.status(403).json({ error: "Email not verified" });
			}
			req.user = { uid: decoded.uid, email: decoded.email || null };
			next();
		} catch (e) {
			const message = String(e?.message || "");
			const code = String(e?.code || e?.errorInfo?.code || "");

			const isDev = isDevEnv();
			// If Firebase Admin isn't configured locally, token verification will fail.
			// In dev, fall back to decoding the JWT payload (unverified) so the app can run.
			if (
				message.toLowerCase().includes("default credentials") ||
				message.toLowerCase().includes("could not load the default credentials") ||
				code.includes("app/invalid-credential") ||
				code.includes("auth/invalid-credential")
			) {
				if (isDev) {
					const header = req.headers.authorization || "";
					const match = /^Bearer\s+(.+)$/i.exec(header);
					const token = match ? String(match[1] || "").trim() : "";
					const payload = decodeJwtPayload(token) || {};
					const email = normalizeEmail(payload.email) || normalizeEmail(req.headers["x-dev-user-email"]);
					const uid = String(payload.user_id || payload.sub || payload.uid || req.headers["x-dev-user-uid"] || "dev-uid");
					req.user = { uid, email: email || null };
					return next();
				}
				return res.status(500).json({
					error: "Firebase Admin credentials not configured",
					hint: "Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON"
				});
			}

			return res.status(401).json({ error: "Invalid or expired token" });
		}
	};
}

export function requireAdmin() {
	return function (req, res, next) {
		const email = String(req.user?.email || "").trim().toLowerCase();
		if (config.adminAllowAll) return next();
		if (isAdminEmail(email, config.adminEmails)) return next();
		return res.status(403).json({ error: "Admin access required" });
	};
}
