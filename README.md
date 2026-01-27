# Secure Sharing Platform

A secure file sharing web application where files are encrypted in the **browser** before upload, stored as ciphertext on the server, and shared to other verified users via email.

## Key Features
- Firebase Authentication (email/password) with verified-email enforcement (production)
- Client-side encryption using Web Crypto (AES-GCM)
- File upload/download with integrity verification (SHA-256 of stored ciphertext)
- Direct sharing to verified recipient emails
- Groups with roles (owner/admin/editor/member/viewer) and invite flow
- Admin endpoints for overview metrics and user/file/share listing
- Profile: fullscreen “Storage details” popup (per-account)

## Repository Layout
- `server/` — Node.js/Express API + MongoDB models + disk storage
- `client/` — Vite/React wrapper app (routes legacy pages via iframe)
- Root `*.html`/`*.js` — Legacy static UI (can be hosted directly)
- `docs/` — SDLC + SRS + SDD documents

## Documentation
- SDLC: [docs/SDLC.md](docs/SDLC.md)
- SRS: [docs/SRS.md](docs/SRS.md)
- SDD: [docs/SDD.md](docs/SDD.md)

## Local Setup (Quick Start)

### 1) Install dependencies
From the repo root:
- `npm install`

For the backend:
- `npm --prefix server install`

For the Vite client wrapper:
- `npm --prefix client install`

### 2) Configure backend environment
Create/edit `server/.env` with at least:
- `MONGODB_URI=...`
- `MASTER_KEY_HEX=...` (32 bytes hex / 64 hex chars)
- `STORAGE_DIR=...` (recommended: absolute path to a persistent folder)

For Firebase Admin (production verification):
- `FIREBASE_SERVICE_ACCOUNT_JSON=...` **or** `GOOGLE_APPLICATION_CREDENTIALS=...`

### 3) Run the backend
From repo root:
- `npm --prefix server start`

Health check:
- `http://127.0.0.1:3001/health`

### 4) Run the UI
Option A (legacy static pages):
- Serve the repo root with any static server and open `index.html`.

Option B (Vite wrapper):
- `npm --prefix client run dev`

## Notes / Common Issues
- **“Stored file missing” / “file bytes missing”** means the ciphertext blob on disk can’t be found or fails integrity.
  - Ensure `STORAGE_DIR` points to the same persistent directory across restarts.
  - Old records cannot be recovered unless the original blob file is restored.

## License
Internal/academic project (add a license if you plan to distribute).
