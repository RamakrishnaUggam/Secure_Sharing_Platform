import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import admin from "firebase-admin";

import { config } from "./config.js";
import { connectDb } from "./db.js";
import { initFirebaseAdmin, requireAuth } from "./auth.js";
import { filesRouter } from "./routes.files.js";
import { FileRecord } from "./models/FileRecord.js";
import { ShareRecord } from "./models/ShareRecord.js";

const app = express();

app.use(express.json({ limit: "1mb" }));

app.use(
	cors({
		origin(origin, callback) {
			const isDev = String(process.env.NODE_ENV || "").toLowerCase() !== "production";
			const githubPagesOrigin = "https://ramakrishnauggam.github.io";
			function isLocalDevOrigin(value) {
				if (!value) return true;
				if (value === "null") return true;
				// Allow typical local dev hosts and private LAN IPs (handy for mobile testing)
				return (
					/^https?:\/\/localhost(?::\d+)?$/i.test(value) ||
					/^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(value) ||
					/^https?:\/\/192\.168\.\d+\.\d+(?::\d+)?$/i.test(value) ||
					/^https?:\/\/10\.\d+\.\d+\.\d+(?::\d+)?$/i.test(value) ||
					/^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(?::\d+)?$/i.test(value)
				);
			}

			// Allow non-browser tools (curl, Postman) which may not send an Origin header.
			if (!origin) return callback(null, true);
			if (origin === githubPagesOrigin) return callback(null, true);
			if (isDev && isLocalDevOrigin(origin)) return callback(null, true);
			if (config.corsAllowAll) return callback(null, true);
			if (config.corsOrigins.includes(origin)) return callback(null, true);
			return callback(new Error(`CORS blocked for origin: ${origin}`));
		},
		credentials: false,
		exposedHeaders: [
			"X-Enc-Mode",
			"X-Client-Iv-B64",
			"X-Original-Name",
			"X-Original-Mime",
			"X-Stored-Sha256",
			"X-Original-Sha256",
			"Content-Disposition"
		]
	})
);

app.get("/", (_req, res) => {
	res.json({
		ok: true,
		service: "secure-sharing-backend",
		health: "/health",
		me: "/api/me",
		files: "/api/files"
	});
});

app.get("/health", (_req, res) => res.json({ ok: true }));

initFirebaseAdmin(config.firebaseServiceAccountJson);
await connectDb(config.mongoUri);

app.get("/api/me", requireAuth(), (req, res) => {
	res.json({ uid: req.user.uid, email: req.user.email });
});

function normalizeEmail(value) {
	return String(value || "")
		.trim()
		.toLowerCase();
}

function storageDir() {
	if (config.storageDir) return path.resolve(String(config.storageDir));
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	return path.resolve(__dirname, "..", "storage");
}

function resolveStoragePath(record) {
	if (!record) return null;
	if (record.storageKey) {
		return path.join(storageDir(), String(record.storageKey));
	}
	const direct = String(record.storagePath || "");
	if (direct && fs.existsSync(direct)) return direct;
	if (direct) return path.join(storageDir(), path.basename(direct));
	return null;
}

// Delete account: removes user files, shares, stored file bytes, and Firebase Auth user.
app.delete("/api/account", requireAuth(), async (req, res) => {
	const uid = String(req.user?.uid || "");
	if (!uid) return res.status(400).json({ error: "Missing uid" });
	const email = normalizeEmail(req.user?.email);

	const ownedFiles = await FileRecord.find({ ownerUid: uid }).lean();
	const ownedFileIds = ownedFiles.map((f) => f._id);

	// Preserve files that are shared with other users so receivers keep access.
	const sharesOnOwnedFiles = await ShareRecord.find({ ownerUid: uid }).select({ fileId: 1 }).lean();
	const sharedFileIdSet = new Set(sharesOnOwnedFiles.map((s) => String(s.fileId)));
	const filesToDelete = ownedFiles.filter((f) => !sharedFileIdSet.has(String(f._id)));
	const fileIdsToDelete = filesToDelete.map((f) => f._id);

	// 1) Delete stored files from disk for unshared FileRecords
	for (const record of filesToDelete) {
		try {
			const p = resolveStoragePath(record);
			if (p && fs.existsSync(p)) fs.unlinkSync(p);
		} catch {
			// ignore
		}
	}

	// 2) Delete share records that should not survive the account removal.
	// - Received shares (shared *to* this user's email) can be removed.
	// - Shares referencing deleted (unshared) files should be removed.
	if (email) {
		await ShareRecord.deleteMany({ recipientEmail: email });
	}
	if (fileIdsToDelete.length > 0) {
		await ShareRecord.deleteMany({ fileId: { $in: fileIdsToDelete } });
	}

	// 3) Delete unshared file records (keep shared ones so receivers can still download)
	if (fileIdsToDelete.length > 0) {
		await FileRecord.deleteMany({ _id: { $in: fileIdsToDelete } });
	}

	// 4) Delete Firebase Auth user
	try {
		await admin.auth().deleteUser(uid);
	} catch (e) {
		const code = String(e?.code || e?.errorInfo?.code || "");
		if (code !== "auth/user-not-found") throw e;
	}

	res.json({ ok: true });
});

app.use("/api/files", filesRouter());

app.use((err, _req, res, _next) => {
	// eslint-disable-next-line no-console
	console.error(err);
	res.status(500).json({ error: "Server error" });
});

app.listen(config.port, () => {
	// eslint-disable-next-line no-console
	console.log(`API listening on http://localhost:${config.port}`);
});
