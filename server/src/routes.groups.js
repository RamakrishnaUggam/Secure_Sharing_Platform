import express from "express";
import admin from "firebase-admin";

import { requireAuth, isFirebaseAdminConfigured } from "./auth.js";
import { Group } from "./models/Group.js";
import { GroupInvite } from "./models/GroupInvite.js";
import { AuditLog } from "./models/AuditLog.js";
import { ShareRecord } from "./models/ShareRecord.js";

function normalizeEmail(value) {
	return String(value || "")
		.trim()
		.toLowerCase();
}

function isValidEmail(value) {
	const e = normalizeEmail(value);
	return !!(e && e.includes("@") && e.length <= 254);
}

function nowUtc() {
	return new Date();
}

function isExpired(group) {
	if (!group?.expiresAt) return false;
	try {
		return new Date(group.expiresAt).getTime() <= Date.now();
	} catch {
		return false;
	}
}

function roleRank(role) {
	switch (String(role || "")) {
		case "owner":
			return 4;
		case "admin":
			return 3;
		case "editor":
			return 2;
		case "member":
			return 1;
		case "viewer":
		default:
			return 0;
	}
}

function findMember(group, uid) {
	const members = Array.isArray(group?.members) ? group.members : [];
	return members.find((m) => String(m.uid) === String(uid)) || null;
}

function requireGroupRole(minRole) {
	const min = roleRank(minRole);
	return async function (req, res, next) {
		try {
			const groupId = String(req.params.groupId || req.params.id || "").trim();
			if (!groupId) return res.status(400).json({ error: "Missing groupId" });
			const group = await Group.findById(groupId);
			if (!group) return res.status(404).json({ error: "Group not found" });
			if (group.isDisabled) return res.status(403).json({ error: "Group disabled" });
			if (isExpired(group)) return res.status(403).json({ error: "Group expired" });
			const member = findMember(group, req.user.uid);
			if (!member) return res.status(403).json({ error: "Not a group member" });
			if (roleRank(member.role) < min) return res.status(403).json({ error: "Insufficient group role" });
			req.group = group;
			req.groupMember = member;
			return next();
		} catch (e) {
			return next(e);
		}
	};
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

async function requireVerifiedFirebaseUserByEmail(email) {
	const norm = normalizeEmail(email);
	if (!norm || !norm.includes("@")) throw new Error("Invalid email");
	const u = await admin.auth().getUserByEmail(norm);
	if (!u?.emailVerified) {
		const err = new Error("Recipient email is not verified");
		err.code = "not-verified";
		throw err;
	}
	return { uid: u.uid, email: normalizeEmail(u.email || norm) };
}

export function groupsRouter() {
	const router = express.Router();
	const auth = requireAuth();

	// List pending invites for current user (by email).
	router.get("/invites", auth, async (req, res) => {
		const email = normalizeEmail(req.user?.email);
		if (!email) return res.status(400).json({ error: "Missing user email" });
		const invites = await GroupInvite.find({ inviteeEmail: email, status: "pending" })
			.sort({ createdAt: -1 })
			.limit(50)
			.lean();
		return res.json(
			(invites || []).map((i) => ({
				id: String(i._id),
				groupId: String(i.groupId),
				groupName: i.groupName,
				role: i.role,
				inviterEmail: i.inviterEmail || "",
				createdAt: i.createdAt
			}))
		);
	});

	// Accept an invite: adds the current user to the group.
	router.post("/invites/:inviteId/accept", auth, async (req, res) => {
		const email = normalizeEmail(req.user?.email);
		if (!email) return res.status(400).json({ error: "Missing user email" });
		const inviteId = String(req.params.inviteId || "").trim();
		if (!inviteId) return res.status(400).json({ error: "Missing inviteId" });
		const invite = await GroupInvite.findById(inviteId);
		if (!invite) return res.status(404).json({ error: "Invite not found" });
		if (invite.status !== "pending") return res.status(400).json({ error: "Invite is not pending" });
		if (normalizeEmail(invite.inviteeEmail) !== email) return res.status(403).json({ error: "Not your invite" });

		const group = await Group.findById(invite.groupId);
		if (!group) return res.status(404).json({ error: "Group not found" });
		if (group.isDisabled) return res.status(403).json({ error: "Group disabled" });
		if (isExpired(group)) return res.status(403).json({ error: "Group expired" });

		const members = Array.isArray(group.members) ? group.members : [];
		if (!members.some((m) => normalizeEmail(m.email) === email)) {
			members.push({
				uid: String(req.user.uid),
				email,
				role: String(invite.role || "member"),
				addedByUid: String(invite.inviterUid || ""),
				addedAt: nowUtc()
			});
			group.members = members;
			await group.save();
		}

		invite.status = "accepted";
		invite.respondedAt = nowUtc();
		await invite.save();

		await writeAudit(req, {
			action: "group.invite.accept",
			targetType: "group",
			targetId: String(group._id),
			meta: { inviteId: String(invite._id), email }
		});

		return res.json({ ok: true, groupId: String(group._id) });
	});

	// Decline an invite.
	router.post("/invites/:inviteId/decline", auth, async (req, res) => {
		const email = normalizeEmail(req.user?.email);
		if (!email) return res.status(400).json({ error: "Missing user email" });
		const inviteId = String(req.params.inviteId || "").trim();
		if (!inviteId) return res.status(400).json({ error: "Missing inviteId" });
		const invite = await GroupInvite.findById(inviteId);
		if (!invite) return res.status(404).json({ error: "Invite not found" });
		if (invite.status !== "pending") return res.status(400).json({ error: "Invite is not pending" });
		if (normalizeEmail(invite.inviteeEmail) !== email) return res.status(403).json({ error: "Not your invite" });
		invite.status = "declined";
		invite.respondedAt = nowUtc();
		await invite.save();

		await writeAudit(req, {
			action: "group.invite.decline",
			targetType: "group",
			targetId: String(invite.groupId),
			meta: { inviteId: String(invite._id), email }
		});

		return res.json({ ok: true });
	});

	// List groups for current user.
	router.get("/", auth, async (req, res) => {
		const uid = String(req.user.uid);
		const groups = await Group.find({ "members.uid": uid }).sort({ updatedAt: -1 }).lean();
		return res.json(
			(groups || []).map((g) => {
				const member = (g.members || []).find((m) => String(m.uid) === uid);
				return {
					id: String(g._id),
					name: g.name,
					description: g.description || "",
					groupType: g.groupType,
					defaultPermission: g.defaultPermission,
					policySecurityLevel: g.policySecurityLevel,
					dataResidencyRule: g.dataResidencyRule || "",
					expiresAt: g.expiresAt || null,
					isExpired: isExpired(g),
					isDisabled: Boolean(g.isDisabled),
					memberCount: Array.isArray(g.members) ? g.members.length : 0,
					myRole: member?.role || "viewer",
					createdAt: g.createdAt,
					updatedAt: g.updatedAt
				};
			})
		);
	});

	// Create group.
	router.post("/", auth, async (req, res) => {
		const name = String(req.body?.name || "").trim();
		if (!name) return res.status(400).json({ error: "Missing group name" });
		if (name.length > 64) return res.status(400).json({ error: "Group name too long" });
		const description = String(req.body?.description || "").trim();
		const groupType = String(req.body?.groupType || "internal").toLowerCase();
		const defaultPermission = String(req.body?.defaultPermission || "view_only").toLowerCase();
		const policySecurityLevel = String(req.body?.policySecurityLevel || "medium").toLowerCase();
		const dataResidencyRule = String(req.body?.dataResidencyRule || "").trim();
		const parentGroupId = String(req.body?.parentGroupId || "").trim();
		const expiresAtRaw = req.body?.expiresAt;

		let expiresAt = null;
		if (expiresAtRaw) {
			const d = new Date(expiresAtRaw);
			if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Invalid expiresAt" });
			expiresAt = d;
		}

		const ownerUid = String(req.user.uid);
		const ownerEmail = normalizeEmail(req.user.email);
		const doc = await Group.create({
			name,
			nameLower: name.toLowerCase(),
			description,
			ownerUid,
			groupType,
			defaultPermission,
			policySecurityLevel,
			dataResidencyRule,
			expiresAt,
			parentGroupId: parentGroupId || null,
			members: [
				{
					uid: ownerUid,
					email: ownerEmail || "unknown",
					role: "owner",
					addedByUid: ownerUid
				}
			]
		});

		await writeAudit(req, {
			action: "group.create",
			targetType: "group",
			targetId: String(doc._id),
			meta: { name: doc.name, groupType: doc.groupType }
		});

		return res.status(201).json({ ok: true, id: String(doc._id) });
	});

	// Get group details (members visible for group admins).
	router.get("/:id", auth, async (req, res) => {
		const group = await Group.findById(String(req.params.id || "").trim()).lean();
		if (!group) return res.status(404).json({ error: "Group not found" });
		const member = (group.members || []).find((m) => String(m.uid) === String(req.user.uid));
		if (!member) return res.status(403).json({ error: "Not a group member" });

		const includeMembers = roleRank(member.role) >= roleRank("admin");
		return res.json({
			id: String(group._id),
			name: group.name,
			description: group.description || "",
			ownerUid: group.ownerUid,
			groupType: group.groupType,
			defaultPermission: group.defaultPermission,
			policySecurityLevel: group.policySecurityLevel,
			dataResidencyRule: group.dataResidencyRule || "",
			expiresAt: group.expiresAt || null,
			isExpired: isExpired(group),
			isDisabled: Boolean(group.isDisabled),
			memberCount: Array.isArray(group.members) ? group.members.length : 0,
			myRole: member.role,
			members: includeMembers
				? (group.members || []).map((m) => ({ uid: m.uid, email: m.email, role: m.role, addedAt: m.addedAt }))
				: null,
			createdAt: group.createdAt,
			updatedAt: group.updatedAt
		});
	});

	// Update group metadata (admin+).
	router.patch("/:id", auth, requireGroupRole("admin"), async (req, res) => {
		const group = req.group;
		const patch = {};

		if (req.body?.name != null) {
			const name = String(req.body.name || "").trim();
			if (!name) return res.status(400).json({ error: "Invalid name" });
			patch.name = name;
			patch.nameLower = name.toLowerCase();
		}
		if (req.body?.description != null) patch.description = String(req.body.description || "").trim();
		if (req.body?.groupType != null) patch.groupType = String(req.body.groupType || "internal").toLowerCase();
		if (req.body?.defaultPermission != null)
			patch.defaultPermission = String(req.body.defaultPermission || "view_only").toLowerCase();
		if (req.body?.policySecurityLevel != null)
			patch.policySecurityLevel = String(req.body.policySecurityLevel || "medium").toLowerCase();
		if (req.body?.dataResidencyRule != null) patch.dataResidencyRule = String(req.body.dataResidencyRule || "").trim();
		if (req.body?.expiresAt !== undefined) {
			if (req.body.expiresAt === null || req.body.expiresAt === "") {
				patch.expiresAt = null;
			} else {
				const d = new Date(req.body.expiresAt);
				if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Invalid expiresAt" });
				patch.expiresAt = d;
			}
		}

		const updated = await Group.findByIdAndUpdate(group._id, patch, { new: true }).lean();
		await writeAudit(req, {
			action: "group.update",
			targetType: "group",
			targetId: String(group._id),
			meta: { patch: Object.keys(patch) }
		});
		return res.json({ ok: true, group: updated ? { id: String(updated._id), name: updated.name } : null });
	});

	// Invite member by email (admin+). Invitation must be accepted by the invitee.
	router.post("/:id/invites", auth, requireGroupRole("admin"), async (req, res) => {
		const group = req.group;
		const email = normalizeEmail(req.body?.email);
		const role = String(req.body?.role || "member").toLowerCase();
		if (!isValidEmail(email)) return res.status(400).json({ error: "Missing email" });
		if (!['admin', 'editor', 'member', 'viewer'].includes(role)) return res.status(400).json({ error: "Invalid role" });

		// If already a member, no invite needed.
		const members = Array.isArray(group.members) ? group.members : [];
		if (members.some((m) => normalizeEmail(m.email) === email)) {
			return res.json({ ok: true, alreadyMember: true });
		}

		// Reuse an existing pending invite if any.
		const existing = await GroupInvite.findOne({ groupId: group._id, inviteeEmail: email, status: 'pending' }).lean();
		if (existing) {
			return res.status(201).json({ ok: true, inviteId: String(existing._id), existing: true });
		}

		const doc = await GroupInvite.create({
			groupId: group._id,
			groupName: group.name,
			inviterUid: String(req.user.uid || "") || undefined,
			inviterEmail: normalizeEmail(req.user.email) || undefined,
			inviteeEmail: email,
			role
		});

		await writeAudit(req, {
			action: "group.invite.create",
			targetType: "group",
			targetId: String(group._id),
			meta: { inviteId: String(doc._id), email, role }
		});

		return res.status(201).json({ ok: true, inviteId: String(doc._id) });
	});

	// Revoke an invite (admin+).
	router.delete("/:id/invites/:inviteId", auth, requireGroupRole("admin"), async (req, res) => {
		const group = req.group;
		const inviteId = String(req.params.inviteId || "").trim();
		if (!inviteId) return res.status(400).json({ error: "Missing inviteId" });
		const invite = await GroupInvite.findById(inviteId);
		if (!invite) return res.status(404).json({ error: "Invite not found" });
		if (String(invite.groupId) !== String(group._id)) return res.status(404).json({ error: "Invite not found" });
		if (invite.status !== "pending") return res.status(400).json({ error: "Invite is not pending" });
		invite.status = "revoked";
		invite.respondedAt = nowUtc();
		await invite.save();

		await writeAudit(req, {
			action: "group.invite.revoke",
			targetType: "group",
			targetId: String(group._id),
			meta: { inviteId: String(invite._id), email: invite.inviteeEmail }
		});

		return res.json({ ok: true });
	});

	// Add member by email (admin+)
	router.post("/:id/members", auth, requireGroupRole("admin"), async (req, res) => {
		const isDev = String(process.env.NODE_ENV || "").toLowerCase() !== "production";
		if (!isFirebaseAdminConfigured()) {
			return res.status(isDev ? 501 : 500).json({
				error: "Firebase Admin credentials not configured",
				hint: "Adding members by email requires Firebase Admin. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON"
			});
		}

		const group = req.group;
		const email = normalizeEmail(req.body?.email);
		const role = String(req.body?.role || "member").toLowerCase();
		if (!email) return res.status(400).json({ error: "Missing email" });
		if (!["admin", "editor", "member", "viewer"].includes(role)) return res.status(400).json({ error: "Invalid role" });

		let target;
		try {
			target = await requireVerifiedFirebaseUserByEmail(email);
		} catch (e) {
			const code = String(e?.code || "");
			if (code === "auth/user-not-found") return res.status(400).json({ error: "User is not registered" });
			if (code === "not-verified") return res.status(400).json({ error: "User email is not verified" });
			return res.status(400).json({ error: String(e?.message || "Invalid user") });
		}

		// Disallow adding yourself as non-owner in weird states.
		if (String(target.uid) === String(group.ownerUid)) {
			return res.status(400).json({ error: "Owner is already a member" });
		}

		const members = Array.isArray(group.members) ? group.members : [];
		if (members.some((m) => String(m.uid) === String(target.uid))) {
			return res.json({ ok: true, alreadyMember: true });
		}

		members.push({
			uid: target.uid,
			email: target.email,
			role,
			addedByUid: String(req.user.uid),
			addedAt: nowUtc()
		});
		group.members = members;
		await group.save();

		await writeAudit(req, {
			action: "group.member.add",
			targetType: "group",
			targetId: String(group._id),
			meta: { uid: target.uid, email: target.email, role }
		});

		return res.status(201).json({ ok: true });
	});

	// Update member role (admin+)
	router.patch("/:id/members/:uid", auth, requireGroupRole("admin"), async (req, res) => {
		const group = req.group;
		const targetUid = String(req.params.uid || "").trim();
		const role = String(req.body?.role || "").toLowerCase();
		if (!targetUid) return res.status(400).json({ error: "Missing uid" });
		if (!["admin", "editor", "member", "viewer"].includes(role)) return res.status(400).json({ error: "Invalid role" });
		if (String(targetUid) === String(group.ownerUid)) return res.status(400).json({ error: "Cannot change owner role" });
		const members = Array.isArray(group.members) ? group.members : [];
		const m = members.find((x) => String(x.uid) === targetUid);
		if (!m) return res.status(404).json({ error: "Member not found" });
		m.role = role;
		await group.save();

		await writeAudit(req, {
			action: "group.member.role",
			targetType: "group",
			targetId: String(group._id),
			meta: { uid: targetUid, role }
		});

		return res.json({ ok: true });
	});

	// Remove member (admin+)
	router.delete("/:id/members/:uid", auth, requireGroupRole("admin"), async (req, res) => {
		const group = req.group;
		const targetUid = String(req.params.uid || "").trim();
		if (!targetUid) return res.status(400).json({ error: "Missing uid" });
		if (String(targetUid) === String(group.ownerUid)) return res.status(400).json({ error: "Cannot remove owner" });

		const before = Array.isArray(group.members) ? group.members : [];
		const removed = before.find((m) => String(m.uid) === targetUid) || null;
		const after = before.filter((m) => String(m.uid) !== targetUid);
		if (after.length === before.length) return res.status(404).json({ error: "Member not found" });
		group.members = after;
		await group.save();

		// Revoke any group-sourced shares for this member.
		try {
			const email = normalizeEmail(removed?.email);
			if (email) {
				await ShareRecord.updateMany(
					{ groupId: group._id, sourceType: "group", recipientEmail: email, revokedAt: null },
					{ $set: { revokedAt: new Date() } }
				);
			}
		} catch {
			// ignore
		}

		await writeAudit(req, {
			action: "group.member.remove",
			targetType: "group",
			targetId: String(group._id),
			meta: { uid: targetUid }
		});

		return res.json({ ok: true });
	});

	return router;
}
