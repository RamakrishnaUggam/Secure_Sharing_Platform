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
	 * @param {{ uploaded?: Array<{id: string, originalName?: string}>, defaultFileId?: string }} opts
	 * @returns {Promise<null | { recipientEmail: string, fileId: string }>} 
	 */
	window.showSharePopup = function showSharePopup(opts = {}) {
		const uploaded = Array.isArray(opts.uploaded) ? opts.uploaded : [];
		const defaultFileId = String(opts.defaultFileId || "").trim();

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
			value: "",
			ariaLabel: "Recipient email"
		});
		emailInput.autocomplete = "email";
		emailInput.inputMode = "email";
		emailInput.spellcheck = false;
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

		return showPopup({
			title: "Share file",
			description: "Enter recipient mail, select file and send.",
			primaryText: "Send",
			bodyEl: stack,
			initialFocusEl: emailInput,
			onSubmit() {
				const recipientEmail = normalizeEmail(emailInput.value);
				if (!recipientEmail || !recipientEmail.includes("@")) {
					emailInput.focus();
					emailInput.select();
					return null;
				}
				const fileId = String(select.value || "").trim();
				if (!fileId) {
					select.focus();
					return null;
				}
				return { recipientEmail, fileId };
			}
		});
	};
})();
