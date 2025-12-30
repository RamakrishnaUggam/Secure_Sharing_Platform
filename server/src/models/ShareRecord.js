import mongoose from "mongoose";

const shareRecordSchema = new mongoose.Schema(
	{
		fileId: { type: mongoose.Schema.Types.ObjectId, ref: "FileRecord", required: true, index: true },
		ownerUid: { type: String, required: true, index: true },
		recipientEmail: { type: String, required: true, index: true },
		createdByUid: { type: String, required: true }
	},
	{ timestamps: true }
);

// Prevent duplicate shares of the same file to the same email.
shareRecordSchema.index({ fileId: 1, recipientEmail: 1 }, { unique: true });

export const ShareRecord = mongoose.model("ShareRecord", shareRecordSchema);
