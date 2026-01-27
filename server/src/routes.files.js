import express from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

import { requireAuth, isFirebaseAdminConfigured } from "./auth.js";
import { config } from "./config.js";
import { FileRecord } from "./models/FileRecord.js";
import { ShareRecord } from "./models/ShareRecord.js";
import { Group } from "./models/Group.js";
import { AuditLog } from "./models/AuditLog.js";
import { getMasterKey, wrapDataKey, unwrapDataKey } from "./cryptoBox.js";

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

function storageDir() {
	if (config.storageDir) return path.resolve(String(config.storageDir));
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

function resolveStoragePath(record) {
	if (!record) return null;
	const direct = String(record.storagePath || "");
	if (direct && fs.existsSync(direct)) return direct;
	if (record.storageKey) {
		return path.join(storageDir(), String(record.storageKey));
	}
	if (direct) return path.join(storageDir(), path.basename(direct));
	return null;
}

function computeIntegrityOk(record) {
	const p = resolveStoragePath(record);
	if (!p) return false;
	if (!record?.storedSha256Hex || !/^[a-f0-9]{64}$/i.test(String(record.storedSha256Hex))) return false;
	const buf = safeReadFileBuffer(p);
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

function normalizeGroupRole(role) {
	const r = String(role || "").toLowerCase();
	if (r === "viewer") return "viewer";
	if (r === "downloader") return "downloader";
	// Backward compat: treat all legacy elevated roles as downloader.
	if (["owner", "admin", "editor", "member"].includes(r)) return "downloader";
	return "viewer";
}

function shareIsActive(share) {
	if (!share) return false;
	if (share.revokedAt) return false;
	if (share.expiresAt) {
		try {
			if (new Date(share.expiresAt).getTime() <= Date.now()) return false;
		} catch {
			// ignore
		}
	}
	return true;
}

function canDownloadFromShare(share) {
	const perm = String(share?.permission || "download").toLowerCase();
	return perm === "download";
}

async function writeAudit(req, { action, targetType, targetId, meta }) {
	try {
		await AuditLog.create({
			actorUid: String(req.user?.uid || "") || undefined,
			actorEmail: normalizeEmail(req.user?.email) || undefined,
			action: String(action || ""),
			targetType: String(targetType || ""),
			targetId: targetId != null ? String(targetId) : undefined,
			meta: meta || undefined,
			ip: String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "") || undefined,
			userAgent: String(req.headers["user-agent"] || "") || undefined
		});
	} catch {
		// best effort
	}
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
	if (!shareIsActive(share)) return { ok: false, record };

	// Extra enforcement for group shares: user must still be in the group,
	// group must be active, and only downloaders can download.
	if (String(share.sourceType || "direct") === "group" && share.groupId) {
		const group = await Group.findById(String(share.groupId)).lean();
		if (!group) return { ok: false, record };
		if (group.isDisabled) return { ok: false, record };
		if (group.expiresAt) {
			try {
				if (new Date(group.expiresAt).getTime() <= Date.now()) return { ok: false, record };
			} catch {
				return { ok: false, record };
			}
		}
		const member = (group.members || []).find((m) => String(m.uid) === String(uid));
		if (!member) return { ok: false, record };
		if (normalizeGroupRole(member.role) !== "downloader") return { ok: false, record };
	}

	if (!canDownloadFromShare(share)) return { ok: false, record };
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

	let masterKey = null;
	if (!config.masterKeyHex) {
		router.use((_req, res) =>
			res.status(500).json({
				error: "Server not configured",
				hint: "Set MASTER_KEY_HEX in server environment (.env)"
			})
		);
		return router;
	}

	try {
		masterKey = getMasterKey(config.masterKeyHex);
	} catch (e) {
		router.use((_req, res) =>
			res.status(500).json({
				error: "Invalid MASTER_KEY_HEX",
				details: String(e?.message || e)
			})
		);
		return router;
	}

	// Delete a share record.
	// - Recipient can delete a received share (removes from "Received").
	// - Sender/owner can delete (revoke) a sent share (removes access for the recipient).
	router.delete("/shares/:shareId", auth, async (req, res) => {
		const email = normalizeEmail(req.user.email);
		const uid = String(req.user.uid || "").trim();
		if (!email && !uid) return res.status(400).json({ error: "No user identity" });
		const shareId = String(req.params.shareId || "").trim();
		if (!shareId) return res.status(400).json({ error: "Missing shareId" });

		const share = await ShareRecord.findById(shareId);
		if (!share) return res.status(404).json({ error: "Not found" });

		const recipientEmail = normalizeEmail(share.recipientEmail);
		const senderEmail = normalizeEmail(share.senderEmail);
		const allowed =
			(email && recipientEmail && recipientEmail === email) ||
			(email && senderEmail && senderEmail === email) ||
			(uid && String(share.ownerUid || "") === uid) ||
			(uid && String(share.createdByUid || "") === uid);
		if (!allowed) return res.status(404).json({ error: "Not found" });

		const fileId = share.fileId;
		await share.deleteOne();

		// If the owner previously deleted the file and this was the last share,
		// we can safely delete the stored bytes + FileRecord now.
		try {
			const remainingShares = await ShareRecord.countDocuments({ fileId });
			if (remainingShares === 0) {
				const file = await FileRecord.findById(fileId);
				if (file && file.ownerDeletedAt) {
					try {
						const p = resolveStoragePath(file);
						if (p) fs.unlinkSync(p);
					} catch {
						// ignore
					}
					await file.deleteOne();
					return res.json({ ok: true, cleanedUp: true });
				}
			}
		} catch {
			// ignore
		}
		
		res.json({ ok: true });
	});

		router.get("/", auth, async (req, res) => {
			const files = await FileRecord.find({ ownerUid: req.user.uid, ownerDeletedAt: null })
				.sort({ createdAt: -1 })
				.lean();
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

		const shares = await ShareRecord.find({ recipientEmail: email }).sort({ updatedAt: -1, createdAt: -1 }).lean();
		if (shares.length === 0) return res.json([]);

		const fileIds = shares.map((s) => s.fileId);
		const files = await FileRecord.find({ _id: { $in: fileIds } }).lean();
		const fileById = new Map(files.map((f) => [String(f._id), f]));

		const out = [];
		for (const share of shares) {
			if (!shareIsActive(share)) continue;
			const f = fileById.get(String(share.fileId));
			if (!f) continue;
			out.push({
				shareId: String(share._id),
				id: String(f._id),
				ownerUid: f.ownerUid,
				senderEmail: share.senderEmail || null,
				permission: share.permission || "download",
				comment: String(share.comment || ""),
				sourceType: share.sourceType || "direct",
				groupId: share.groupId ? String(share.groupId) : null,
				expiresAt: share.expiresAt || null,
				encryptionMode: f.encryptionMode || "server",
				clientIvB64: f.clientIvB64 || null,
				integrityOk: computeIntegrityOk(f),
				confidentialityOk: computeConfidentialityOk(f),
				originalName: f.originalName,
				mimeType: f.mimeType,
				size: f.size,
				createdAt: f.createdAt,
				sharedAt: share.updatedAt || share.createdAt
			});
		}

		res.json(out);
	});

	// List files the signed-in user has shared with others.
	router.get("/shared/by-me", auth, async (req, res) => {
		const shares = await ShareRecord.find({ createdByUid: req.user.uid }).sort({ updatedAt: -1, createdAt: -1 }).lean();
		if (shares.length === 0) return res.json([]);

		const fileIds = shares.map((s) => s.fileId);
		const files = await FileRecord.find({ _id: { $in: fileIds } }).lean();
		const fileById = new Map(files.map((f) => [String(f._id), f]));

		const out = [];
		for (const share of shares) {
			if (!shareIsActive(share)) continue;
			const f = fileById.get(String(share.fileId));
			if (!f) continue;
			// Only expose records for files the user still owns.
			// Note: We intentionally include ownerDeletedAt files so the sender can still
			// see recent shares in Chats even after removing the file from their Uploads list.
			if (String(f.ownerUid) !== String(req.user.uid)) continue;
			out.push({
				shareId: String(share._id),
				id: String(f._id),
				recipientEmail: share.recipientEmail,
				senderEmail: share.senderEmail || normalizeEmail(req.user.email) || null,
				permission: share.permission || "download",
				comment: String(share.comment || ""),
				sourceType: share.sourceType || "direct",
				groupId: share.groupId ? String(share.groupId) : null,
				expiresAt: share.expiresAt || null,
				encryptionMode: f.encryptionMode || "server",
				clientIvB64: f.clientIvB64 || null,
				integrityOk: computeIntegrityOk(f),
				confidentialityOk: computeConfidentialityOk(f),
				originalName: f.originalName,
				mimeType: f.mimeType,
				size: f.size,
				createdAt: f.createdAt,
				sharedAt: share.updatedAt || share.createdAt
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
		const comment = String(req.body?.comment || "").trim().slice(0, 500);

		// Only allow sharing to a real Firebase Auth user with a verified email.
		// In dev, if Firebase Admin credentials aren't configured, skip this check so the UI remains usable.
		const isDev = String(process.env.NODE_ENV || "").toLowerCase() !== "production";
		if (isFirebaseAdminConfigured()) {
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
		} else if (!isDev) {
			return res.status(500).json({
				error: "Firebase Admin credentials not configured",
				hint: "Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON"
			});
		}

		const record = await FileRecord.findOne({ _id: req.params.id, ownerUid: req.user.uid }).lean();
		if (!record) return res.status(404).json({ error: "Not found" });

		try {
			const share = await ShareRecord.create({
				fileId: record._id,
				ownerUid: record.ownerUid,
				senderEmail: senderEmail || undefined,
				recipientEmail,
				createdByUid: req.user.uid,
				sourceType: "direct",
				permission: "download",
				comment
			});
			void writeAudit(req, {
				action: "file.share.direct",
				targetType: "file",
				targetId: String(record._id),
				meta: { recipientEmail, commentLength: comment ? comment.length : 0 }
			});
			return res.status(201).json({ ok: true, shareId: String(share._id) });
		} catch (e) {
			// Duplicate share -> treat as success.
			if (String(e?.code || "") === "11000") return res.json({ ok: true, alreadyShared: true });
			throw e;
		}
	});

	// Share a file with all members of a group.
	router.post("/:id/share-group", auth, async (req, res) => {
		const groupId = String(req.body?.groupId || "").trim();
		if (!groupId) return res.status(400).json({ error: "Missing groupId" });
		const requestedPermission = String(req.body?.permission || "").toLowerCase();
		const senderEmail = normalizeEmail(req.user.email);
		const comment = String(req.body?.comment || "").trim().slice(0, 500);

		const record = await FileRecord.findOne({ _id: req.params.id, ownerUid: req.user.uid }).lean();
		if (!record) return res.status(404).json({ error: "Not found" });

		const group = await Group.findById(groupId).lean();
		if (!group) return res.status(404).json({ error: "Group not found" });
		if (group.isDisabled) return res.status(403).json({ error: "Group disabled" });
		if (group.expiresAt && new Date(group.expiresAt).getTime() <= Date.now()) {
			return res.status(403).json({ error: "Group expired" });
		}
		const myMember = (group.members || []).find((m) => String(m.uid) === String(req.user.uid));
		if (!myMember) return res.status(403).json({ error: "Not a group member" });
		const myRole = normalizeGroupRole(myMember.role);
		if (myRole !== "downloader") {
			return res.status(403).json({ error: "Insufficient group role" });
		}

		const permission = ["view_only", "download"].includes(requestedPermission)
			? requestedPermission
			: String(group.defaultPermission || "view_only");

		const members = Array.isArray(group.members) ? group.members : [];
		const recipients = members
			.map((m) => ({ uid: String(m.uid || ""), email: normalizeEmail(m.email) }))
			.filter((m) => m.uid && m.email && m.uid !== String(req.user.uid));

		let created = 0;
		let alreadyShared = 0;
		let updated = 0;
		let skipped = 0;
		const errors = [];

		for (const r of recipients) {
			try {
				// Validate user still exists and is verified.
				// In dev, allow shares even if Firebase Admin isn't configured.
				const isDev = String(process.env.NODE_ENV || "").toLowerCase() !== "production";
				if (isFirebaseAdminConfigured()) {
					const u = await admin.auth().getUserByEmail(r.email);
					if (!u?.emailVerified) {
						skipped += 1;
						continue;
					}
				} else if (!isDev) {
					throw new Error("Firebase Admin credentials not configured");
				}

				await ShareRecord.create({
					fileId: record._id,
					ownerUid: record.ownerUid,
					senderEmail: senderEmail || undefined,
					recipientEmail: r.email,
					createdByUid: req.user.uid,
					sourceType: "group",
					groupId: group._id,
					permission,
					comment,
					expiresAt: group.expiresAt || null
				});
				created += 1;
			} catch (e) {
				if (String(e?.code || "") === "11000") {
					alreadyShared += 1;
					try {
						const existing = await ShareRecord.findOne({ fileId: record._id, recipientEmail: r.email });
						if (existing) {
							existing.senderEmail = senderEmail || existing.senderEmail;
							existing.createdByUid = String(req.user.uid || existing.createdByUid);
							existing.ownerUid = String(record.ownerUid || existing.ownerUid);
							existing.sourceType = "group";
							existing.groupId = group._id;
							existing.permission = permission;
							existing.comment = comment;
							existing.expiresAt = group.expiresAt || null;
							existing.revokedAt = null;
							await existing.save();
							updated += 1;
						}
					} catch {
						// ignore
					}
					continue;
				}
				errors.push({ email: r.email, error: String(e?.message || e) });
			}
		}

		void writeAudit(req, {
			action: "file.share.group",
			targetType: "file",
			targetId: String(record._id),
			meta: {
				groupId: String(group._id),
				permission,
				commentLength: comment ? comment.length : 0,
				created,
				alreadyShared,
				updated,
				skipped,
				errorsCount: errors.length
			}
		});

		return res.json({ ok: true, created, alreadyShared, updated, skipped, errors });
	});

	router.post("/", auth, upload.single("file"), async (req, res) => {
		if (!req.file) return res.status(400).json({ error: "Missing file" });
		ensureStorageDir();

		const encMode = String(req.body?.encMode || "client").toLowerCase();
		if (encMode !== "client") {
			return res.status(400).json({ error: "Only client-side encrypted uploads are supported" });
		}

		const id = randomId();
		const storageKey = `${id}.bin`;
		const outPath = path.join(storageDir(), storageKey);


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
			storageKey,
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

		// If the file is shared, keep it for recipients and only hide it from the owner.
		const shareCount = await ShareRecord.countDocuments({ fileId: record._id });
		if (shareCount > 0) {
			record.ownerDeletedAt = new Date();
			await record.save();
			return res.json({ ok: true, keptForRecipients: true });
		}

		try {
			const p = resolveStoragePath(record);
			if (p) fs.unlinkSync(p);
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
		void writeAudit(req, { action: "file.download", targetType: "file", targetId: String(req.params.id), meta: {} });
		const record = access.record;
		const p = resolveStoragePath(record);
		if (!p || !fs.existsSync(p)) {
			return res.status(404).json({
				error: "Stored file missing",
				hint:
					"The file record exists, but its stored bytes are missing from the server storage folder. If storage was moved/cleaned or STORAGE_DIR changed, restore the storage folder or re-upload the file."
			});
		}

		if (record.encryptionMode === "client") {
			// Client-encrypted: backend returns ciphertext. Recipients must decrypt client-side
			// using a key shared out-of-band by the uploader.
			const ciphertext = fs.readFileSync(p);
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

		const ciphertext = fs.readFileSync(p);
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
