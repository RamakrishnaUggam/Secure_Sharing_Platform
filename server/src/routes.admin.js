import express from "express";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { requireAuth, requireAdmin, isAdminEmail } from "./auth.js";
import { config } from "./config.js";
import { FileRecord } from "./models/FileRecord.js";
import { ShareRecord } from "./models/ShareRecord.js";
import { getMetricsSnapshot } from "./metrics.js";

function storageDir() {
	if (config.storageDir) return path.resolve(String(config.storageDir));
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	return path.resolve(__dirname, "..", "storage");
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

async function countFirebaseUsers() {
	// firebase-admin listUsers requires admin credentials.
	let nextPageToken = undefined;
	let total = 0;
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const result = await admin.auth().listUsers(1000, nextPageToken);
		total += Array.isArray(result?.users) ? result.users.length : 0;
		nextPageToken = result?.pageToken;
		if (!nextPageToken) break;
	}
	return total;
}

export function adminRouter({ requireDbReady }) {
	const router = express.Router();
	const auth = requireAuth();
	const requireAdminMw = requireAdmin();

	// Safe to call for any authenticated user: just returns whether they're considered admin.
	router.get("/access", auth, (req, res) => {
		const email = String(req.user?.email || "").trim().toLowerCase();
		res.json({
			isAdmin: isAdminEmail(email, config.adminEmails) || config.adminAllowAll
		});
	});

	router.get("/overview", auth, requireAdminMw, requireDbReady, async (_req, res) => {
		const [fileAgg] = await FileRecord.aggregate([
			{
				$group: {
					_id: null,
					total: { $sum: 1 },
					active: {
						$sum: {
							$cond: [{ $eq: ["$ownerDeletedAt", null] }, 1, 0]
						}
					},
					deletedByOwner: {
						$sum: {
							$cond: [{ $ne: ["$ownerDeletedAt", null] }, 1, 0]
						}
					},
					totalBytes: { $sum: "$size" },
					activeBytes: {
						$sum: {
							$cond: [{ $eq: ["$ownerDeletedAt", null] }, "$size", 0]
						}
					},
					uniqueOwners: { $addToSet: "$ownerUid" }
				}
			},
			{
				$project: {
					_id: 0,
					total: 1,
					active: 1,
					deletedByOwner: 1,
					totalBytes: 1,
					activeBytes: 1,
					uniqueOwners: { $size: "$uniqueOwners" }
				}
			}
		]);

		const sharesTotal = await ShareRecord.countDocuments({});

		let usersTotal = null;
		let usersError = null;
		try {
			usersTotal = await countFirebaseUsers();
		} catch (e) {
			usersError = String(e?.message || e);
		}

		res.json({
			users: { total: usersTotal, error: usersError },
			files: fileAgg || {
				total: 0,
				active: 0,
				deletedByOwner: 0,
				totalBytes: 0,
				activeBytes: 0,
				uniqueOwners: 0
			},
			shares: { total: sharesTotal },
			traffic: getMetricsSnapshot()
		});
	});

	// List Firebase users (read-only).
	// Supports paging via nextPageToken.
	router.get("/users", auth, requireAdminMw, async (req, res) => {
		const maxResultsRaw = Number(req.query.maxResults ?? 100);
		const maxResults = Math.max(1, Math.min(500, Number.isFinite(maxResultsRaw) ? maxResultsRaw : 100));
		const pageToken = req.query.pageToken ? String(req.query.pageToken) : undefined;

		try {
			const result = await admin.auth().listUsers(maxResults, pageToken);
			const users = (result?.users || []).map((u) => ({
				uid: u.uid,
				email: u.email || null,
				emailVerified: Boolean(u.emailVerified),
				disabled: Boolean(u.disabled),
				displayName: u.displayName || null,
				createdAt: u.metadata?.creationTime || null,
				lastSignInAt: u.metadata?.lastSignInTime || null
			}));
			res.json({ users, nextPageToken: result?.pageToken || null });
		} catch (e) {
			res.status(500).json({ error: "Failed to list Firebase users", details: String(e?.message || e) });
		}
	});

	// Exact lookup by email (read-only).
	router.get("/users/by-email", auth, requireAdminMw, async (req, res) => {
		const email = String(req.query.email || "")
			.trim()
			.toLowerCase();
		if (!email) return res.status(400).json({ error: "Missing email" });
		try {
			const u = await admin.auth().getUserByEmail(email);
			res.json({
				user: {
					uid: u.uid,
					email: u.email || null,
					emailVerified: Boolean(u.emailVerified),
					disabled: Boolean(u.disabled),
					displayName: u.displayName || null,
					createdAt: u.metadata?.creationTime || null,
					lastSignInAt: u.metadata?.lastSignInTime || null
				}
			});
		} catch (e) {
			res.status(404).json({ error: "User not found", details: String(e?.message || e) });
		}
	});

	// List stored files (MongoDB FileRecord) (read-only).
	router.get("/files", auth, requireAdminMw, requireDbReady, async (req, res) => {
		const limitRaw = Number(req.query.limit ?? 50);
		const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
		const skipRaw = Number(req.query.skip ?? 0);
		const skip = Math.max(0, Number.isFinite(skipRaw) ? skipRaw : 0);
		const q = String(req.query.q || "").trim();

		const query = {};
		if (q) {
			query.$or = [
				{ originalName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
				{ ownerUid: q }
			];
		}

		const [total, items] = await Promise.all([
			FileRecord.countDocuments(query),
			FileRecord.find(query)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean()
		]);

		res.json({
			total,
			items: items.map((r) => ({
				id: String(r._id),
				ownerUid: r.ownerUid,
				originalName: r.originalName,
				mimeType: r.mimeType,
				size: r.size,
				encryptionMode: r.encryptionMode,
				ownerDeletedAt: r.ownerDeletedAt || null,
				createdAt: r.createdAt || null,
				storedSha256Hex: r.storedSha256Hex || null
			}))
		});
	});

	// List share records (MongoDB ShareRecord) (read-only).
	router.get("/shares", auth, requireAdminMw, requireDbReady, async (req, res) => {
		const limitRaw = Number(req.query.limit ?? 50);
		const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
		const skipRaw = Number(req.query.skip ?? 0);
		const skip = Math.max(0, Number.isFinite(skipRaw) ? skipRaw : 0);
		const q = String(req.query.q || "")
			.trim()
			.toLowerCase();

		const query = {};
		if (q) {
			query.$or = [
				{ recipientEmail: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
				{ senderEmail: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
				{ ownerUid: q }
			];
		}

		const [total, items] = await Promise.all([
			ShareRecord.countDocuments(query),
			ShareRecord.find(query)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean()
		]);

		res.json({
			total,
			items: items.map((r) => ({
				id: String(r._id),
				fileId: String(r.fileId),
				ownerUid: r.ownerUid,
				senderEmail: r.senderEmail || null,
				recipientEmail: r.recipientEmail,
				createdAt: r.createdAt || null
			}))
		});
	});

	// --- Actions (admin-only) ---

	// Enable/disable a Firebase user (RBAC-lite for now).
	router.patch("/users/:uid", auth, requireAdminMw, async (req, res) => {
		const uid = String(req.params.uid || "").trim();
		if (!uid) return res.status(400).json({ error: "Missing uid" });
		const disabled = Boolean(req.body?.disabled);
		try {
			const u = await admin.auth().updateUser(uid, { disabled });
			return res.json({
				ok: true,
				user: {
					uid: u.uid,
					email: u.email || null,
					emailVerified: Boolean(u.emailVerified),
					disabled: Boolean(u.disabled),
					displayName: u.displayName || null
				}
			});
		} catch (e) {
			return res.status(500).json({ error: "Failed to update user", details: String(e?.message || e) });
		}
	});

	// Revoke a share record. If the file owner already deleted and this was the last share,
	// clean up the stored bytes + FileRecord.
	router.delete("/shares/:shareId", auth, requireAdminMw, requireDbReady, async (req, res) => {
		const shareId = String(req.params.shareId || "").trim();
		if (!shareId) return res.status(400).json({ error: "Missing shareId" });

		const share = await ShareRecord.findById(shareId).lean();
		if (!share) return res.status(404).json({ error: "Share not found" });

		await ShareRecord.deleteOne({ _id: share._id });

		// Orphan cleanup (same idea as receiver deleting their last share after owner deleted)
		const file = await FileRecord.findById(share.fileId).lean();
		if (file?.ownerDeletedAt) {
			const remaining = await ShareRecord.countDocuments({ fileId: share.fileId });
			if (remaining === 0) {
				try {
					const p = resolveStoragePath(file);
					if (p && fs.existsSync(p)) fs.unlinkSync(p);
				} catch {
					// ignore
				}
				await FileRecord.deleteOne({ _id: share.fileId });
			}
		}

		return res.json({ ok: true });
	});

	// Delete a file as admin (hard delete): removes bytes + shares + FileRecord.
	router.delete("/files/:fileId", auth, requireAdminMw, requireDbReady, async (req, res) => {
		const fileId = String(req.params.fileId || "").trim();
		if (!fileId) return res.status(400).json({ error: "Missing fileId" });

		const record = await FileRecord.findById(fileId).lean();
		if (!record) return res.status(404).json({ error: "File not found" });

		// Delete bytes best-effort.
		try {
			const p = resolveStoragePath(record);
			if (p && fs.existsSync(p)) fs.unlinkSync(p);
		} catch {
			// ignore
		}

		await ShareRecord.deleteMany({ fileId: record._id });
		await FileRecord.deleteOne({ _id: record._id });

		return res.json({ ok: true });
	});

	return router;
}
