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
		).slice(0, 50);
		if (!emails.length) return;
		emailDatalistSeq += 1;
		const listId = `share-popup__emails_${emailDatalistSeq}`;
		const dl = document.createElement("datalist");
		dl.id = listId;
		for (const email of emails) {
			const opt = document.createElement("option");
			opt.value = email;
			dl.appendChild(opt);
		}
		inputEl.setAttribute("list", listId);
		try {
			inputEl.parentElement?.appendChild?.(dl);
		} catch {
			// ignore
		}
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
	 * @param {{ title?: string, description?: string, primaryText?: string, placeholder?: string, type?: string, ariaLabel?: string, value?: string }} opts
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
