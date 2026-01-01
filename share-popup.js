(function () {
	"use strict";

	function injectStylesOnce() {
		if (document.getElementById("sharePopupStyles")) return;
		const style = document.createElement("style");
		style.id = "sharePopupStyles";
		style.textContent = `
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
	 * Shows a custom email popup.
	 * @param {{ title?: string, description?: string, defaultEmail?: string }} opts
	 * @returns {Promise<string|null>} resolved email, or null if cancelled
	 */
	window.showShareEmailPopup = function showShareEmailPopup(opts = {}) {
		const title = String(opts.title || "Share file");
		const description = String(opts.description || "Enter the recipient email.");
		const defaultEmail = String(opts.defaultEmail || "");

		const stack = document.createElement("div");
		stack.className = "share-popup__stack";
		const input = createInput({
			type: "email",
			placeholder: "recipient@email.com",
			value: defaultEmail,
			ariaLabel: "Recipient email"
		});
		input.autocomplete = "email";
		input.inputMode = "email";
		input.spellcheck = false;
		stack.appendChild(input);

		return showPopup({
			title,
			description,
			primaryText: "Send",
			bodyEl: stack,
			initialFocusEl: input,
			onSubmit() {
				const email = normalizeEmail(input.value);
				if (!email || !email.includes("@")) {
					input.focus();
					input.select();
					return null;
				}
				return email;
			}
		});
	};

	/**
	 * Shows a popup to ask for passphrase (used for encrypting uploads or decrypting downloads).
	 * @param {{ title?: string, description?: string }} opts
	 * @returns {Promise<string|null>}
	 */
	window.showPassphrasePopup = function showPassphrasePopup(opts = {}) {
		const title = String(opts.title || "Passphrase");
		const description = String(opts.description || "Enter passphrase.");

		const stack = document.createElement("div");
		stack.className = "share-popup__stack";
		const input = createInput({
			type: "password",
			placeholder: "Enter passphrase",
			value: "",
			ariaLabel: "Passphrase"
		});
		stack.appendChild(input);

		return showPopup({
			title,
			description,
			primaryText: "Continue",
			bodyEl: stack,
			initialFocusEl: input,
			onSubmit() {
				const pass = String(input.value || "").trim();
				if (!pass) {
					input.focus();
					return null;
				}
				return pass;
			}
		});
	};

	/**
	 * Popup to send: email + (attach a new file with passphrase OR select an existing uploaded file).
	 * @param {{ uploaded?: Array<{id: string, originalName?: string}> }} opts
	 * @returns {Promise<null | { recipientEmail: string, mode: 'attach'|'existing', file?: File, fileId?: string, passphrase?: string }>} 
	 */
	window.showSendFilePopup = function showSendFilePopup(opts = {}) {
		const uploaded = Array.isArray(opts.uploaded) ? opts.uploaded : [];
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

			const modeRow = document.createElement("div");
			modeRow.className = "share-popup__radioRow";
			const attachId = `sharePopupAttach_${Math.random().toString(16).slice(2)}`;
			const existingId = `sharePopupExisting_${Math.random().toString(16).slice(2)}`;
			modeRow.innerHTML = `
				<label><input type="radio" name="sendMode" value="attach" id="${attachId}" checked /> Attach new file</label>
				<label><input type="radio" name="sendMode" value="existing" id="${existingId}" /> Use uploaded file</label>
			`;

			const attachField = document.createElement("div");
			attachField.className = "share-popup__field";
			const attachLabel = document.createElement("div");
			attachLabel.className = "share-popup__label";
			attachLabel.textContent = "Attach file";
			const fileInput = document.createElement("input");
			fileInput.className = "share-popup__input";
			fileInput.type = "file";
			fileInput.setAttribute("aria-label", "Attach a file");
			const passLabel = document.createElement("div");
			passLabel.className = "share-popup__label";
			passLabel.textContent = "Passphrase";
			const passInput = createInput({
				type: "password",
				placeholder: "Passphrase to encrypt",
				value: "",
				ariaLabel: "Passphrase"
			});
			attachField.appendChild(attachLabel);
			attachField.appendChild(fileInput);
			attachField.appendChild(passLabel);
			attachField.appendChild(passInput);

			const existingField = document.createElement("div");
			existingField.className = "share-popup__field";
			const existingLabel = document.createElement("div");
			existingLabel.className = "share-popup__label";
			existingLabel.textContent = "Uploaded file";
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
			existingField.appendChild(existingLabel);
			existingField.appendChild(select);

			function syncMode() {
				const mode = stack.querySelector('input[name="sendMode"]:checked')?.value || "attach";
				attachField.style.display = mode === "attach" ? "grid" : "none";
				existingField.style.display = mode === "existing" ? "grid" : "none";
			}
			stack.addEventListener("change", (e) => {
				const t = e.target;
				if (t && t.name === "sendMode") syncMode();
			});
			syncMode();

			stack.appendChild(emailField);
			stack.appendChild(modeRow);
			stack.appendChild(attachField);
			stack.appendChild(existingField);

		return showPopup({
			title: "Send file",
			description: "Share encrypted files by email.",
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

				const mode = stack.querySelector('input[name="sendMode"]:checked')?.value || "attach";
				if (mode === "existing") {
					const fileId = String(select.value || "").trim();
					if (!fileId) {
						select.focus();
						return null;
					}
					return { recipientEmail, mode: "existing", fileId };
				}

				const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
				if (!file) {
					fileInput.focus();
					return null;
				}
				const passphrase = String(passInput.value || "").trim();
				if (!passphrase) {
					passInput.focus();
					return null;
				}
				return { recipientEmail, mode: "attach", file, passphrase };
			}
		});
	};
})();
