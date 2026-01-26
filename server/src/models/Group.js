import mongoose from "mongoose";

const groupMemberSchema = new mongoose.Schema(
	{
		uid: { type: String, required: true, index: true },
		email: { type: String, required: true, index: true },
		role: {
			type: String,
			enum: ["owner", "admin", "editor", "member", "viewer"],
			required: true,
			default: "member"
		},
		addedByUid: { type: String, required: false },
		addedAt: { type: Date, required: true, default: Date.now }
	},
	{ _id: false }
);

const groupSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		nameLower: { type: String, required: true, index: true },
		description: { type: String, required: false, default: "" },
		ownerUid: { type: String, required: true, index: true },
		groupType: { type: String, enum: ["internal", "external", "hybrid"], default: "internal", index: true },

		// Default permissions applied when sharing to this group.
		defaultPermission: { type: String, enum: ["view_only", "download"], default: "view_only" },
		policySecurityLevel: {
			type: String,
			enum: ["low", "medium", "high"],
			default: "medium",
			index: true
		},
		dataResidencyRule: { type: String, required: false, default: "" },

		expiresAt: { type: Date, required: false, default: null, index: true },
		parentGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: false, default: null, index: true },

		isDisabled: { type: Boolean, required: true, default: false, index: true },

		members: { type: [groupMemberSchema], required: true, default: [] }
	},
	{ timestamps: true }
);

// Unique per owner to avoid global collisions while still being user-friendly.
groupSchema.index({ ownerUid: 1, nameLower: 1 }, { unique: true });

export const Group = mongoose.model("Group", groupSchema);
