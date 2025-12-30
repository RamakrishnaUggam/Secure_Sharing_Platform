import mongoose from "mongoose";

const fileRecordSchema = new mongoose.Schema(
	{
		ownerUid: { type: String, required: true, index: true },
		encryptionMode: { type: String, enum: ["server", "client"], default: "server", index: true },
		originalName: { type: String, required: true },
		mimeType: { type: String, default: "" },
		size: { type: Number, required: true },
		storagePath: { type: String, required: true },

		// File encryption (AES-256-GCM)
		fileIvHex: { type: String, required: false },
		fileTagHex: { type: String, required: false },

		// Wrapped data key (AES-256-GCM using master key)
		wrappedKeyHex: { type: String, required: false },
		wrapIvHex: { type: String, required: false },
		wrapTagHex: { type: String, required: false },

		// Client-side encryption metadata
		clientIvB64: { type: String, required: false }
	},
	{ timestamps: true }
);

export const FileRecord = mongoose.model("FileRecord", fileRecordSchema);
