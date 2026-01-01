import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { config } from "./config.js";
import { connectDb } from "./db.js";
import { initFirebaseAdmin, requireAuth } from "./auth.js";
import { filesRouter } from "./routes.files.js";

const app = express();

app.use(express.json({ limit: "1mb" }));

app.use(
	cors({
		origin(origin, callback) {
			const isDev = String(process.env.NODE_ENV || "").toLowerCase() !== "production";
			const githubPagesOrigin = "https://ramakrishnauggam.github.io";
			function isLocalDevOrigin(value) {
				if (!value) return true;
				if (value === "null") return true;
				// Allow typical local dev hosts and private LAN IPs (handy for mobile testing)
				return (
					/^https?:\/\/localhost(?::\d+)?$/i.test(value) ||
					/^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(value) ||
					/^https?:\/\/192\.168\.\d+\.\d+(?::\d+)?$/i.test(value) ||
					/^https?:\/\/10\.\d+\.\d+\.\d+(?::\d+)?$/i.test(value) ||
					/^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(?::\d+)?$/i.test(value)
				);
			}

			// Allow non-browser tools (curl, Postman) which may not send an Origin header.
			if (!origin) return callback(null, true);
			if (origin === githubPagesOrigin) return callback(null, true);
			if (isDev && isLocalDevOrigin(origin)) return callback(null, true);
			if (config.corsAllowAll) return callback(null, true);
			if (config.corsOrigins.includes(origin)) return callback(null, true);
			return callback(new Error(`CORS blocked for origin: ${origin}`));
		},
		credentials: false
	})
);

app.get("/", (_req, res) => {
	res.json({
		ok: true,
		service: "secure-sharing-backend",
		health: "/health",
		me: "/api/me",
		files: "/api/files"
	});
});

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
