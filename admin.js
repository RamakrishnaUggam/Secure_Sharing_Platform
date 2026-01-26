import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
	getAuth,
	onAuthStateChanged,
	signOut,
	reload,
	setPersistence,
	browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const firebaseConfig = {
	apiKey: "AIzaSyD7f6dVud8ScJtsfu9K_RZh4gJqgkIbvqk",
	authDomain: "fir-56c08.firebaseapp.com",
	projectId: "fir-56c08",
	storageBucket: "fir-56c08.firebasestorage.app",
	messagingSenderId: "1044236312500",
	appId: "1:1044236312500:web:9aa914b0b61f7cf1899ce1",
	measurementId: "G-NPQ69E5X69"
};

initializeApp(firebaseConfig);
const auth = getAuth();
window.__auth = auth;

try {
	await setPersistence(auth, browserLocalPersistence);
} catch {
	// ignore
}

function normalizeBaseUrl(value) {
	const v = String(value || "").trim();
	if (!v) return "";
	return v.replace(/\/+$/, "");
}

function resolveApiBase() {
	try {
		if (String(window.location.protocol || "").toLowerCase() === "file:") {
			return "http://localhost:3001";
		}
	} catch {
		// ignore
	}

	try {
		const url = new URL(window.location.href);
		const fromQuery = url.searchParams.get("apiBase") || url.searchParams.get("api");
		if (fromQuery) {
			const normalized = normalizeBaseUrl(fromQuery);
			localStorage.setItem("apiBase", normalized);
			return normalized;
		}

		const fromStorage = normalizeBaseUrl(localStorage.getItem("apiBase"));
		if (fromStorage) return fromStorage;
	} catch {
		// ignore
	}

	if (location.hostname === "127.0.0.1") return "http://127.0.0.1:3001";
	if (location.hostname === "localhost") return "http://localhost:3001";
	if (String(location.hostname || "").toLowerCase().endsWith(".github.io")) {
		return "https://secure-sharing-platform.onrender.com";
	}
	return "";
}

const API_BASE = resolveApiBase();

const state = {
	usersNextPageToken: null,
	usersLoaded: 0,
	usersTotal: null,
	filesLoaded: 0,
	filesTotal: null,
	sharesLoaded: 0,
	sharesTotal: null
};

async function getIdToken() {
	const user = auth?.currentUser;
	if (!user) throw new Error("Not logged in");
	return await user.getIdToken();
}

async function apiFetch(path, options = {}) {
	const token = await getIdToken();
	const headers = new Headers(options.headers || {});
	headers.set("Authorization", `Bearer ${token}`);
	const url = `${API_BASE}${path}`;
	return await fetch(url, { ...options, headers });
}

function bytesToHuman(bytes) {
	const n = Number(bytes || 0);
	if (!isFinite(n) || n <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"]; 
	let value = n;
	let idx = 0;
	while (value >= 1024 && idx < units.length - 1) {
		value /= 1024;
		idx += 1;
	}
	return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function setTheme(theme) {
	document.documentElement.setAttribute("data-theme", theme);
	try {
		localStorage.setItem("theme", theme);
	} catch {
		// ignore
	}
}

function getTheme() {
	return document.documentElement.getAttribute("data-theme") || "dark";
}

function renderCards(overview) {
	const cardsEl = document.getElementById("cards");
	if (!cardsEl) return;
	cardsEl.innerHTML = "";

	function addCard(label, value, small) {
		const el = document.createElement("div");
		el.className = "card";
		el.innerHTML = `<div class="k">${label}</div><div class="v">${value}</div>${small ? `<div class="small">${small}</div>` : ""}`;
		cardsEl.appendChild(el);
	}

	const users = overview?.users;
	addCard(
		"Users",
		users?.total == null ? "—" : String(users.total),
		users?.error ? `Firebase user count unavailable: ${users.error}` : "Total Firebase Auth users"
	);

	const files = overview?.files;
	addCard("File Owners", String(files?.uniqueOwners ?? "0"), "Unique uploaders (MongoDB)");
	addCard("Files Uploaded", String(files?.total ?? "0"), `Active: ${files?.active ?? 0} • Deleted by owner: ${files?.deletedByOwner ?? 0}`);
	addCard("Storage", bytesToHuman(files?.totalBytes ?? 0), `Active bytes: ${bytesToHuman(files?.activeBytes ?? 0)}`);

	const shares = overview?.shares;
	addCard("Shares", String(shares?.total ?? "0"), "Total share records");

	const traffic = overview?.traffic;
	addCard("Traffic", String(traffic?.totalRequests ?? "0"), `API requests: ${traffic?.apiRequests ?? 0} • Errors: ${traffic?.errors ?? 0}`);
}

function renderTraffic(overview) {
	const tbody = document.getElementById("trafficRows");
	if (!tbody) return;
	tbody.innerHTML = "";
	const byGroup = overview?.traffic?.byGroup || {};
	const entries = Object.entries(byGroup).sort((a, b) => Number(b[1]) - Number(a[1]));
	for (const [group, count] of entries) {
		const tr = document.createElement("tr");
		tr.innerHTML = `<td>${group}</td><td>${count}</td>`;
		tbody.appendChild(tr);
	}
}

function setActiveTab(tab) {
	const tabs = [
		{ key: "users", tabId: "tabUsers", viewId: "viewUsers" },
		{ key: "files", tabId: "tabFiles", viewId: "viewFiles" },
		{ key: "shares", tabId: "tabShares", viewId: "viewShares" }
	];
	for (const t of tabs) {
		const tabEl = document.getElementById(t.tabId);
		const viewEl = document.getElementById(t.viewId);
		const isActive = t.key === tab;
		if (tabEl) tabEl.setAttribute("aria-selected", isActive ? "true" : "false");
		if (viewEl) viewEl.classList.toggle("is-active", isActive);
	}
}

function renderUsers(users) {
	const tbody = document.getElementById("usersRows");
	if (!tbody) return;
	if (tbody.children.length === 1 && tbody.querySelector(".row--muted")) {
		tbody.innerHTML = "";
	}
	for (const u of users || []) {
		const uid = String(u.uid || "");
		const isDisabled = Boolean(u.disabled);
		const tr = document.createElement("tr");
		tr.innerHTML =
			`<td>${escapeHtml(u.email || "")}</td>` +
			`<td>${escapeHtml(u.uid || "")}</td>` +
			`<td>${u.emailVerified ? "Yes" : "No"}</td>` +
			`<td>${isDisabled ? "Yes" : "No"}</td>` +
			`<td><button class="btn btn--sm ${isDisabled ? "" : "btn--danger"}" data-action="toggle-user" data-uid="${escapeHtml(uid)}" data-disabled="${isDisabled ? "1" : "0"}">${isDisabled ? "Enable" : "Disable"}</button></td>` +
			`<td>${escapeHtml(u.createdAt || "")}</td>` +
			`<td>${escapeHtml(u.lastSignInAt || "")}</td>`;
		tbody.appendChild(tr);
	}
	state.usersLoaded = tbody.childElementCount;
	setCount("usersCount", state.usersNextPageToken ? `${state.usersLoaded}+` : state.usersLoaded);
}

function renderFiles(items) {
	const tbody = document.getElementById("filesRows");
	if (!tbody) return;
	tbody.innerHTML = "";
	for (const f of items || []) {
		const id = String(f.id || "");
		const tr = document.createElement("tr");
		tr.innerHTML =
			`<td title="${escapeHtml(f.id)}">${escapeHtml(f.originalName || "")}</td>` +
			`<td>${escapeHtml(f.ownerUid || "")}</td>` +
			`<td>${escapeHtml(bytesToHuman(f.size || 0))}</td>` +
			`<td>${escapeHtml((f.encryptionMode || "").toUpperCase())}</td>` +
			`<td>${f.ownerDeletedAt ? "Yes" : "No"}</td>` +
			`<td><button class="btn btn--sm btn--danger" data-action="delete-file" data-file-id="${escapeHtml(id)}">Delete</button></td>` +
			`<td>${escapeHtml(f.createdAt || "")}</td>`;
		tbody.appendChild(tr);
	}
	state.filesLoaded = tbody.childElementCount;
	setCount(
		"filesCount",
		typeof state.filesTotal === "number" ? `${state.filesLoaded}/${state.filesTotal}` : state.filesLoaded
	);
}

function renderShares(items) {
	const tbody = document.getElementById("sharesRows");
	if (!tbody) return;
	tbody.innerHTML = "";
	for (const s of items || []) {
		const id = String(s.id || "");
		const tr = document.createElement("tr");
		tr.innerHTML =
			`<td>${escapeHtml(s.recipientEmail || "")}</td>` +
			`<td>${escapeHtml(s.senderEmail || "")}</td>` +
			`<td title="${escapeHtml(s.id)}">${escapeHtml(s.fileId || "")}</td>` +
			`<td>${escapeHtml(s.ownerUid || "")}</td>` +
			`<td><button class="btn btn--sm btn--danger" data-action="revoke-share" data-share-id="${escapeHtml(id)}">Revoke</button></td>` +
			`<td>${escapeHtml(s.createdAt || "")}</td>`;
		tbody.appendChild(tr);
	}
	state.sharesLoaded = tbody.childElementCount;
	setCount(
		"sharesCount",
		typeof state.sharesTotal === "number" ? `${state.sharesLoaded}/${state.sharesTotal}` : state.sharesLoaded
	);
}

async function toggleUserDisabled(uid, willDisable) {
	const res = await apiFetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ disabled: Boolean(willDisable) })
	});
	const j = await res.json().catch(() => null);
	if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
	return j;
}

async function revokeShare(shareId) {
	const res = await apiFetch(`/api/admin/shares/${encodeURIComponent(shareId)}`, { method: "DELETE" });
	const j = await res.json().catch(() => null);
	if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
	return j;
}

async function deleteFile(fileId) {
	const res = await apiFetch(`/api/admin/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
	const j = await res.json().catch(() => null);
	if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
	return j;
}

function setText(id, text) {
	const el = document.getElementById(id);
	if (!el) return;
	el.textContent = String(text ?? "");
}

function setCount(id, n) {
	setText(id, n == null ? "—" : String(n));
}

function renderEmptyRow(tbody, colCount, message) {
	if (!tbody) return;
	tbody.innerHTML = "";
	const tr = document.createElement("tr");
	tr.className = "row--muted";
	const td = document.createElement("td");
	td.colSpan = colCount;
	td.textContent = String(message || "");
	tr.appendChild(td);
	tbody.appendChild(tr);
}

function setUsersMoreEnabled(enabled) {
	const btn = document.getElementById("usersMoreBtn");
	if (!btn) return;
	btn.disabled = !enabled;
}

async function loadUsers({ append = false } = {}) {
	setText("usersStatus", append ? "Loading more users…" : "Loading users…");
	const token = append ? state.usersNextPageToken : null;
	const url = token
		? `/api/admin/users?maxResults=100&pageToken=${encodeURIComponent(token)}`
		: "/api/admin/users?maxResults=100";
	if (!append) {
		renderEmptyRow(document.getElementById("usersRows"), 7, "Loading users…");
		state.usersLoaded = 0;
		state.usersTotal = null;
		state.usersNextPageToken = null;
		setCount("usersCount", "Loading…");
		setUsersMoreEnabled(false);
	}
	const res = await apiFetch(url);
	const j = await res.json().catch(() => null);
	if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
	if (!append) {
		const tbody = document.getElementById("usersRows");
		if (tbody) tbody.innerHTML = "";
		state.usersLoaded = 0;
	}
	renderUsers(j?.users || []);
	state.usersNextPageToken = j?.nextPageToken || null;
	setUsersMoreEnabled(Boolean(state.usersNextPageToken));
	if (state.usersLoaded === 0) {
		renderEmptyRow(document.getElementById("usersRows"), 7, "No users found.");
		setCount("usersCount", 0);
	}
	setText(
		"usersStatus",
		state.usersNextPageToken ? `Loaded ${state.usersLoaded}. More available.` : `Loaded ${state.usersLoaded}.`
	);
}

async function lookupUserByEmail(email) {
	const q = String(email || "").trim();
	if (!q) throw new Error("Enter an email");
	setText("usersStatus", `Looking up ${q}…`);
	const res = await apiFetch(`/api/admin/users/by-email?email=${encodeURIComponent(q)}`);
	const j = await res.json().catch(() => null);
	if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
	const tbody = document.getElementById("usersRows");
	if (tbody) tbody.innerHTML = "";
	renderUsers(j?.user ? [j.user] : []);
	state.usersNextPageToken = null;
	setUsersMoreEnabled(false);
	if (!j?.user) {
		renderEmptyRow(document.getElementById("usersRows"), 7, "No user found for that email.");
		setCount("usersCount", 0);
		setText("usersStatus", "No results.");
		return;
	}
	setText("usersStatus", "Showing 1 result.");
}

async function loadFiles() {
	setText("filesStatus", "Loading files…");
	renderEmptyRow(document.getElementById("filesRows"), 7, "Loading files…");
	state.filesTotal = null;
	setCount("filesCount", "Loading…");
	const q = String(document.getElementById("filesQuery")?.value || "").trim();
	const url = q ? `/api/admin/files?limit=100&skip=0&q=${encodeURIComponent(q)}` : "/api/admin/files?limit=100&skip=0";
	const res = await apiFetch(url);
	const j = await res.json().catch(() => null);
	if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
	state.filesTotal = typeof j?.total === "number" ? j.total : null;
	renderFiles(j?.items || []);
	if (state.filesLoaded === 0) {
		renderEmptyRow(document.getElementById("filesRows"), 7, "No files found.");
		setCount("filesCount", 0);
	}
	setText(
		"filesStatus",
		typeof state.filesTotal === "number"
			? `Loaded ${state.filesLoaded} of ${state.filesTotal}.`
			: `Loaded ${state.filesLoaded}.`
	);
}

async function loadShares() {
	setText("sharesStatus", "Loading shares…");
	renderEmptyRow(document.getElementById("sharesRows"), 6, "Loading shares…");
	state.sharesTotal = null;
	setCount("sharesCount", "Loading…");
	const q = String(document.getElementById("sharesQuery")?.value || "").trim();
	const url = q ? `/api/admin/shares?limit=100&skip=0&q=${encodeURIComponent(q)}` : "/api/admin/shares?limit=100&skip=0";
	const res = await apiFetch(url);
	const j = await res.json().catch(() => null);
	if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
	state.sharesTotal = typeof j?.total === "number" ? j.total : null;
	renderShares(j?.items || []);
	if (state.sharesLoaded === 0) {
		renderEmptyRow(document.getElementById("sharesRows"), 6, "No shares found.");
		setCount("sharesCount", 0);
	}
	setText(
		"sharesStatus",
		typeof state.sharesTotal === "number"
			? `Loaded ${state.sharesLoaded} of ${state.sharesTotal}.`
			: `Loaded ${state.sharesLoaded}.`
	);
}

async function loadAllAdminData() {
	setText("usersStatus", "Loading…");
	setText("filesStatus", "Loading…");
	setText("sharesStatus", "Loading…");

	const results = await Promise.allSettled([loadUsers({ append: false }), loadFiles(), loadShares()]);
	const [u, f, s] = results;
	if (u.status === "rejected") setText("usersStatus", String(u.reason?.message || u.reason || "Failed"));
	if (f.status === "rejected") setText("filesStatus", String(f.reason?.message || f.reason || "Failed"));
	if (s.status === "rejected") setText("sharesStatus", String(s.reason?.message || s.reason || "Failed"));
}

async function refreshOverview() {
	const subtitle = document.getElementById("subtitle");
	try {
		subtitle.textContent = `API: ${API_BASE || "(same-origin)"} • Checking access…`;
		const accessRes = await apiFetch("/api/admin/access");
		const access = await accessRes.json().catch(() => null);
		if (!accessRes.ok) throw new Error(access?.error || "Failed to check admin access");
		if (!access?.isAdmin) {
			subtitle.textContent = "You are not an admin for this site.";
			return false;
		}

		subtitle.textContent = "Loading admin metrics…";
		const res = await apiFetch("/api/admin/overview");
		const j = await res.json().catch(() => null);
		if (!res.ok) throw new Error(j?.error || `Request failed (${res.status})`);

		subtitle.textContent = `Updated • Uptime ${j?.traffic?.uptimeSeconds ?? "?"}s • Started ${j?.traffic?.startedAt ?? ""}`;
		renderCards(j);
		renderTraffic(j);
		return true;
	} catch (e) {
		const msg = String(e?.message || e || "Failed");
		subtitle.textContent = msg;
		return false;
	}
}

function wireUi() {
	const themeBtn = document.getElementById("themeToggle");
	if (themeBtn) {
		themeBtn.addEventListener("click", () => {
			setTheme(getTheme() === "dark" ? "light" : "dark");
		});
	}

	const refreshBtn = document.getElementById("refreshBtn");
	if (refreshBtn) {
		refreshBtn.addEventListener("click", () => {
			void refreshOverview().then((ok) => {
				if (ok) void loadAllAdminData();
			});
		});
	}

	const tabUsers = document.getElementById("tabUsers");
	const tabFiles = document.getElementById("tabFiles");
	const tabShares = document.getElementById("tabShares");
	if (tabUsers) tabUsers.addEventListener("click", () => setActiveTab("users"));
	if (tabFiles) tabFiles.addEventListener("click", () => setActiveTab("files"));
	if (tabShares) tabShares.addEventListener("click", () => setActiveTab("shares"));

	const usersLoadBtn = document.getElementById("usersLoadBtn");
	if (usersLoadBtn) {
		usersLoadBtn.addEventListener("click", () =>
			void loadUsers({ append: false }).catch((e) => setSubtitle(escapeHtml(String(e?.message || e))))
		);
	}
	const usersMoreBtn = document.getElementById("usersMoreBtn");
	if (usersMoreBtn) {
		usersMoreBtn.addEventListener("click", () =>
			void loadUsers({ append: true }).catch((e) => setSubtitle(escapeHtml(String(e?.message || e))))
		);
	}
	const userLookupBtn = document.getElementById("userLookupBtn");
	if (userLookupBtn) {
		userLookupBtn.addEventListener("click", () => {
			const email = document.getElementById("userEmail")?.value;
			void lookupUserByEmail(email).catch((e) => setSubtitle(escapeHtml(String(e?.message || e))));
		});
	}

	const filesLoadBtn = document.getElementById("filesLoadBtn");
	if (filesLoadBtn) {
		filesLoadBtn.addEventListener("click", () =>
			void loadFiles().catch((e) => setSubtitle(escapeHtml(String(e?.message || e))))
		);
	}

	const sharesLoadBtn = document.getElementById("sharesLoadBtn");
	if (sharesLoadBtn) {
		sharesLoadBtn.addEventListener("click", () =>
			void loadShares().catch((e) => setSubtitle(escapeHtml(String(e?.message || e))))
		);
	}

	// Table actions via event delegation
	const usersRows = document.getElementById("usersRows");
	if (usersRows) {
		usersRows.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const btn = target.closest("button[data-action='toggle-user']");
			if (!(btn instanceof HTMLButtonElement)) return;
			const uid = btn.getAttribute("data-uid") || "";
			const disabled = btn.getAttribute("data-disabled") === "1";
			const nextDisabled = !disabled;
			const ok = confirm(`${nextDisabled ? "Disable" : "Enable"} user ${uid}?`);
			if (!ok) return;
			void toggleUserDisabled(uid, nextDisabled)
				.then(() => loadUsers({ append: false }))
				.catch((e) => setSubtitle(escapeHtml(String(e?.message || e))));
		});
	}

	const sharesRows = document.getElementById("sharesRows");
	if (sharesRows) {
		sharesRows.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const btn = target.closest("button[data-action='revoke-share']");
			if (!(btn instanceof HTMLButtonElement)) return;
			const shareId = btn.getAttribute("data-share-id") || "";
			const ok = confirm(`Revoke share ${shareId}?`);
			if (!ok) return;
			void revokeShare(shareId)
				.then(() => loadShares())
				.catch((e) => setSubtitle(escapeHtml(String(e?.message || e))));
		});
	}

	const filesRows = document.getElementById("filesRows");
	if (filesRows) {
		filesRows.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const btn = target.closest("button[data-action='delete-file']");
			if (!(btn instanceof HTMLButtonElement)) return;
			const fileId = btn.getAttribute("data-file-id") || "";
			const ok = confirm(`Permanently delete file ${fileId}? This removes bytes + DB records.`);
			if (!ok) return;
			void deleteFile(fileId)
				.then(() => loadFiles())
				.catch((e) => setSubtitle(escapeHtml(String(e?.message || e))));
		});
	}
}

wireUi();

function setSubtitle(html) {
	const subtitle = document.getElementById("subtitle");
	if (!subtitle) return;
	subtitle.innerHTML = html;
}

function showSignedOutHelp() {
	setSubtitle(
		`Not signed in in this tab. <a href="index.html">Go to login</a> and then open <strong>admin.html</strong> again.<br/>` +
		`Tip: use the same hostname (either <strong>localhost</strong> everywhere or <strong>127.0.0.1</strong> everywhere). If you opened Admin in a new tab, session login may not carry over.`
	);
}

onAuthStateChanged(auth, (user) => {
	(async () => {
		if (!user) {
			showSignedOutHelp();
			return;
		}

		try {
			await reload(user);
		} catch {
			// ignore
		}

		if (!user.emailVerified) {
			try {
				await signOut(auth);
			} catch {
				// ignore
			}
			setSubtitle(
				`Email not verified. <a href="index.html?verify=1">Go to verification</a> then refresh this page.`
			);
			return;
		}

		await refreshOverview();
		setActiveTab("users");
		setCount("usersCount", null);
		setCount("filesCount", null);
		setCount("sharesCount", null);
		setUsersMoreEnabled(false);
		void loadAllAdminData();
	})();
});
