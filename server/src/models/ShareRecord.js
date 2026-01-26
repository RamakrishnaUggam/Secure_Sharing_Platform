import mongoose from "mongoose";

const shareRecordSchema = new mongoose.Schema(
	{
		fileId: { type: mongoose.Schema.Types.ObjectId, ref: "FileRecord", required: true, index: true },
		ownerUid: { type: String, required: true, index: true },
		senderEmail: { type: String, required: false, index: true },
		recipientEmail: { type: String, required: true, index: true },
		createdByUid: { type: String, required: true },

		// Sharing source
		sourceType: { type: String, enum: ["direct", "group"], required: true, default: "direct", index: true },
		groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: false, default: null, index: true },

		// Permissions (best-effort; enforced server-side for download).
		permission: { type: String, enum: ["view_only", "download"], required: true, default: "download", index: true },

		// Optional chat-style message/comment to show in conversation preview.
		comment: { type: String, required: false, default: "" },

		// Lifecycle
		expiresAt: { type: Date, required: false, default: null, index: true },
		revokedAt: { type: Date, required: false, default: null, index: true }
	},
	{ timestamps: true }
);

// Prevent duplicate shares of the same file to the same email.
shareRecordSchema.index({ fileId: 1, recipientEmail: 1 }, { unique: true });

export const ShareRecord = mongoose.model("ShareRecord", shareRecordSchema);
