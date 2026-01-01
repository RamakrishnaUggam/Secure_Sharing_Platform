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

	/**
	 * Shows a custom email popup.
	 * @param {{ title?: string, description?: string, defaultEmail?: string }} opts
	 * @returns {Promise<string|null>} resolved email, or null if cancelled
	 */
	window.showShareEmailPopup = function showShareEmailPopup(opts = {}) {
		injectStylesOnce();
		const title = String(opts.title || "Share file");
		const description = String(opts.description || "Enter the recipient email.");
		const defaultEmail = String(opts.defaultEmail || "");

		return new Promise((resolve) => {
			const backdrop = document.createElement("div");
			backdrop.className = "share-popup__backdrop";
			backdrop.setAttribute("role", "dialog");
			backdrop.setAttribute("aria-modal", "true");

			const card = document.createElement("div");
			card.className = "share-popup__card";

			const titleEl = document.createElement("div");
			titleEl.className = "share-popup__title";
			titleEl.textContent = title;

			const descEl = document.createElement("div");
			descEl.className = "share-popup__desc";
			descEl.textContent = description;

			const input = document.createElement("input");
			input.className = "share-popup__input";
			input.type = "email";
			input.placeholder = "recipient@email.com";
			input.value = defaultEmail;
			input.autocomplete = "email";
			input.inputMode = "email";
			input.spellcheck = false;
			input.setAttribute("aria-label", "Recipient email");

			const row = document.createElement("div");
			row.className = "share-popup__row";

			const cancelBtn = createButton("btn btn--sm", "Cancel");
			const sendBtn = createButton("btn btn--primary btn--sm", "Send");

			function cleanup(result) {
				document.removeEventListener("keydown", onKeyDown, true);
				backdrop.remove();
				resolve(result);
			}

			function onKeyDown(e) {
				if (e.key === "Escape") {
					e.preventDefault();
					cleanup(null);
					return;
				}
				if (e.key === "Enter") {
					// Let Enter submit.
					e.preventDefault();
					sendBtn.click();
				}
			}

			cancelBtn.addEventListener("click", () => cleanup(null));
			backdrop.addEventListener("click", (e) => {
				if (e.target === backdrop) cleanup(null);
			});
			sendBtn.addEventListener("click", () => {
				const email = normalizeEmail(input.value);
				if (!email || !email.includes("@")) {
					input.focus();
					input.select();
					return;
				}
				cleanup(email);
			});

			document.addEventListener("keydown", onKeyDown, true);

			row.appendChild(cancelBtn);
			row.appendChild(sendBtn);
			card.appendChild(titleEl);
			card.appendChild(descEl);
			card.appendChild(input);
			card.appendChild(row);
			backdrop.appendChild(card);
			document.body.appendChild(backdrop);

			setTimeout(() => input.focus(), 0);
		});
	};
})();
