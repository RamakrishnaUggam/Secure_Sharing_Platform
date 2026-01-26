# Secure Sharing Platform — Project Details (Tech + SDLC + SRS)

Date: 2026-01-26

## 1) Project Overview

**Goal:** Provide a secure in-platform file sharing system where files are encrypted in the browser before upload, stored as ciphertext on the server, and shared to other registered users via email-based sharing records.

**High-level behavior:**
- Users register/login using Firebase Authentication and must have a **verified email**.
- Users upload files from the Home dashboard. The UI encrypts files locally (AES-GCM), then uploads ciphertext to the backend.
- The backend stores ciphertext on disk and metadata in MongoDB.
- Owners can share a file with another user by email **only if that email exists in Firebase Auth and is verified**.
- Recipients can download the ciphertext; optionally decrypt locally (requires the key shared out-of-band by the owner).

## 2) Technologies Used

### 2.1 Frontend (Legacy static UI)
- **HTML/CSS/Vanilla JS** (single-page style dashboards in static pages)
- **Firebase Web SDK (Auth)** loaded via CDN (modular v9 APIs)
- **Web Crypto API**
  - AES-GCM for client-side encryption/decryption
  - SHA-256 for integrity hashes
- **Browser Storage**
  - `localStorage` used for theme, API base override, and verification throttling
- **Static hosting** compatible (GitHub Pages is explicitly supported via origin checks)

Legacy pages exist in two places:
- Root-level static pages (for direct static hosting)
- Same pages mirrored under the Vite app at `client/public/legacy/` (embedded via iframe)

### 2.2 Frontend (React/Vite wrapper)
- **React 19**
- **React Router DOM** (routes map to legacy pages)
- **Vite** (dev server + build)

Important note: this React app mainly serves as a router shell that loads legacy pages in an `<iframe>`.

### 2.3 Backend
- **Node.js** (ES Modules)
- **Express** (REST API)
- **CORS** (restricted origins by environment/config)
- **Multer** (file upload handling; in-memory storage)
- **MongoDB + Mongoose** (metadata + share records)
- **Firebase Admin SDK**
  - Verifies Firebase ID tokens for API authentication
  - Checks recipient existence/verification when sharing
  - Admin user listing for admin metrics
- **dotenv** for local environment configuration
- **Filesystem storage**
  - Ciphertext bytes stored on disk under `server/storage/` (or `STORAGE_DIR`)

### 2.4 Cryptography & Security Controls
- **Client-side encryption is the primary mode**.
  - Upload endpoint currently enforces client-side encryption (`encMode=client`) and stores ciphertext as-is.
  - AES-256-GCM is used in the browser with a random IV.
- **Integrity**
  - SHA-256 of stored bytes is computed by backend and stored.
  - Optional SHA-256 of original plaintext can be provided by client and returned on download.
- **Authentication**
  - Firebase Authentication (email/password)
  - Email verification required before access
- **Authorization**
  - Owner access or a ShareRecord (recipient email match)
  - Admin access via configured allow-list

## 3) Repository Structure

- `server/` — Express API, MongoDB models, crypto helpers, storage.
- `client/` — Vite + React wrapper app, serves legacy pages from `public/legacy`.
- Root `*.html` and `*.js` — legacy static app for direct static hosting.

## 4) Backend Architecture

### 4.1 Services/Modules
- `server/src/index.js`
  - Express app boot
  - CORS policy + JSON parsing
  - `/health` and `/api/me`
  - Mounts `/api/files` and `/api/admin`
  - Database connect-with-retry loop
  - Account deletion endpoint `/api/account`

- `server/src/auth.js`
  - Firebase Admin initialization
  - `requireAuth()` middleware: validates Bearer token; enforces email verification
  - `requireAdmin()` middleware: admin email allow-list (or allow-all)

- `server/src/routes.files.js`
  - File list/upload/download/delete
  - Share creation/list/delete
  - Access control: owner OR share recipient

- `server/src/routes.admin.js`
  - Admin access check
  - Metrics/overview aggregate

- `server/src/models/FileRecord.js` and `server/src/models/ShareRecord.js`
  - MongoDB schemas

### 4.2 Data Storage
- **MongoDB** stores metadata only (who owns what, share relationships, hashes, encryption metadata).
- **Disk** stores ciphertext bytes under a generated storage key.

## 5) Data Model (MongoDB)

### 5.1 `FileRecord`
Key fields:
- `ownerUid` (Firebase UID)
- `encryptionMode`: `client` or `server` (UI uses `client`)
- `originalName`, `mimeType`, `size`
- `storagePath` and `storageKey`
- `clientIvB64` (required for client-mode decryption)
- `storedSha256Hex` (integrity hash of ciphertext)
- `originalSha256Hex` (optional hash of plaintext)
- `ownerDeletedAt` (soft-delete for owner if shared)

### 5.2 `ShareRecord`
Key fields:
- `fileId` (ref to `FileRecord`)
- `ownerUid`
- `recipientEmail` (normalized lowercased)
- `senderEmail` (optional)
- `createdByUid`

Uniqueness:
- `(fileId, recipientEmail)` is unique to prevent duplicate shares.

## 6) API Specification (SRS-aligned)

Base URL examples:
- Local: `http://localhost:3001`
- In browser, the UI can be pointed via `?apiBase=...` and stored in `localStorage`.

All `/api/*` endpoints require:
- `Authorization: Bearer <Firebase ID Token>`
- Verified email (enforced by backend)

### 6.1 Health & Identity
- `GET /` — service metadata
- `GET /health` — DB readiness + simple traffic metrics
- `GET /api/me` — returns `{ uid, email }`

### 6.2 Files
- `GET /api/files`
  - Lists files owned by current user that are not owner-deleted.
  - Returns: `id`, `originalName`, `mimeType`, `size`, encryption metadata, and integrity/confidentiality flags.

- `POST /api/files`
  - Upload (multipart `file` field).
  - Current server behavior: **only client-encrypted uploads supported**.
  - Expects form fields like:
    - `encMode=client`
    - `clientIvB64`
    - `originalName`, `mimeType`, `originalSize`
    - `originalSha256Hex` (optional)
  - Stores ciphertext bytes, saves FileRecord.

- `GET /api/files/:id/download`
  - Owner or recipient can download.
  - If encryptionMode is `client`: returns ciphertext with headers:
    - `X-Enc-Mode: client`
    - `X-Client-Iv-B64`
    - `X-Original-Name`, `X-Original-Mime`
    - `X-Stored-Sha256` and optionally `X-Original-Sha256`
  - UI can either save ciphertext or decrypt locally then save.

- `DELETE /api/files/:id`
  - Owner-only delete.
  - If file is shared: marks `ownerDeletedAt` (keeps available for recipients).
  - If not shared: deletes bytes + DB record.

### 6.3 Sharing
- `POST /api/files/:id/share`
  - Owner-only.
  - Body: `{ recipientEmail }`
  - Validates recipient exists in Firebase Auth and email is verified.

- `GET /api/files/shared/with-me`
  - Lists files shared to the user’s email.

- `GET /api/files/shared/by-me`
  - Lists shares created by current user (only for still-owned, not-deleted files).

- `DELETE /api/files/shares/:shareId`
  - Recipient-only; removes a received share.
  - If owner already deleted and this was the last share, backend cleans up file bytes + FileRecord.

### 6.4 Account Deletion
- `DELETE /api/account`
  - Deletes:
    - unshared stored file bytes
    - relevant FileRecord entries
    - shares received by that email
    - shares referencing deleted/unshared files
    - Firebase Auth user (best effort)
  - Preserves shared files for recipients.

### 6.5 Admin
- `GET /api/admin/access` — returns `{ isAdmin }`
- `GET /api/admin/overview` (admin-only)
  - Aggregates files/shares, unique owners, bytes, plus traffic metrics.

## 7) Security Model (What makes it “secure”)

### 7.1 Threats in scope (typical)
- Unauthorized access to file bytes
- Tampering with stored ciphertext
- Sharing to an unregistered email
- Access by unverified accounts

### 7.2 Controls implemented
- **Verified-auth-only API access** via Firebase ID tokens.
- **Recipient verification** for sharing (must exist + verified).
- **Encrypted-at-rest on server** by storing ciphertext bytes (client encryption).
- **Integrity checks** using SHA-256 on stored ciphertext and optional plaintext hash.
- **CORS restrictions** to limit browser origins.

### 7.3 Out-of-band key sharing
- Because uploads are client-encrypted, the platform does not (and should not) store the plaintext key.
- The owner must share the key to the recipient using a separate secure channel.

### 7.4 Known security gaps / recommendations
- Firebase web config is currently hardcoded in the legacy UI (acceptable for Firebase client keys, but still should be environment-managed).
- No rate limiting / abuse protection on API endpoints.
- No malware scanning / content-type enforcement (beyond metadata).
- File size limit is set to 50MB in backend.

## 8) SDLC (Suggested/Documented Process)

This project fits well with an **Agile / Iterative SDLC** (2-week sprints). A realistic SDLC for this system:

1. **Requirements & planning**
   - Define user roles (User, Admin)
   - Define core workflows: register/verify, upload, share, download, delete

2. **Design**
   - Architecture: client-side encryption + API + DB metadata + disk storage
   - Security design: authn/authz, verified email enforcement, sharing constraints
   - Data modeling: FileRecord/ShareRecord schemas
   - API contract definition

3. **Implementation**
   - Frontend pages (legacy) + optional Vite wrapper
   - Backend REST API and middlewares

4. **Testing**
   - Unit tests (recommended additions): crypto helpers, email normalization, auth guards
   - Integration tests: upload/share/download flows
   - Security tests: unauthorized access, share-to-nonexistent user

5. **Deployment**
   - Frontend: GitHub Pages or static host
   - Backend: Render/VM/Docker
   - DB: MongoDB Atlas

6. **Operations & monitoring**
   - Health endpoint + simple traffic metrics exist
   - Recommend logging, alerting, and request tracing

7. **Maintenance**
   - Dependency updates
   - Security review of auth rules and CORS origins

Deliverables per phase:
- Requirements: SRS + API contract
- Design: architecture diagram + threat model
- Implementation: code + environment docs
- Testing: test plan + reports
- Deployment: runbook

## 9) SRS (Software Requirements Specification)

### 9.1 Purpose
Provide a secure file sharing system where ciphertext is stored server-side and only authenticated users can upload/share/download.

### 9.2 Scope
In scope:
- Email/password registration + verification
- Authenticated upload and storage
- Sharing via recipient email (must exist and verified)
- Download encrypted or decrypt locally then download
- Admin overview metrics
- Account deletion

Out of scope:
- Key escrow/recovery
- Public anonymous sharing links
- Full end-to-end key exchange inside the platform

### 9.3 Stakeholders
- End users (upload/share/download)
- Admin users (monitoring/metrics)
- Developers/Operators (deploy + maintain)

### 9.4 User Classes
- **User**: verified Firebase Auth user
- **Admin**: verified user with email present in configured admin allow-list

### 9.5 Functional Requirements (FR)
FR-1 Register user using email/password.
FR-2 Send email verification and block app usage until verified.
FR-3 Login user and maintain session for the browser tab/session.
FR-4 Upload encrypted file ciphertext with metadata (name, mime, size, IV).
FR-5 List files uploaded by the user.
FR-6 Share a file to another user by recipient email.
FR-7 Validate that the recipient email is registered and verified.
FR-8 List files shared with the user.
FR-9 List files shared by the user.
FR-10 Download file:
- FR-10a Save ciphertext as-is.
- FR-10b If client-encrypted, decrypt locally with provided key and save plaintext.
FR-11 Delete a file:
- FR-11a If not shared, delete file bytes and metadata.
- FR-11b If shared, hide for owner but keep for recipients.
FR-12 Recipient can remove a received share.
FR-13 If all shares are removed and owner has deleted, clean up stored bytes.
FR-14 Provide admin overview metrics (users/files/shares/traffic).
FR-15 Allow user account deletion and cleanup.

### 9.6 Non-Functional Requirements (NFR)
Security:
- NFR-S1 All API requests must require a valid Firebase ID token.
- NFR-S2 Only verified-email accounts may access file APIs.
- NFR-S3 Sharing must be restricted to registered+verified recipient emails.
- NFR-S4 Stored file bytes must be ciphertext for client encryption mode.
- NFR-S5 Integrity hashes must be computed/validated on download.

Performance:
- NFR-P1 Upload up to 50MB per file.
- NFR-P2 Reasonable response times for list/download under typical network conditions.

Reliability:
- NFR-R1 Backend should start even if DB is temporarily down; retry until DB returns.
- NFR-R2 Health endpoint should report DB readiness.

Usability:
- NFR-U1 Clear error messages for login/verification and share errors.
- NFR-U2 Provide theme toggle and consistent UI feedback.

Maintainability:
- NFR-M1 Configuration must be environment-driven for backend.
- NFR-M2 API routes should be modular.

### 9.7 External Interface Requirements
- Firebase Auth (client) for login/registration.
- Firebase Admin (server) for token verification and user lookup.
- MongoDB for metadata.

### 9.8 Assumptions & Dependencies
- Users can securely exchange encryption keys out-of-band.
- MongoDB is reachable and configured.
- Firebase project is configured with authorized domains.

## 10) Local Setup / How to Run

### 10.1 Backend
1. Install dependencies:
   - `cd server`
   - `npm install`
2. Configure environment variables (example `.env` in `server/`):
   - `MONGODB_URI=...`
   - `MASTER_KEY_HEX=<64 hex chars (32 bytes)>`
   - `ADMIN_EMAILS=a@b.com,c@d.com` (optional)
   - `ADMIN_ALLOW_ALL=1` (optional, dev only)
   - `FIREBASE_SERVICE_ACCOUNT_JSON={...}` or set `GOOGLE_APPLICATION_CREDENTIALS` (recommended)
3. Run:
   - `npm run dev`

### 10.2 Static legacy frontend (root)
- From repo root:
  - `npm install`
  - `npm run dev:web` (serves on `http://localhost:8000`)

### 10.3 One-command dev (API + static)
- From repo root:
  - `npm install`
  - `npm run dev` (runs backend + static server)

### 10.4 Vite/React wrapper
- `cd client`
- `npm install`
- `npm run dev`

## 11) Suggested Enhancements (Roadmap)
- Add automated tests (unit + integration).
- Add rate limiting, request validation, and structured logging.
- Add file scanning or content policies.
- Replace hardcoded Firebase web config with environment-injected config.
- Consider replacing iframe wrapper with a native React UI.
