import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
	{
		actorUid: { type: String, required: false, index: true },
		actorEmail: { type: String, required: false, index: true },
		action: { type: String, required: true, index: true },
		targetType: { type: String, required: true, index: true },
		targetId: { type: String, required: false, index: true },
		meta: { type: mongoose.Schema.Types.Mixed, required: false },
		ip: { type: String, required: false },
		userAgent: { type: String, required: false }
	},
	{ timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
