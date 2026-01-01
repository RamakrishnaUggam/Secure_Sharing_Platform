import express from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

import { requireAuth } from "./auth.js";
import { config } from "./config.js";
import { FileRecord } from "./models/FileRecord.js";
import { ShareRecord } from "./models/ShareRecord.js";
import { getMasterKey, wrapDataKey, unwrapDataKey } from "./cryptoBox.js";

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

function storageDir() {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	return path.resolve(__dirname, "..", "storage");
}

function ensureStorageDir() {
	fs.mkdirSync(storageDir(), { recursive: true });
}

function randomId() {
	return crypto.randomUUID();
}

function sha256Hex(buf) {
	return crypto.createHash("sha256").update(buf).digest("hex");
}

function safeReadFileBuffer(filePath) {
	try {
		return fs.readFileSync(filePath);
	} catch {
		return null;
	}
}

function computeIntegrityOk(record) {
	if (!record?.storagePath) return false;
	if (!record?.storedSha256Hex || !/^[a-f0-9]{64}$/i.test(String(record.storedSha256Hex))) return false;
	const buf = safeReadFileBuffer(record.storagePath);
	if (!buf) return false;
	const computed = sha256Hex(buf);
	return computed === String(record.storedSha256Hex).toLowerCase();
}

function computeConfidentialityOk(record) {
	const mode = String(record?.encryptionMode || "server").toLowerCase();
	if (mode === "client") {
		return Boolean(record?.clientIvB64);
	}
	if (mode === "server") {
		return Boolean(record?.wrappedKeyHex && record?.wrapIvHex && record?.wrapTagHex && record?.fileIvHex && record?.fileTagHex);
	}
	return false;
}

function normalizeEmail(value) {
	return String(value || "")
		.trim()
		.toLowerCase();
}

async function canAccessFile({ fileId, uid, email }) {
	if (!fileId) return false;
	if (!uid && !email) return false;

	const record = await FileRecord.findById(fileId).lean();
	if (!record) return { ok: false, record: null };
	if (record.ownerUid === uid) return { ok: true, record };

	const norm = normalizeEmail(email);
	if (!norm) return { ok: false, record };
	const share = await ShareRecord.findOne({ fileId: record._id, recipientEmail: norm }).lean();
	if (!share) return { ok: false, record };
	return { ok: true, record };
}

function encryptFileBufferToDisk({ buffer, outPath }) {
	const dataKey = crypto.randomBytes(32);
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, iv);
	const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
	const tag = cipher.getAuthTag();
	fs.writeFileSync(outPath, ciphertext);
	return { dataKey, fileIvHex: iv.toString("hex"), fileTagHex: tag.toString("hex"), storedSha256Hex: sha256Hex(ciphertext) };
}

export function filesRouter() {
	const router = express.Router();
	const auth = requireAuth();
	const masterKey = getMasterKey(config.masterKeyHex);

	// Receiver deletes a received share (removes from "Received").
	router.delete("/shares/:shareId", auth, async (req, res) => {
		const email = normalizeEmail(req.user.email);
		if (!email) return res.status(400).json({ error: "No email on user" });
		const shareId = String(req.params.shareId || "").trim();
		if (!shareId) return res.status(400).json({ error: "Missing shareId" });

		const share = await ShareRecord.findOne({ _id: shareId, recipientEmail: email });
		if (!share) return res.status(404).json({ error: "Not found" });
		await share.deleteOne();
		res.json({ ok: true });
	});

	router.get("/", auth, async (req, res) => {
		const files = await FileRecord.find({ ownerUid: req.user.uid }).sort({ createdAt: -1 }).lean();
		res.json(
			files.map((f) => ({
				id: String(f._id),
				encryptionMode: f.encryptionMode || "server",
				clientIvB64: f.clientIvB64 || null,
				integrityOk: computeIntegrityOk(f),
				confidentialityOk: computeConfidentialityOk(f),
				originalName: f.originalName,
				mimeType: f.mimeType,
				size: f.size,
				createdAt: f.createdAt,
				updatedAt: f.updatedAt
			}))
		);
	});

	// List files shared with the signed-in user's email.
	router.get("/shared/with-me", auth, async (req, res) => {
		const email = normalizeEmail(req.user.email);
		if (!email) return res.status(400).json({ error: "No email on user" });

		const shares = await ShareRecord.find({ recipientEmail: email }).sort({ createdAt: -1 }).lean();
		if (shares.length === 0) return res.json([]);

		const fileIds = shares.map((s) => s.fileId);
		const files = await FileRecord.find({ _id: { $in: fileIds } }).lean();
		const fileById = new Map(files.map((f) => [String(f._id), f]));

		const out = [];
		for (const share of shares) {
			const f = fileById.get(String(share.fileId));
			if (!f) continue;
			out.push({
				shareId: String(share._id),
				id: String(f._id),
				ownerUid: f.ownerUid,
				senderEmail: share.senderEmail || null,
				encryptionMode: f.encryptionMode || "server",
				clientIvB64: f.clientIvB64 || null,
				integrityOk: computeIntegrityOk(f),
				confidentialityOk: computeConfidentialityOk(f),
				originalName: f.originalName,
				mimeType: f.mimeType,
				size: f.size,
				createdAt: f.createdAt,
				sharedAt: share.createdAt
			});
		}

		res.json(out);
	});

	// List files the signed-in user has shared with others.
	router.get("/shared/by-me", auth, async (req, res) => {
		const shares = await ShareRecord.find({ createdByUid: req.user.uid }).sort({ createdAt: -1 }).lean();
		if (shares.length === 0) return res.json([]);

		const fileIds = shares.map((s) => s.fileId);
		const files = await FileRecord.find({ _id: { $in: fileIds } }).lean();
		const fileById = new Map(files.map((f) => [String(f._id), f]));

		const out = [];
		for (const share of shares) {
			const f = fileById.get(String(share.fileId));
			if (!f) continue;
			// Only expose records for files the user still owns.
			if (String(f.ownerUid) !== String(req.user.uid)) continue;
			out.push({
				shareId: String(share._id),
				id: String(f._id),
				recipientEmail: share.recipientEmail,
				senderEmail: share.senderEmail || normalizeEmail(req.user.email) || null,
				encryptionMode: f.encryptionMode || "server",
				clientIvB64: f.clientIvB64 || null,
				integrityOk: computeIntegrityOk(f),
				confidentialityOk: computeConfidentialityOk(f),
				originalName: f.originalName,
				mimeType: f.mimeType,
				size: f.size,
				createdAt: f.createdAt,
				sharedAt: share.createdAt
			});
		}

		res.json(out);
	});

	// Share a file with another user via email. File stays in-platform.
	router.post("/:id/share", auth, async (req, res) => {
		const recipientEmail = normalizeEmail(req.body?.recipientEmail);
		if (!recipientEmail) return res.status(400).json({ error: "Missing recipientEmail" });
		if (!recipientEmail.includes("@")) return res.status(400).json({ error: "Invalid recipientEmail" });
		const senderEmail = normalizeEmail(req.user.email);

		// Only allow sharing to a real Firebase Auth user with a verified email.
		try {
			const recipientUser = await admin.auth().getUserByEmail(recipientEmail);
			if (!recipientUser.emailVerified) {
				return res.status(400).json({ error: "Recipient email is not verified" });
			}
		} catch (e) {
			const code = String(e?.code || e?.errorInfo?.code || "");
			if (code === "auth/user-not-found") {
				return res.status(400).json({ error: "Recipient email is not registered" });
			}
			throw e;
		}

		const record = await FileRecord.findOne({ _id: req.params.id, ownerUid: req.user.uid }).lean();
		if (!record) return res.status(404).json({ error: "Not found" });

		try {
			const share = await ShareRecord.create({
				fileId: record._id,
				ownerUid: record.ownerUid,
				senderEmail: senderEmail || undefined,
				recipientEmail,
				createdByUid: req.user.uid
			});
			return res.status(201).json({ ok: true, shareId: String(share._id) });
		} catch (e) {
			// Duplicate share -> treat as success.
			if (String(e?.code || "") === "11000") return res.json({ ok: true, alreadyShared: true });
			throw e;
		}
	});

	router.post("/", auth, upload.single("file"), async (req, res) => {
		if (!req.file) return res.status(400).json({ error: "Missing file" });
		ensureStorageDir();

		const encMode = String(req.body?.encMode || "client").toLowerCase();
		if (encMode !== "client") {
			return res.status(400).json({ error: "Only client-side encrypted uploads are supported" });
		}

		const id = randomId();
		const outPath = path.join(storageDir(), `${id}.bin`);


		const clientIvB64 = String(req.body?.clientIvB64 || "").trim();
		const originalName = String(req.body?.originalName || "").trim() || req.file.originalname;
		const mimeType = String(req.body?.mimeType || "").trim() || "application/octet-stream";
		const size = Number(req.body?.originalSize || req.file.size);
		const originalSha256Hex = String(req.body?.originalSha256Hex || "").trim().toLowerCase();
		if (!clientIvB64) return res.status(400).json({ error: "Missing clientIvB64" });
		if (originalSha256Hex && !/^[a-f0-9]{64}$/.test(originalSha256Hex)) {
			return res.status(400).json({ error: "Invalid originalSha256Hex" });
		}

		// Store ciphertext as-is (client already encrypted).
		fs.writeFileSync(outPath, req.file.buffer);
		const storedSha256Hex = sha256Hex(req.file.buffer);

		const doc = await FileRecord.create({
			ownerUid: req.user.uid,
			encryptionMode: "client",
			clientIvB64,
			originalName,
			mimeType,
			size,
			storagePath: outPath,
			storedSha256Hex,
			originalSha256Hex: originalSha256Hex || undefined
		});

		res.status(201).json({
			id: String(doc._id),
			encryptionMode: doc.encryptionMode || "server",
			originalName: doc.originalName,
			mimeType: doc.mimeType,
			size: doc.size,
			createdAt: doc.createdAt
		});
	});

	router.delete("/:id", auth, async (req, res) => {
		const record = await FileRecord.findOne({ _id: req.params.id, ownerUid: req.user.uid });
		if (!record) return res.status(404).json({ error: "Not found" });

		try {
			fs.unlinkSync(record.storagePath);
		} catch {
			// ignore
		}

		await record.deleteOne();
		res.json({ ok: true });
	});

	router.get("/:id/download", auth, async (req, res) => {
		const access = await canAccessFile({ fileId: req.params.id, uid: req.user.uid, email: req.user.email });
		if (!access.record) return res.status(404).json({ error: "Not found" });
		if (!access.ok) return res.status(403).json({ error: "Forbidden" });
		const record = access.record;

		if (record.encryptionMode === "client") {
			// Client-encrypted: backend returns ciphertext. Recipients must decrypt client-side
			// using a key shared out-of-band by the uploader.
			const ciphertext = fs.readFileSync(record.storagePath);
			const computedStored = sha256Hex(ciphertext);
			if (record.storedSha256Hex && computedStored !== record.storedSha256Hex) {
				return res.status(500).json({ error: "Integrity check failed" });
			}
			res.setHeader("X-Enc-Mode", "client");
			res.setHeader("X-Client-Iv-B64", record.clientIvB64 || "");
			res.setHeader("X-Original-Name", encodeURIComponent(record.originalName || "file"));
			res.setHeader("X-Original-Mime", encodeURIComponent(record.mimeType || "application/octet-stream"));
			res.setHeader("X-Stored-Sha256", record.storedSha256Hex || computedStored);
			if (record.originalSha256Hex) res.setHeader("X-Original-Sha256", record.originalSha256Hex);
			res.setHeader("Content-Type", "application/octet-stream");
			return res.send(ciphertext);
		}

		const dataKey = unwrapDataKey({
			masterKey,
			wrappedKeyHex: record.wrappedKeyHex,
			wrapIvHex: record.wrapIvHex,
			wrapTagHex: record.wrapTagHex
		});

		const ciphertext = fs.readFileSync(record.storagePath);
		const computedStored = sha256Hex(ciphertext);
		if (record.storedSha256Hex && computedStored !== record.storedSha256Hex) {
			return res.status(500).json({ error: "Integrity check failed" });
		}
		const iv = Buffer.from(record.fileIvHex, "hex");
		const tag = Buffer.from(record.fileTagHex, "hex");
		const decipher = crypto.createDecipheriv("aes-256-gcm", dataKey, iv);
		decipher.setAuthTag(tag);
		const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

		// If we have the original plaintext hash, verify it matches what we are about to send.
		if (record.originalSha256Hex) {
			const computedOriginal = sha256Hex(plaintext);
			if (computedOriginal !== record.originalSha256Hex) {
				return res.status(500).json({ error: "Integrity check failed" });
			}
			res.setHeader("X-Original-Sha256", record.originalSha256Hex);
		}
		res.setHeader("X-Stored-Sha256", record.storedSha256Hex || computedStored);

		res.setHeader("Content-Type", record.mimeType || "application/octet-stream");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename*=UTF-8''${encodeURIComponent(record.originalName || "file")}`
		);
		res.send(plaintext);
	});

	return router;
}
