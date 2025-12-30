import express from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { requireAuth } from "./auth.js";
import { config } from "./config.js";
import { FileRecord } from "./models/FileRecord.js";
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

function encryptFileBufferToDisk({ buffer, outPath }) {
	const dataKey = crypto.randomBytes(32);
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, iv);
	const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
	const tag = cipher.getAuthTag();
	fs.writeFileSync(outPath, ciphertext);
	return { dataKey, fileIvHex: iv.toString("hex"), fileTagHex: tag.toString("hex") };
}

export function filesRouter() {
	const router = express.Router();
	const auth = requireAuth();
	const masterKey = getMasterKey(config.masterKeyHex);

	router.get("/", auth, async (req, res) => {
		const files = await FileRecord.find({ ownerUid: req.user.uid }).sort({ createdAt: -1 }).lean();
		res.json(
			files.map((f) => ({
				id: String(f._id),
				encryptionMode: f.encryptionMode || "server",
				clientIvB64: f.clientIvB64 || null,
				originalName: f.originalName,
				mimeType: f.mimeType,
				size: f.size,
				createdAt: f.createdAt,
				updatedAt: f.updatedAt
			}))
		);
	});

	router.post("/", auth, upload.single("file"), async (req, res) => {
		if (!req.file) return res.status(400).json({ error: "Missing file" });
		ensureStorageDir();

		const encMode = String(req.body?.encMode || "server").toLowerCase();

		const id = randomId();
		const outPath = path.join(storageDir(), `${id}.bin`);

		let doc;
		if (encMode === "client") {
			const clientIvB64 = String(req.body?.clientIvB64 || "").trim();
			const originalName = String(req.body?.originalName || "").trim() || req.file.originalname;
			const mimeType = String(req.body?.mimeType || "").trim() || "application/octet-stream";
			const size = Number(req.body?.originalSize || req.file.size);
			if (!clientIvB64) return res.status(400).json({ error: "Missing clientIvB64" });

			// Store ciphertext as-is (client already encrypted).
			fs.writeFileSync(outPath, req.file.buffer);

			doc = await FileRecord.create({
				ownerUid: req.user.uid,
				encryptionMode: "client",
				clientIvB64,
				originalName,
				mimeType,
				size,
				storagePath: outPath
			});
		} else {
			const { dataKey, fileIvHex, fileTagHex } = encryptFileBufferToDisk({ buffer: req.file.buffer, outPath });
			const wrapped = wrapDataKey({ masterKey, dataKey });

			doc = await FileRecord.create({
				ownerUid: req.user.uid,
				encryptionMode: "server",
				originalName: req.file.originalname,
				mimeType: req.file.mimetype,
				size: req.file.size,
				storagePath: outPath,
				fileIvHex,
				fileTagHex,
				...wrapped
			});
		}

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
		const record = await FileRecord.findOne({ _id: req.params.id, ownerUid: req.user.uid }).lean();
		if (!record) return res.status(404).json({ error: "Not found" });

		if (record.encryptionMode === "client") {
			const ciphertext = fs.readFileSync(record.storagePath);
			res.setHeader("X-Enc-Mode", "client");
			res.setHeader("X-Client-Iv-B64", record.clientIvB64 || "");
			res.setHeader("X-Original-Name", encodeURIComponent(record.originalName || "file"));
			res.setHeader("X-Original-Mime", encodeURIComponent(record.mimeType || "application/octet-stream"));
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
		const iv = Buffer.from(record.fileIvHex, "hex");
		const tag = Buffer.from(record.fileTagHex, "hex");
		const decipher = crypto.createDecipheriv("aes-256-gcm", dataKey, iv);
		decipher.setAuthTag(tag);
		const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

		res.setHeader("Content-Type", record.mimeType || "application/octet-stream");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename*=UTF-8''${encodeURIComponent(record.originalName || "file")}`
		);
		res.send(plaintext);
	});

	return router;
}
