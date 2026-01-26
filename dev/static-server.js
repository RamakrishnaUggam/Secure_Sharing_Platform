import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 8000);

const contentTypes = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".txt": "text/plain; charset=utf-8"
};

function safeDecodeURIComponent(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function send(res, status, headers, body) {
	res.writeHead(status, headers);
	res.end(body);
}

const server = http.createServer((req, res) => {
	try {
		const method = String(req.method || "GET").toUpperCase();
		if (method !== "GET" && method !== "HEAD") {
			return send(res, 405, { "Content-Type": "text/plain" }, "Method Not Allowed");
		}

		const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
		let reqPath = safeDecodeURIComponent(url.pathname || "/");
		if (reqPath === "/") reqPath = "/index.html";

		// Prevent path traversal
		const fsPath = path.resolve(rootDir, "." + reqPath.replace(/\\/g, "/"));
		if (!fsPath.startsWith(rootDir)) {
			return send(res, 403, { "Content-Type": "text/plain" }, "Forbidden");
		}

		let stat;
		try {
			stat = fs.statSync(fsPath);
		} catch {
			return send(res, 404, { "Content-Type": "text/plain" }, "Not Found");
		}

		if (stat.isDirectory()) {
			const indexPath = path.join(fsPath, "index.html");
			if (fs.existsSync(indexPath)) {
				const buf = fs.readFileSync(indexPath);
				if (method === "HEAD") return send(res, 200, { "Content-Type": "text/html; charset=utf-8" }, "");
				return send(res, 200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }, buf);
			}
			return send(res, 404, { "Content-Type": "text/plain" }, "Not Found");
		}

		const ext = path.extname(fsPath).toLowerCase();
		const type = contentTypes[ext] || "application/octet-stream";
		if (method === "HEAD") {
			return send(res, 200, { "Content-Type": type, "Cache-Control": "no-store" }, "");
		}

		const buf = fs.readFileSync(fsPath);
		return send(res, 200, { "Content-Type": type, "Cache-Control": "no-store" }, buf);
	} catch (e) {
		return send(res, 500, { "Content-Type": "text/plain" }, String(e?.message || e));
	}
});

server.listen(port, "127.0.0.1", () => {
	// eslint-disable-next-line no-console
	console.log(`Static server listening on http://127.0.0.1:${port}`);
	// eslint-disable-next-line no-console
	console.log(`Serving: ${rootDir}`);
});
