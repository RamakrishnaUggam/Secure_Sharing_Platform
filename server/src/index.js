import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { config } from "./config.js";
import { connectDb } from "./db.js";
import { initFirebaseAdmin, requireAuth } from "./auth.js";
import { filesRouter } from "./routes.files.js";

const app = express();

app.use(
	cors({
		origin(origin, callback) {
			// Allow non-browser tools (curl, Postman) which may not send an Origin header.
			if (!origin) return callback(null, true);
			if (config.corsOrigins.includes(origin)) return callback(null, true);
			return callback(new Error(`CORS blocked for origin: ${origin}`));
		},
		credentials: false
	})
);

app.get("/health", (_req, res) => res.json({ ok: true }));

initFirebaseAdmin(config.firebaseServiceAccountJson);
await connectDb(config.mongoUri);

app.get("/api/me", requireAuth(), (req, res) => {
	res.json({ uid: req.user.uid, email: req.user.email });
});

app.use("/api/files", filesRouter());

app.use((err, _req, res, _next) => {
	// eslint-disable-next-line no-console
	console.error(err);
	res.status(500).json({ error: "Server error" });
});

app.listen(config.port, () => {
	// eslint-disable-next-line no-console
	console.log(`API listening on http://localhost:${config.port}`);
});
