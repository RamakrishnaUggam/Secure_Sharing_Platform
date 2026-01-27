(function () {
	"use strict";

	function injectStylesOnce() {
		if (document.getElementById("sharePopupStyles")) return;
		const style = document.createElement("style");
		style.id = "sharePopupStyles";
		style.textContent = `
			.share-toast__wrap {
				position: fixed;
				left: 50%;
				top: 18px;
				transform: translateX(-50%);
				z-index: 10000;
				pointer-events: none;
				padding: 0 18px;
				width: min(680px, 96vw);
			}

			.share-toast__card {
				pointer-events: none;
				width: 100%;
				background: linear-gradient(180deg, var(--card, rgba(255,255,255,0.08)), var(--card-2, rgba(255,255,255,0.045)));
				border: 1px solid var(--card-border, rgba(255,255,255,0.14));
				border-radius: 14px;
				box-shadow: var(--shadow, 0 38px 110px rgba(0, 0, 0, 0.62));
				backdrop-filter: blur(12px);
				padding: 12px 14px;
				position: relative;
				overflow: hidden;
				opacity: 0;
				transform: translateY(8px);
				transition: opacity 140ms ease, transform 140ms ease;
			}

			.share-toast__card::before {
				content: "";
				position: absolute;
				inset: 0;
				border-radius: 14px;
				pointer-events: none;
				box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.10);
			}

			.share-toast__card.is-visible {
				opacity: 1;
				transform: translateY(0);
			}

			.share-toast__text {
				font-size: 13px;
				opacity: 0.98;
				font-weight: 600;
			}

			.share-popup__backdrop {
				position: fixed;
				inset: 0;
				background: rgba(0, 0, 0, 0.55);
				backdrop-filter: blur(6px);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 9999;
				padding: 18px;
			}

			.share-popup__card {
				width: min(520px, 92vw);
				background: var(--card, rgba(255,255,255,0.08));
				border: 1px solid var(--card-border, rgba(255,255,255,0.14));
				border-radius: 14px;
				box-shadow: var(--shadow, 0 38px 110px rgba(0, 0, 0, 0.62));
				padding: 16px;
			}

			.share-popup__title {
				font-weight: 600;
				margin-bottom: 8px;
			}

			.share-popup__desc {
				font-size: 13px;
				opacity: 0.8;
				margin-bottom: 12px;
			}

			.share-popup__row {
				display: flex;
				gap: 10px;
				align-items: center;
				justify-content: flex-end;
				margin-top: 12px;
			}

			.share-popup__stack {
				display: grid;
				grid-template-columns: 1fr;
				gap: 10px;
			}

			.share-popup__label {
				font-size: 12px;
				opacity: 0.85;
				margin-bottom: 4px;
			}

			.share-popup__field {
				display: grid;
				grid-template-columns: 1fr;
				gap: 6px;
			}

			.share-popup__radioRow {
				display: flex;
				gap: 12px;
				align-items: center;
				flex-wrap: wrap;
				font-size: 13px;
				opacity: 0.95;
			}

			.share-popup__input {
				width: 100%;
				padding: 12px 12px;
				border-radius: 12px;
				border: 1px solid rgba(255,255,255,0.14);
				background: rgba(255,255,255,0.06);
				color: inherit;
				outline: none;
			}

			html[data-theme="light"] .share-popup__input {
				border-color: rgba(15, 23, 42, 0.12);
				background: rgba(255,255,255,0.8);
			}

			.share-popup__input:focus {
				box-shadow: 0 0 0 4px var(--focus, rgba(34, 211, 238, 0.26));
			}

			.share-popup__card--fullscreen {
				width: min(1100px, 98vw);
				height: min(760px, 94vh);
				max-width: 98vw;
				max-height: 94vh;
				padding: 0;
				overflow: hidden;
			}

			.share-popup__fsHeader {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 12px;
				padding: 14px 14px;
				border-bottom: 1px solid rgba(255,255,255,0.12);
				background: linear-gradient(135deg, rgba(139, 92, 246, 0.14), rgba(34, 211, 238, 0.10));
			}

			html[data-theme="light"] .share-popup__fsHeader {
				border-bottom-color: rgba(15, 23, 42, 0.10);
				background: linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(34, 211, 238, 0.10));
			}

			.share-popup__fsTitle {
				font-weight: 700;
				letter-spacing: 0.2px;
			}

			.share-popup__fsSub {
				font-size: 12px;
				opacity: 0.78;
				margin-top: 2px;
			}

			.share-popup__fsClose {
				width: 38px;
				height: 38px;
				border-radius: 12px;
				border: 1px solid rgba(255,255,255,0.14);
				background: rgba(255,255,255,0.06);
				color: inherit;
				cursor: pointer;
			}

			.share-popup__fsClose:hover {
				background: rgba(255,255,255,0.10);
			}

			.share-popup__fsBody {
				padding: 14px;
				height: calc(100% - 64px);
				overflow: auto;
			}

			.share-popup__stats {
				display: grid;
				grid-template-columns: repeat(3, minmax(0, 1fr));
				gap: 12px;
				margin-bottom: 12px;
			}

			@media (max-width: 720px) {
				.share-popup__stats { grid-template-columns: 1fr; }
			}

			.share-popup__stat {
				border-radius: 14px;
				border: 1px solid var(--card-border, rgba(255,255,255,0.14));
				background: linear-gradient(180deg, var(--card, rgba(255,255,255,0.08)), var(--card-2, rgba(255,255,255,0.045)));
				padding: 12px;
			}

			.share-popup__statLabel {
				font-size: 12px;
				opacity: 0.8;
			}

			.share-popup__statValue {
				margin-top: 6px;
				font-size: 18px;
				font-weight: 700;
			}

			.share-popup__section {
				margin-top: 12px;
			}

			.share-popup__sectionTitle {
				font-weight: 700;
				margin-bottom: 8px;
			}

			.share-popup__list {
				border-radius: 14px;
				border: 1px solid rgba(255,255,255,0.14);
				background: rgba(255,255,255,0.04);
				overflow: hidden;
			}

			html[data-theme="light"] .share-popup__list {
				border-color: rgba(15, 23, 42, 0.12);
				background: rgba(15, 23, 42, 0.03);
			}

			.share-popup__listItem {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 10px;
				padding: 10px 12px;
				border-top: 1px solid rgba(255,255,255,0.10);
				font-size: 13px;
			}

			.share-popup__listItem:first-child { border-top: 0; }

			.share-popup__pill {
				font-size: 11px;
				padding: 6px 10px;
				border-radius: 999px;
				border: 1px solid rgba(255,255,255,0.14);
				background: rgba(255,255,255,0.06);
				opacity: 0.92;
			}

			.share-popup__suggestions {
				border-radius: 12px;
				border: 1px solid rgba(255,255,255,0.14);
				background: rgba(6, 8, 20, 0.62);
				box-shadow: var(--shadow-sm, 0 12px 30px rgba(0,0,0,0.22));
				overflow: hidden;
				max-height: 240px;
				overflow-y: auto;
			}

			html[data-theme="light"] .share-popup__suggestions {
				border-color: rgba(15, 23, 42, 0.12);
				background: rgba(255,255,255,0.92);
			}

			.share-popup__sugItem {
				width: 100%;
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 10px;
				padding: 10px 12px;
				border: 0;
				background: transparent;
				color: inherit;
				text-align: left;
				cursor: pointer;
				font-size: 13px;
				opacity: 0.96;
			}

			.share-popup__sugItem:hover,
			.share-popup__sugItem.is-active {
				background: rgba(255,255,255,0.08);
			}

			html[data-theme="light"] .share-popup__sugItem:hover,
			html[data-theme="light"] .share-popup__sugItem.is-active {
				background: rgba(15, 23, 42, 0.06);
			}
		`;
		document.head.appendChild(style);
	}

	let toastTimer = null;
	let toastWrap = null;
	let toastCard = null;
	let toastText = null;

	/**
	 * Show a lightweight 3s toast (dynamic popup).
	 * @param {string} message
	 * @param {{ durationMs?: number }} [opts]
	 */
	window.showToastPopup = function showToastPopup(message, opts = {}) {
		injectStylesOnce();
		const durationMs = Number.isFinite(opts.durationMs) ? Number(opts.durationMs) : 3000;
		const text = String(message || "").trim();
		if (!text) return;

		if (!toastWrap) {
			toastWrap = document.createElement("div");
			toastWrap.className = "share-toast__wrap";
			toastWrap.setAttribute("aria-live", "polite");
			toastWrap.setAttribute("role", "status");
			toastCard = document.createElement("div");
			toastCard.className = "share-toast__card";
			toastText = document.createElement("div");
			toastText.className = "share-toast__text";
			toastCard.appendChild(toastText);
			toastWrap.appendChild(toastCard);
			document.body.appendChild(toastWrap);
		}

		toastText.textContent = text;
		clearTimeout(toastTimer);
		requestAnimationFrame(() => toastCard.classList.add("is-visible"));
		toastTimer = setTimeout(() => {
			try {
				toastCard.classList.remove("is-visible");
			} catch {
				// ignore
			}
		}, durationMs);
	};

	function normalizeEmail(value) {
		return String(value || "").trim().toLowerCase();
	}

	let emailDatalistSeq = 0;
	function attachEmailSuggestions(inputEl, suggestedEmails) {
		if (!inputEl) return;
		const raw = Array.isArray(suggestedEmails) ? suggestedEmails : [];
		const emails = Array.from(
			new Set(
				raw
					.map((e) => normalizeEmail(e))
					.filter((e) => e && e.includes("@") && e.length <= 254)
			)
		).slice(0, 80);
		if (!emails.length) return;

		// Replace fragile <datalist> UX with an explicit suggestion list.
		const wrap = document.createElement("div");
		wrap.className = "share-popup__suggestions";
		wrap.hidden = true;
		wrap.setAttribute("role", "listbox");

		let activeIndex = -1;
		let blurTimer = null;

		function render() {
			const q = normalizeEmail(inputEl.value);
			const list = emails
				.filter((e) => (q ? e.includes(q) : true))
				.slice(0, 10);
			wrap.innerHTML = "";
			activeIndex = -1;
			if (!list.length || inputEl.disabled) {
				wrap.hidden = true;
				return;
			}
			for (const [idx, email] of list.entries()) {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "share-popup__sugItem";
				btn.textContent = email;
				btn.dataset.email = email;
				btn.setAttribute("role", "option");
				btn.setAttribute("aria-selected", "false");
				btn.addEventListener("mouseenter", () => {
					activeIndex = idx;
					updateActive();
				});
				wrap.appendChild(btn);
			}
			wrap.hidden = false;
		}

		function updateActive() {
			const items = Array.from(wrap.querySelectorAll(".share-popup__sugItem"));
			items.forEach((el, idx) => {
				const isActive = idx === activeIndex;
				el.classList.toggle("is-active", isActive);
				el.setAttribute("aria-selected", isActive ? "true" : "false");
			});
		}

		function pickActive() {
			const items = Array.from(wrap.querySelectorAll(".share-popup__sugItem"));
			const el = activeIndex >= 0 ? items[activeIndex] : null;
			const email = el?.dataset?.email;
			if (!email) return;
			inputEl.value = email;
			wrap.hidden = true;
			try {
				inputEl.dispatchEvent(new Event("input", { bubbles: true }));
			} catch {
				// ignore
			}
		}

		inputEl.insertAdjacentElement("afterend", wrap);

		inputEl.addEventListener("focus", render);
		inputEl.addEventListener("input", render);
		inputEl.addEventListener("blur", () => {
			clearTimeout(blurTimer);
			blurTimer = setTimeout(() => {
				wrap.hidden = true;
			}, 120);
		});
		wrap.addEventListener("mousedown", (e) => {
			// Keep focus so click works reliably.
			e.preventDefault();
			clearTimeout(blurTimer);
		});
		wrap.addEventListener("click", (e) => {
			const btn = e.target?.closest?.(".share-popup__sugItem");
			const email = btn?.dataset?.email;
			if (!email) return;
			inputEl.value = email;
			wrap.hidden = true;
			try {
				inputEl.focus();
			} catch {
				// ignore
			}
			try {
				inputEl.dispatchEvent(new Event("input", { bubbles: true }));
			} catch {
				// ignore
			}
		});
		inputEl.addEventListener("keydown", (e) => {
			if (wrap.hidden) return;
			const items = wrap.querySelectorAll(".share-popup__sugItem");
			if (!items.length) return;
			if (e.key === "ArrowDown") {
				e.preventDefault();
				activeIndex = Math.min(activeIndex + 1, items.length - 1);
				updateActive();
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				activeIndex = Math.max(activeIndex - 1, 0);
				updateActive();
			} else if (e.key === "Enter" && activeIndex >= 0) {
				e.preventDefault();
				pickActive();
			}
		});
	}

	function createButton(className, text) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = className;
		btn.textContent = text;
		return btn;
	}

	function createInput({ type, placeholder, value, ariaLabel }) {
		const input = document.createElement("input");
		input.className = "share-popup__input";
		input.type = type;
		if (placeholder) input.placeholder = placeholder;
		if (value != null) input.value = String(value);
		if (ariaLabel) input.setAttribute("aria-label", ariaLabel);
		return input;
	}

	function showPopup({ title, description, primaryText, bodyEl, initialFocusEl, onSubmit }) {
		injectStylesOnce();
		return new Promise((resolve) => {
			const backdrop = document.createElement("div");
			backdrop.className = "share-popup__backdrop";
			backdrop.setAttribute("role", "dialog");
			backdrop.setAttribute("aria-modal", "true");

			const card = document.createElement("div");
			card.className = "share-popup__card";

			const titleEl = document.createElement("div");
			titleEl.className = "share-popup__title";
			titleEl.textContent = String(title || "");

			const descEl = document.createElement("div");
			descEl.className = "share-popup__desc";
			descEl.textContent = String(description || "");

			const row = document.createElement("div");
			row.className = "share-popup__row";
			const cancelBtn = createButton("btn btn--sm", "Cancel");
			const primaryBtn = createButton("btn btn--primary btn--sm", String(primaryText || "OK"));

			function cleanup(result) {
				document.removeEventListener("keydown", onKeyDown, true);
				backdrop.remove();
				resolve(result);
			}

			function trySubmit() {
				try {
					const result = onSubmit?.();
					if (result == null) return;
					cleanup(result);
				} catch {
					// keep open
				}
			}

			function onKeyDown(e) {
				if (e.key === "Escape") {
					e.preventDefault();
					cleanup(null);
					return;
				}
				if (e.key === "Enter") {
					e.preventDefault();
					trySubmit();
				}
			}

			cancelBtn.addEventListener("click", () => cleanup(null));
			primaryBtn.addEventListener("click", trySubmit);
			backdrop.addEventListener("click", (e) => {
				if (e.target === backdrop) cleanup(null);
			});
			document.addEventListener("keydown", onKeyDown, true);

			row.appendChild(cancelBtn);
			row.appendChild(primaryBtn);
			card.appendChild(titleEl);
			card.appendChild(descEl);
			if (bodyEl) card.appendChild(bodyEl);
			card.appendChild(row);
			backdrop.appendChild(card);
			document.body.appendChild(backdrop);

			setTimeout(() => {
				try {
					initialFocusEl?.focus?.();
				} catch {
					// ignore
				}
			}, 0);
		});
	}

	function formatBytes(bytes) {
		const n = Number(bytes);
		if (!Number.isFinite(n) || n < 0) return "—";
		const units = ["B", "KB", "MB", "GB", "TB"];
		let v = n;
		let i = 0;
		while (v >= 1024 && i < units.length - 1) {
			v /= 1024;
			i += 1;
		}
		const dp = i === 0 ? 0 : v >= 10 ? 1 : 2;
		return `${v.toFixed(dp)} ${units[i]}`;
	}

	function showFullscreenDetails({ title, subtitle, bodyEl }) {
		injectStylesOnce();
		return new Promise((resolve) => {
			const backdrop = document.createElement("div");
			backdrop.className = "share-popup__backdrop";
			backdrop.setAttribute("role", "dialog");
			backdrop.setAttribute("aria-modal", "true");

			const card = document.createElement("div");
			card.className = "share-popup__card share-popup__card--fullscreen";

			const header = document.createElement("div");
			header.className = "share-popup__fsHeader";

			const left = document.createElement("div");
			const t = document.createElement("div");
			t.className = "share-popup__fsTitle";
			t.textContent = String(title || "Details");
			const sub = document.createElement("div");
			sub.className = "share-popup__fsSub";
			sub.textContent = String(subtitle || "");
			left.appendChild(t);
			if (subtitle) left.appendChild(sub);

			const closeBtn = document.createElement("button");
			closeBtn.type = "button";
			closeBtn.className = "share-popup__fsClose";
			closeBtn.setAttribute("aria-label", "Close");
			closeBtn.textContent = "✕";

			const body = document.createElement("div");
			body.className = "share-popup__fsBody";
			if (bodyEl) body.appendChild(bodyEl);

			function cleanup() {
				document.removeEventListener("keydown", onKeyDown, true);
				backdrop.remove();
				resolve(null);
			}

			function onKeyDown(e) {
				if (e.key === "Escape") {
					e.preventDefault();
					cleanup();
				}
			}

			closeBtn.addEventListener("click", cleanup);
			document.addEventListener("keydown", onKeyDown, true);
			backdrop.addEventListener("click", (e) => {
				if (e.target === backdrop) cleanup();
			});

			header.appendChild(left);
			header.appendChild(closeBtn);
			card.appendChild(header);
			card.appendChild(body);
			backdrop.appendChild(card);
			document.body.appendChild(backdrop);
		});
	}

	/**
	 * Fullscreen storage details popup.
	 * @param {{ userEmail?: string, files?: Array<{id?: string, originalName?: string, size?: number}>, contacts?: string[] }} [opts]
	 */
	window.showStorageDetailsPopup = function showStorageDetailsPopup(opts = {}) {
		const userEmail = String(opts.userEmail || "").trim();
		const files = Array.isArray(opts.files) ? opts.files : [];
		const contacts = Array.isArray(opts.contacts) ? opts.contacts : [];

		let totalBytes = 0;
		for (const f of files) {
			const n = Number(f?.size);
			if (Number.isFinite(n) && n >= 0) totalBytes += n;
		}

		const uniqueContacts = Array.from(
			new Set(contacts.map((c) => normalizeEmail(c)).filter((c) => c && c.includes("@")))
		);

		const stats = document.createElement("div");
		stats.className = "share-popup__stats";
		const stat1 = document.createElement("div");
		stat1.className = "share-popup__stat";
		stat1.innerHTML = `<div class="share-popup__statLabel">Storage used (uploads)</div><div class="share-popup__statValue">${formatBytes(totalBytes)}</div>`;
		const stat2 = document.createElement("div");
		stat2.className = "share-popup__stat";
		stat2.innerHTML = `<div class="share-popup__statLabel">Files uploaded</div><div class="share-popup__statValue">${files.length}</div>`;
		const stat3 = document.createElement("div");
		stat3.className = "share-popup__stat";
		stat3.innerHTML = `<div class="share-popup__statLabel">Emails contacted</div><div class="share-popup__statValue">${uniqueContacts.length}</div>`;
		stats.appendChild(stat1);
		stats.appendChild(stat2);
		stats.appendChild(stat3);

		const contactsSection = document.createElement("div");
		contactsSection.className = "share-popup__section";
		const contactsTitle = document.createElement("div");
		contactsTitle.className = "share-popup__sectionTitle";
		contactsTitle.textContent = "Email list";
		const list = document.createElement("div");
		list.className = "share-popup__list";
		if (uniqueContacts.length === 0) {
			const empty = document.createElement("div");
			empty.className = "share-popup__listItem";
			empty.textContent = "No emails yet.";
			list.appendChild(empty);
		} else {
			for (const email of uniqueContacts.sort()) {
				const row = document.createElement("div");
				row.className = "share-popup__listItem";
				const left = document.createElement("div");
				left.textContent = email;
				const pill = document.createElement("div");
				pill.className = "share-popup__pill";
				pill.textContent = "contact";
				row.appendChild(left);
				row.appendChild(pill);
				list.appendChild(row);
			}
		}
		contactsSection.appendChild(contactsTitle);
		contactsSection.appendChild(list);

		const wrap = document.createElement("div");
		wrap.appendChild(stats);
		wrap.appendChild(contactsSection);

		return showFullscreenDetails({
			title: "Storage details",
			subtitle: userEmail ? `Signed in as ${userEmail}` : "",
			bodyEl: wrap
		});
	};

	/**
	 * Generic key popup used for encryption/decryption keys.
	 * @param {{ title?: string, description?: string, primaryText?: string, placeholder?: string }} opts
	 * @returns {Promise<string|null>}
	 */
	window.showKeyPopup = function showKeyPopup(opts = {}) {
		const title = String(opts.title || "Key");
		const description = String(opts.description || "Enter key.");
		const primaryText = String(opts.primaryText || "Continue");
		const placeholder = String(opts.placeholder || "Enter key");

		const stack = document.createElement("div");
		stack.className = "share-popup__stack";
		const input = createInput({
			type: "password",
			placeholder,
			value: "",
			ariaLabel: "Key"
		});
		stack.appendChild(input);

		return showPopup({
			title,
			description,
			primaryText,
			bodyEl: stack,
			initialFocusEl: input,
			onSubmit() {
				const key = String(input.value || "").trim();
				if (!key) {
					input.focus();
					return null;
				}
				return key;
			}
		});
	};

	/**
	 * Generic visible-text popup (useful for email prompts).
	 * @param {{ title?: string, description?: string, primaryText?: string, placeholder?: string, type?: string, ariaLabel?: string, value?: string, suggestedEmails?: string[] }} opts
	 * @returns {Promise<string|null>}
	 */
	window.showTextPopup = function showTextPopup(opts = {}) {
		const title = String(opts.title || "Enter value");
		const description = String(opts.description || "Enter a value.");
		const primaryText = String(opts.primaryText || "Continue");
		const placeholder = String(opts.placeholder || "Enter value");
		const type = String(opts.type || "text");
		const ariaLabel = String(opts.ariaLabel || "Value");
		const value = opts.value != null ? String(opts.value) : "";
		const suggestedEmails = Array.isArray(opts.suggestedEmails) ? opts.suggestedEmails : [];

		const stack = document.createElement("div");
		stack.className = "share-popup__stack";
		const input = createInput({
			type,
			placeholder,
			value,
			ariaLabel
		});
		if (type === "email") {
			input.autocomplete = "email";
			input.inputMode = "email";
			input.spellcheck = false;
			attachEmailSuggestions(input, suggestedEmails);
		}
		stack.appendChild(input);

		return showPopup({
			title,
			description,
			primaryText,
			bodyEl: stack,
			initialFocusEl: input,
			onSubmit() {
				const v = String(input.value || "").trim();
				if (!v) {
					input.focus();
					return null;
				}
				return v;
			}
		});
	};

	// Backwards-compatible alias (older code may still call this).
	window.showPassphrasePopup = function showPassphrasePopup(opts = {}) {
		return window.showKeyPopup({
			title: opts.title || "Key",
			description: opts.description || "Enter key.",
			primaryText: opts.primaryText || "Continue",
			placeholder: opts.placeholder || "Enter key"
		});
	};

	/**
	 * Share popup: recipient email + select file + send.
	 * @param {{ uploaded?: Array<{id: string, originalName?: string}>, defaultFileId?: string, defaultRecipientEmail?: string, lockRecipient?: boolean, defaultComment?: string, suggestedEmails?: string[] }} opts
	 * @returns {Promise<null | { recipientEmail: string, fileId: string, comment?: string }>}
	 */
	window.showSharePopup = function showSharePopup(opts = {}) {
		const uploaded = Array.isArray(opts.uploaded) ? opts.uploaded : [];
		const defaultFileId = String(opts.defaultFileId || "").trim();
		const defaultRecipientEmail = normalizeEmail(opts.defaultRecipientEmail);
		const lockRecipient = Boolean(opts.lockRecipient);
		const defaultComment = String(opts.defaultComment || "");
		const suggestedEmails = Array.isArray(opts.suggestedEmails) ? opts.suggestedEmails : [];

		const stack = document.createElement("div");
		stack.className = "share-popup__stack";

		const emailField = document.createElement("div");
		emailField.className = "share-popup__field";
		const emailLabel = document.createElement("div");
		emailLabel.className = "share-popup__label";
		emailLabel.textContent = "Recipient email";
		const emailInput = createInput({
			type: "email",
			placeholder: "recipient@email.com",
			value: defaultRecipientEmail || "",
			ariaLabel: "Recipient email"
		});
		emailInput.autocomplete = "email";
		emailInput.inputMode = "email";
		emailInput.spellcheck = false;
		attachEmailSuggestions(emailInput, suggestedEmails);
		if (lockRecipient && defaultRecipientEmail) {
			emailInput.disabled = true;
			emailInput.title = "Recipient is locked";
		}
		emailField.appendChild(emailLabel);
		emailField.appendChild(emailInput);

		const fileField = document.createElement("div");
		fileField.className = "share-popup__field";
		const fileLabel = document.createElement("div");
		fileLabel.className = "share-popup__label";
		fileLabel.textContent = "Select file";
		const select = document.createElement("select");
		select.className = "share-popup__input";
		select.setAttribute("aria-label", "Select uploaded file");
		const opt0 = document.createElement("option");
		opt0.value = "";
		opt0.textContent = uploaded.length ? "Select a file" : "No uploaded files";
		select.appendChild(opt0);
		for (const it of uploaded) {
			const opt = document.createElement("option");
			opt.value = String(it.id);
			opt.textContent = String(it.originalName || it.id);
			select.appendChild(opt);
		}
		if (defaultFileId) {
			select.value = defaultFileId;
		}
		fileField.appendChild(fileLabel);
		fileField.appendChild(select);

		stack.appendChild(emailField);
		stack.appendChild(fileField);

		const commentField = document.createElement("div");
		commentField.className = "share-popup__field";
		const commentLabel = document.createElement("div");
		commentLabel.className = "share-popup__label";
		commentLabel.textContent = "Message (optional)";
		const commentInput = createInput({
			type: "text",
			placeholder: "Add a message for the recipient",
			value: defaultComment,
			ariaLabel: "Message"
		});
		commentInput.autocomplete = "off";
		commentField.appendChild(commentLabel);
		commentField.appendChild(commentInput);
		stack.appendChild(commentField);

		return showPopup({
			title: "Share file",
			description: "Enter recipient mail, select file and send.",
			primaryText: "Send",
			bodyEl: stack,
			initialFocusEl: lockRecipient && defaultRecipientEmail ? select : emailInput,
			onSubmit() {
				const recipientEmail = normalizeEmail(emailInput.value);
				if (!recipientEmail || !recipientEmail.includes("@")) {
					if (!emailInput.disabled) {
						emailInput.focus();
						emailInput.select();
					}
					return null;
				}
				const fileId = String(select.value || "").trim();
				if (!fileId) {
					select.focus();
					return null;
				}
					const comment = String(commentInput.value || "").trim();
					return { recipientEmail, fileId, comment };
			}
		});
	};

	/**
	 * Create-group popup.
	 * @returns {Promise<null | { name: string, description: string, expiresAt: string|null }>}
	 */
	window.showGroupCreatePopup = function showGroupCreatePopup() {
		injectStylesOnce();
		const stack = document.createElement("div");
		stack.className = "share-popup__stack";

		function field(labelText, inputEl) {
			const wrap = document.createElement("div");
			wrap.className = "share-popup__field";
			const lab = document.createElement("div");
			lab.className = "share-popup__label";
			lab.textContent = labelText;
			wrap.appendChild(lab);
			wrap.appendChild(inputEl);
			return wrap;
		}

		const nameInput = createInput({ type: "text", placeholder: "Group name (e.g., Marketing_Team)", value: "", ariaLabel: "Group name" });
		nameInput.autocomplete = "off";
		const descInput = createInput({ type: "text", placeholder: "Description (optional)", value: "", ariaLabel: "Group description" });

		const expiresInput = createInput({ type: "datetime-local", placeholder: "", value: "", ariaLabel: "Expiration date" });

		stack.appendChild(field("Group name", nameInput));
		stack.appendChild(field("Description", descInput));
		stack.appendChild(field("Expiration (optional)", expiresInput));

		return showPopup({
			title: "Create group",
			description: "Create a group to share files with multiple users.",
			primaryText: "Create",
			bodyEl: stack,
			initialFocusEl: nameInput,
			onSubmit() {
				const name = String(nameInput.value || "").trim();
				if (!name) {
					nameInput.focus();
					return null;
				}
				const expiresRaw = String(expiresInput.value || "").trim();
				return {
					name,
					description: String(descInput.value || "").trim(),
					expiresAt: expiresRaw ? new Date(expiresRaw).toISOString() : null
				};
			}
		});
	};

	/**
	 * Share-to-group popup.
	 * @param {{ groups: Array<{id: string, name: string, groupType?: string, isExpired?: boolean, isDisabled?: boolean}> }} opts
	 * @returns {Promise<null | { groupId: string, permission: string }>}
	 */
	window.showGroupSharePopup = function showGroupSharePopup(opts = {}) {
		injectStylesOnce();
		const groups = Array.isArray(opts.groups) ? opts.groups : [];
		const stack = document.createElement("div");
		stack.className = "share-popup__stack";

		const groupField = document.createElement("div");
		groupField.className = "share-popup__field";
		const groupLabel = document.createElement("div");
		groupLabel.className = "share-popup__label";
		groupLabel.textContent = "Select group";
		const groupSelect = document.createElement("select");
		groupSelect.className = "share-popup__input";
		groupSelect.setAttribute("aria-label", "Select group");
		const g0 = document.createElement("option");
		g0.value = "";
		g0.textContent = groups.length ? "Select a group" : "No groups";
		groupSelect.appendChild(g0);
		for (const g of groups) {
			if (g?.isExpired || g?.isDisabled) continue;
			const opt = document.createElement("option");
			opt.value = String(g.id);
			opt.textContent = `${String(g.name || g.id)}${g.groupType ? ` (${g.groupType})` : ""}`;
			groupSelect.appendChild(opt);
		}
		groupField.appendChild(groupLabel);
		groupField.appendChild(groupSelect);

		const permField = document.createElement("div");
		permField.className = "share-popup__field";
		const permLabel = document.createElement("div");
		permLabel.className = "share-popup__label";
		permLabel.textContent = "Permission";
		const permSelect = document.createElement("select");
		permSelect.className = "share-popup__input";
		permSelect.setAttribute("aria-label", "Permission");
		for (const p of [
			{ v: "view_only", t: "View-only (no download)" },
			{ v: "download", t: "Download" }
		]) {
			const opt = document.createElement("option");
			opt.value = p.v;
			opt.textContent = p.t;
			permSelect.appendChild(opt);
		}
		permSelect.value = "view_only";
		permField.appendChild(permLabel);
		permField.appendChild(permSelect);

		stack.appendChild(groupField);
		stack.appendChild(permField);

		return showPopup({
			title: "Share to group",
			description: "This will share the selected file(s) with all current group members.",
			primaryText: "Share",
			bodyEl: stack,
			initialFocusEl: groupSelect,
			onSubmit() {
				const groupId = String(groupSelect.value || "").trim();
				if (!groupId) {
					groupSelect.focus();
					return null;
				}
				return { groupId, permission: String(permSelect.value || "view_only") };
			}
		});
	};

	/**
	 * Invite-member popup.
	 * @param {{ suggestedEmails?: string[] }} [opts]
	 * @returns {Promise<null | { email: string, role: string }>}
	 */
	window.showGroupAddMemberPopup = function showGroupAddMemberPopup(opts = {}) {
		injectStylesOnce();
		const suggestedEmails = Array.isArray(opts?.suggestedEmails) ? opts.suggestedEmails : [];
		const stack = document.createElement("div");
		stack.className = "share-popup__stack";

		const emailField = document.createElement("div");
		emailField.className = "share-popup__field";
		const emailLabel = document.createElement("div");
		emailLabel.className = "share-popup__label";
		emailLabel.textContent = "Member email";
		const emailInput = createInput({ type: "email", placeholder: "user@email.com", value: "", ariaLabel: "Member email" });
		emailInput.autocomplete = "email";
		emailInput.inputMode = "email";
		emailInput.spellcheck = false;
		attachEmailSuggestions(emailInput, suggestedEmails);
		emailField.appendChild(emailLabel);
		emailField.appendChild(emailInput);

		const roleField = document.createElement("div");
		roleField.className = "share-popup__field";
		const roleLabel = document.createElement("div");
		roleLabel.className = "share-popup__label";
		roleLabel.textContent = "Role";
		const roleSelect = document.createElement("select");
		roleSelect.className = "share-popup__input";
		roleSelect.setAttribute("aria-label", "Role");
		for (const r of [
			{ v: "viewer", t: "Viewer" },
			{ v: "member", t: "Member" },
			{ v: "editor", t: "Editor" },
			{ v: "admin", t: "Admin" }
		]) {
			const opt = document.createElement("option");
			opt.value = r.v;
			opt.textContent = r.t;
			roleSelect.appendChild(opt);
		}
		roleSelect.value = "member";
		roleField.appendChild(roleLabel);
		roleField.appendChild(roleSelect);

		stack.appendChild(emailField);
		stack.appendChild(roleField);

		return showPopup({
			title: "Invite member",
			description: "An invitation will be created. The user joins after accepting.",
			primaryText: "Invite",
			bodyEl: stack,
			initialFocusEl: emailInput,
			onSubmit() {
				const email = normalizeEmail(emailInput.value);
				if (!email || !email.includes("@")) {
					emailInput.focus();
					emailInput.select();
					return null;
				}
				return { email, role: String(roleSelect.value || "member") };
			}
		});
	};
})();
