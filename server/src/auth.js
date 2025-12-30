import admin from "firebase-admin";

export function initFirebaseAdmin(serviceAccountJson) {
	// If GOOGLE_APPLICATION_CREDENTIALS is set, firebase-admin will auto-use it.
	if (admin.apps.length > 0) return;

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

			const decoded = await admin.auth().verifyIdToken(match[1]);
			if (decoded.email_verified === false) {
				return res.status(403).json({ error: "Email not verified" });
			}
			req.user = { uid: decoded.uid, email: decoded.email || null };
			next();
		} catch (e) {
			const message = String(e?.message || "");
			const code = String(e?.code || e?.errorInfo?.code || "");

			// If Firebase Admin isn't configured locally, token verification will fail.
			// Returning 500 makes this clearer than a misleading 401.
			if (
				message.toLowerCase().includes("default credentials") ||
				message.toLowerCase().includes("could not load the default credentials") ||
				code.includes("app/invalid-credential") ||
				code.includes("auth/invalid-credential")
			) {
				return res.status(500).json({
					error: "Firebase Admin credentials not configured",
					hint: "Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON"
				});
			}

			return res.status(401).json({ error: "Invalid or expired token" });
		}
	};
}
