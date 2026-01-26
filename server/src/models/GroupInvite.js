import mongoose from "mongoose";

const groupInviteSchema = new mongoose.Schema(
	{
		groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
		groupName: { type: String, required: true },

		inviterUid: { type: String, required: false, index: true },
		inviterEmail: { type: String, required: false, index: true },

		inviteeEmail: { type: String, required: true, index: true },
		role: {
			type: String,
			enum: ["admin", "editor", "member", "viewer"],
			required: true,
			default: "member"
		},
		status: {
			type: String,
			enum: ["pending", "accepted", "declined", "revoked"],
			required: true,
			default: "pending",
			index: true
		},
		respondedAt: { type: Date, required: false, default: null }
	},
	{ timestamps: true }
);

// Avoid spamming the same person with multiple pending invites to the same group.
groupInviteSchema.index({ groupId: 1, inviteeEmail: 1, status: 1 });

groupInviteSchema.index({ inviteeEmail: 1, status: 1, createdAt: -1 });

groupInviteSchema.index({ groupId: 1, createdAt: -1 });

export const GroupInvite = mongoose.model("GroupInvite", groupInviteSchema);
