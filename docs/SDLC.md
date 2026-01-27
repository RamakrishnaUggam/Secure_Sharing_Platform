# Secure Sharing Platform — SDLC

Date: 2026-01-27

## 1. Purpose
This document defines the Software Development Life Cycle (SDLC) process for the **Secure Sharing Platform**. It clarifies the phases, activities, deliverables, and roles used to plan, build, test, deploy, and maintain the system.

## 2. SDLC Model
**Recommended model:** Agile / Iterative (Sprint-based).

- Work is delivered in small increments.
- Security, privacy, and correctness are validated continuously.
- Documentation (SRS/SDD) is maintained as a living artifact.

## 3. Phases, Activities, and Deliverables

### 3.1 Planning & Requirement Gathering
**Goal:** Define scope, stakeholders, constraints, feasibility.

**Key activities**
- Identify stakeholders: End users, Admin, Developers, QA, Security reviewer.
- Define scope and constraints: Client-side encryption, Firebase auth, MongoDB metadata, disk storage.
- Feasibility checks:
  - Technical: Node/Express + MongoDB + Firebase Admin SDK + Web Crypto.
  - Operational: Persistent storage directory, backup/restore procedures.
  - Security: Access control, verified email enforcement, audit logging.

**Deliverables**
- Project charter / scope statement
- High-level backlog (epics & user stories)
- Risk register (e.g., lost storage blobs, misconfigured keys)

### 3.2 Requirements Analysis (SRS)
**Goal:** Convert stakeholder needs into verifiable requirements.

**Key activities**
- Gather functional requirements: authentication, upload/encrypt, share, download, groups, admin, audit.
- Gather non-functional requirements: security, reliability, performance, usability.
- Define acceptance criteria and testability for each requirement.

**Deliverables**
- SRS document (docs/SRS.md)
- Initial RTM mapping requirements → design/components/tests

### 3.3 Design (SDD)
**Goal:** Convert requirements into a technical blueprint.

**Key activities**
- Architecture design: client (legacy UI + React wrapper) → API server → MongoDB + storage.
- Data design: MongoDB schemas (FileRecord, ShareRecord, Group, GroupInvite, AuditLog).
- Security design: verified identity, authorization, integrity checks, encryption flows.
- API design: endpoints for files/shares/groups/admin.

**Deliverables**
- SDD document (docs/SDD.md)
- Architecture diagrams + sequence diagrams

### 3.4 Development (Implementation)
**Goal:** Build features according to SDD and coding standards.

**Key activities**
- Implement server routes, models, storage utilities, and auth middleware.
- Implement UI flows (upload/share/download), suggestions, and profile “Storage details”.
- Ensure environment configuration is consistent (e.g., stable `STORAGE_DIR`).

**Deliverables**
- Source code
- Developer notes (env vars, local setup)

### 3.5 Testing & Verification
**Goal:** Verify the system meets SRS requirements and is safe to deploy.

**Key activities**
- Functional testing: upload/share/download/delete, group add member (invite/accept), admin overview.
- Security testing:
  - Auth required on `/api/*`
  - Authorization checks (owner/recipient)
  - Verify email checks (production)
- Reliability testing:
  - Missing storage blob behavior (integrity false, clear error)
- Performance checks: metadata requests latency under normal load.

**Deliverables**
- Test plan + test results
- Updated RTM (requirements → tests)

### 3.6 Deployment
**Goal:** Release to an environment used by end users.

**Key activities**
- Configure environment variables:
  - `MONGODB_URI`, `MASTER_KEY_HEX`, `FIREBASE_SERVICE_ACCOUNT_JSON` (or `GOOGLE_APPLICATION_CREDENTIALS`)
  - `STORAGE_DIR` to a persistent location
- Validate readiness endpoints:
  - `GET /health` indicates DB connectivity and config status

**Deliverables**
- Deployment runbook
- Release notes

### 3.7 Maintenance
**Goal:** Keep system reliable and secure over time.

**Key activities**
- Bug fixes and patches
- Monitoring (traffic/health) and backups (DB + storage directory)
- Key rotation strategy (planned change with careful migration)
- Handle data integrity incidents (missing blob recovery or re-upload policy)

**Deliverables**
- Maintenance log
- Incident reports (if applicable)

## 4. Roles and Responsibilities
- **Product Owner / Stakeholder:** approves scope and SRS sign-off.
- **Architect / Lead Developer:** owns SDD and key design decisions.
- **Developers:** implement features and unit tests.
- **QA/Test Engineer:** test plans, functional and regression testing.
- **Security Reviewer:** reviews authn/authz, encryption flows, and logging.
- **Admin/Operator:** manages deployment configuration and monitoring.

## 5. Quality Gates (Exit Criteria)
- Requirements have acceptance criteria and are testable.
- SDD covers architecture, data schema, APIs, and security flows.
- All critical flows pass tests: register/login/verify, upload, share, download, delete.
- No known critical security issues (auth bypass, unauthorized access).
- Deployment configuration validated; storage directory is stable and writable.
