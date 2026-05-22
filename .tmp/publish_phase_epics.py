#!/usr/bin/env python3
"""Publish 3 phase epics and their vertical-slice stories to JIRA FOR project.

Reads .env.local for creds. NOT idempotent — each run creates new issues.
Writes the resulting JIRA keys to .tmp/phase_epic_keys.json.
"""

import base64
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / ".env.local"
OUT_KEYS = ROOT / ".tmp" / "phase_epic_keys.json"

for line in ENV.read_text(encoding="utf-8").splitlines():
    if line.strip() and not line.lstrip().startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

JIRA_BASE_URL = os.environ["JIRA_BASE_URL"].rstrip("/")
JIRA_EMAIL = os.environ["JIRA_EMAIL"]
JIRA_API_TOKEN = os.environ["JIRA_API_TOKEN"]
AUTH = base64.b64encode(f"{JIRA_EMAIL}:{JIRA_API_TOKEN}".encode()).decode()
HEADERS = {
    "Authorization": f"Basic {AUTH}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}
PROJECT = "FOR"


# --- ADF helpers ------------------------------------------------------------

def t(text):
    return {"type": "text", "text": text}


def p(text):
    return {"type": "paragraph", "content": [t(text)] if text else []}


def h(text, level=2):
    return {"type": "heading", "attrs": {"level": level}, "content": [t(text)]}


def bullets(items):
    return {
        "type": "bulletList",
        "content": [
            {"type": "listItem", "content": [p(it)]} for it in items if it
        ],
    }


def tasklist(items, list_id):
    return {
        "type": "taskList",
        "attrs": {"localId": list_id},
        "content": [
            {
                "type": "taskItem",
                "attrs": {"localId": f"{list_id}-{i}", "state": "TODO"},
                "content": [t(it)],
            }
            for i, it in enumerate(items, start=1)
        ],
    }


def doc(content):
    return {"type": "doc", "version": 1, "content": content}


def story_body(what, ac, notes=None):
    c = [h("What to build"), p(what), h("Acceptance criteria"), tasklist(ac, "ac")]
    if notes:
        c += [h("Notes"), p(notes)]
    return doc(c)


def epic_body(goal, outcomes, demo):
    c = [h("Goal"), p(goal), h("Outcomes"), bullets(outcomes), h("Demo at end of phase"), p(demo)]
    return doc(c)


# --- Epic definitions -------------------------------------------------------

EPICS = [
    {
        "key": "A",
        "summary": "Week 1 — Foundations and Investigation",
        "body": epic_body(
            goal=(
                "Get the platform deployable, the new RBAC system in place, "
                "the vendor model working correctly, and the document intelligence "
                "pipeline scaffolded."
            ),
            outcomes=[
                "New AWS account live; backend deploys cleanly",
                "Resend sender domain configured + Gemini API key wired",
                "Prisma migrations baselined",
                "Permission / RolePermission schema replaces hard-coded role enum",
                "Company Admin can configure roles, permissions, and approval thresholds",
                "Many-to-many vendor model works end-to-end",
                "Document intelligence pipeline can parse a BOM PDF",
                "Tokenized link infrastructure ready for Week 2's vendor portal",
            ],
            demo=(
                "Company Admin creates custom roles with granular permissions, "
                "configures approval thresholds, sets up a vendor that serves multiple "
                "contractors, and uploads a real BOM PDF that gets parsed into "
                "structured line items. Platform is running on the new AWS account."
            ),
        ),
    },
    {
        "key": "B",
        "summary": "Week 2 — Procurement Loop End to End",
        "body": epic_body(
            goal=(
                "A real RFQ goes out to a real vendor, gets a real quote back, "
                "and converts to a real PO with a PDF emailed via Resend."
            ),
            outcomes=[
                "RFQ multi-step scrollable form with CC, attachments, multi-vendor send",
                "Material selection from catalog and parsed BOM line items",
                "Tokenized vendor portal accepting form-entry and PDF quotes",
                "Quote comparison view with side-by-side, lowest-price highlighting",
                "Award → auto-created PO with multi-delivery support",
                "PO PDF template polished and sent via Resend",
                "Frontend consolidation finalized across all 6 roles",
                "Email log on every RFQ and PO",
            ],
            demo=(
                "Contractor logs in, uploads a real BOM PDF from one of Ayo's actual "
                "projects, builds an RFQ from the parsed line items, sends it to three "
                "real vendors via tokenized links, gets real quotes back, compares them "
                "side-by-side, awards the winner, and a real PO email lands in the "
                "winning vendor's inbox."
            ),
        ),
    },
    {
        "key": "C",
        "summary": "Week 3 — Invoice Reconciliation, Polish, Handoff",
        "body": epic_body(
            goal=(
                "Close the procurement loop with invoice reconciliation and three-way "
                "match, then converge for handoff: security pass, deliverability, "
                "full E2E, deploy."
            ),
            outcomes=[
                "PO approval workflow wired through RBAC + approver inbox + notifications",
                "PO state machine enforcement + audit trail + cancel-with-reason",
                "Tokenized invoice upload + Gemini-driven invoice OCR",
                "Three-way match engine (invoice ↔ PO ↔ delivery) with variance flagging",
                "Invoice review UI + invoice state machine + vendor notifications",
                "Security pass on tokenized links",
                "Email deliverability check across Gmail, Outlook, Yahoo",
                "Full E2E pilot test + pilot-ready deployment + walkthrough + Loom",
            ],
            demo=(
                "The full Forethread procurement platform on a single consolidated app: "
                "flexible RBAC, M:N vendor model, tokenized vendor access, BOM "
                "intelligence, RFQ → PO with approvals, invoice reconciliation with "
                "three-way match. Pilot-ready."
            ),
        ),
    },
]


# --- Story definitions ------------------------------------------------------

STORIES = [
    # ---------- Epic A — Week 1 ----------
    {
        "id": "A1",
        "epic": "A",
        "summary": "Boot codebase locally, run full test suite, verify completed-module claims, document gaps",
        "labels": ["needs-triage", "qa", "audit"],
        "blocks": [],
        "what": (
            "The existing repo claims many modules are 'complete' with high test coverage. "
            "Before any new feature work begins, verify those claims hold by booting the "
            "codebase end-to-end and running the full test suite. Produce a written gap report."
        ),
        "ac": [
            "Backend boots locally against a clean Postgres",
            "Frontend (apps/web) boots and authenticates against the local backend",
            "Full test suite runs to completion; pass/fail counts captured",
            "Module-by-module verification: for each module flagged 'complete', run its tests and exercise its critical path manually",
            "Gap report committed to docs/audit/week-1-baseline.md listing: passing modules, failing modules, missing test coverage, overclaimed completeness",
            "Any blocker discovered during boot is logged as a separate Bug ticket",
        ],
        "notes": "Per project plan risk #5: if significant portions are overclaimed, flag within 48 hours and adjust.",
    },
    {
        "id": "A2",
        "epic": "A",
        "summary": "Provision new AWS account, verify admin access, initial backend deploy target",
        "labels": ["needs-triage", "infra"],
        "blocks": [],
        "what": (
            "Stand up a clean AWS account for the project, verify admin access, "
            "and configure an initial deploy target so the backend can be deployed there during Week 1."
        ),
        "ac": [
            "New AWS account access verified (IAM admin role for dev team)",
            "Region locked, baseline VPC / networking provisioned",
            "Managed Postgres provisioned (RDS or equivalent)",
            "S3 bucket created for document uploads",
            "Backend deploys cleanly to this account (manual deploy acceptable for now)",
            "Deploy steps documented in docs/deploy/aws.md",
        ],
        "notes": "Per project plan risk #2: if access slips past Day 1, deploy to interim infra and migrate during Week 1.",
    },
    {
        "id": "A3",
        "epic": "A",
        "summary": "Configure Resend sender domain (SPF / DKIM / DMARC) and send verified test email",
        "labels": ["needs-triage", "infra", "email"],
        "blocks": [],
        "what": (
            "Configure the project's sender domain in Resend so outbound RFQ, PO, and invoice "
            "notifications send from a verified address with proper DNS records."
        ),
        "ac": [
            "Resend sender domain added; SPF, DKIM, DMARC records published",
            "Domain verifies green in Resend dashboard",
            "Test email sent from backend Resend client lands in Gmail and Outlook inboxes (not spam)",
            "Resend client wrapper in backend captures send status (sent / queued / error)",
            "Unit test for Resend client error handling",
        ],
        "notes": "DNS propagation takes time — kick off Day 1 so propagation completes before Week 2 email flows.",
    },
    {
        "id": "A4",
        "epic": "A",
        "summary": "Provision Gemini API key, env wiring, multimodal smoke test",
        "labels": ["needs-triage", "infra", "ai"],
        "blocks": [],
        "what": (
            "Provision the Gemini API key, wire it through env config, and prove a "
            "multimodal call works end-to-end against a small sample PDF."
        ),
        "ac": [
            "Gemini API key stored in env (dev + deployed targets)",
            "Backend client wrapper for Gemini multimodal calls (with retry + timeout)",
            "Smoke test: a small fixture PDF is uploaded → Gemini returns structured response",
            "Error paths handled: rate-limit, invalid key, malformed response",
            "Unit + integration tests cover the client wrapper",
        ],
    },
    {
        "id": "A5",
        "epic": "A",
        "summary": "Create Prisma migrations baseline (current schema → migration v0)",
        "labels": ["needs-triage", "backend"],
        "blocks": ["A1"],
        "what": (
            "The current repo has no migration history. Baseline the schema as migration v0 "
            "so all subsequent schema changes can be migrated cleanly across environments."
        ),
        "ac": [
            "prisma migrate diff confirms baseline matches current schema",
            "migrations/0_init/ checked in",
            "CI verifies migrations apply cleanly to an empty DB",
            "Deploy docs updated with migration step",
        ],
    },
    {
        "id": "A6",
        "epic": "A",
        "summary": "ADR: consolidation shell decision + PDF library choice",
        "labels": ["needs-triage", "architecture", "docs"],
        "blocks": [],
        "what": (
            "Two architectural decisions blocking other work: (1) which existing frontend is "
            "the consolidation shell (already trending toward apps/web per recent commits), "
            "and (2) which PDF library to use for PO and invoice rendering. Capture both as ADRs."
        ),
        "ac": [
            "ADR for consolidation shell: name choice, alternatives considered, migration approach for the other 5 apps",
            "ADR for PDF library: chosen library, rendering approach (server-side vs in-browser), licensing",
            "Both ADRs filed in docs/adr/",
            "Both decisions reviewed and signed off",
        ],
    },
    {
        "id": "A7",
        "epic": "A",
        "summary": "Recover forethread.com landing page code and fix CNAME in GoDaddy",
        "labels": ["needs-triage", "infra", "landing-page"],
        "blocks": [],
        "what": (
            "The landing page code is missing from the current repo and the GoDaddy CNAME is broken. "
            "Locate the original landing page code, restore it to the repo, and fix the CNAME so "
            "forethread.com resolves."
        ),
        "ac": [
            "Landing page source located (prior repo, archive, or freshly authored if irrecoverable)",
            "Landing page code committed to a designated path",
            "GoDaddy CNAME corrected; forethread.com resolves with TLS valid cert",
            "Lighthouse smoke test on the live URL",
        ],
        "notes": "Full landing page rebuild is out of scope for the 3-week sprint (Phase 2 item). This ticket is restore-only.",
    },
    {
        "id": "A8",
        "epic": "A",
        "summary": "Permission + RolePermission schema; migrate enum role checks to permission-based middleware",
        "labels": ["needs-triage", "backend", "rbac"],
        "blocks": ["A5"],
        "what": (
            "Replace the hard-coded role enum with a flexible Permission + RolePermission model. "
            "Migrate every backend authorization check from role-enum comparison to permission-based "
            "middleware. This is the foundation for configurable RBAC."
        ),
        "ac": [
            "Prisma schema: Permission, RolePermission (join), seed of canonical permissions",
            "Migration script preserves current role behaviour (default permission sets matching today's roles)",
            "Backend middleware / guard: @RequirePermission('rfq.create') style — no more role === 'ADMIN' checks",
            "All existing role-gated endpoints converted to permission checks",
            "Tests assert: unauthorized → 403; authorized → 200; permission revoked at runtime → next request denied",
            "Decision log in ADR",
        ],
    },
    {
        "id": "A9",
        "epic": "A",
        "summary": "Company Admin UI for creating custom roles and assigning granular permissions",
        "labels": ["needs-triage", "frontend", "backend", "rbac"],
        "blocks": ["A8"],
        "what": (
            "A UI inside apps/web for Company Admins to create custom roles and toggle individual "
            "permissions per role. End-to-end slice through API + UI + tests."
        ),
        "ac": [
            "Backend: CRUD endpoints for roles, permission assignment (with audit log)",
            "Frontend: role list, role create / edit, permission picker grouped by domain (Procurement, Finance, Warehouse, Admin)",
            "Permission changes take effect on the next authorized request (no logout required, or session refresh documented)",
            "E2E test: create role → assign permission → user with role gains access",
            "Unit tests for backend endpoints and frontend components",
        ],
    },
    {
        "id": "A10",
        "epic": "A",
        "summary": "Approval-threshold configuration tied to permissions",
        "labels": ["needs-triage", "backend", "rbac"],
        "blocks": ["A8"],
        "what": (
            "Permissions can carry an optional monetary threshold (e.g. 'approve PO up to $25k'). "
            "The approval engine enforces it: a PO above a user's threshold routes to the next-tier "
            "approver. Configurable from the role admin UI."
        ),
        "ac": [
            "Schema: RolePermission.thresholdAmount (optional) on relevant approval permissions",
            "Backend: PO approval path resolves the approver based on PO amount + permission thresholds",
            "Frontend: role builder UI shows threshold input where applicable",
            "E2E test: junior officer cannot approve $30k PO, senior officer can",
            "Unit tests for threshold resolution logic",
        ],
        "notes": "Multi-step delegation chains are explicitly Phase 2 — this ticket is single-step configurable thresholds only.",
    },
    {
        "id": "A11",
        "epic": "A",
        "summary": "Many-to-many vendor model: audit 1:1 leakage, fix UI/queries/services, seed test data",
        "labels": ["needs-triage", "backend", "frontend", "vendor"],
        "blocks": ["A5"],
        "what": (
            "Vendors currently behave as if 1:1 with contractors — duplicate vendor records get "
            "created when a vendor serves multiple contractors. Audit where the 1:1 leak lives "
            "(UI filter, query, service layer) and fix end-to-end."
        ),
        "ac": [
            "Audit document: where the 1:1 behaviour is (UI / query / service)",
            "Backend: vendor queries scoped correctly so one vendor can serve N contractors",
            "Frontend: vendor list / vendor-attach screens reflect the M:N relationship",
            "Seed data: one vendor record (Rexel) attached to ≥2 contractors; full RFQ → quote loop tested through that vendor",
            "E2E test: vendor reused across contractors does not duplicate",
            "Unit tests for vendor query layer",
        ],
    },
    {
        "id": "A12",
        "epic": "A",
        "summary": "Frontend consolidation foundation in apps/web: role-based routing for all 6 roles",
        "labels": ["needs-triage", "frontend", "consolidation"],
        "blocks": ["A6"],
        "what": (
            "Set up the unified apps/web shell so it serves all six roles (Super Admin, Company Admin, "
            "Procurement Officer, Financial Officer, Warehouse Officer, Vendor) with role-aware routing "
            "and a scaffold for lifting features from the legacy per-role apps."
        ),
        "ac": [
            "Role-based route guard wired (uses A8's permission middleware)",
            "Top-level navigation differs per role",
            "Feature-lift slots scaffolded for each legacy app's domain",
            "E2E test per role: login → lands on role-appropriate home",
            "Removed legacy apps remain removed (verify build doesn't regress)",
        ],
        "notes": "Recent commits already removed legacy per-role apps and unified the frontend — this ticket finalizes the routing shell.",
    },
    {
        "id": "A13",
        "epic": "A",
        "summary": "Document intelligence pipeline scaffold: PDF → S3 → Gemini → review UI",
        "labels": ["needs-triage", "backend", "frontend", "ai", "docs-intel"],
        "blocks": ["A4"],
        "what": (
            "A reusable document intelligence pipeline: user uploads PDF → backend stores in S3 → "
            "Gemini extracts structured data → result surfaces in a review UI where the user confirms "
            "or edits before saving. Generic enough to support BOMs (A14), quotes (B5), and invoices (C4)."
        ),
        "ac": [
            "Backend upload endpoint accepts PDF, stores in S3, kicks off Gemini extraction",
            "Extraction job status surfaced via polling or websocket",
            "Generic 'extraction result' schema usable by any document type",
            "Frontend review UI: shows extracted fields, allows edit, allows save",
            "Error states: upload failure, extraction timeout, malformed result",
            "Tests across backend pipeline + frontend review component",
        ],
    },
    {
        "id": "A14",
        "epic": "A",
        "summary": "BOM extraction use case on the document intelligence pipeline",
        "labels": ["needs-triage", "backend", "frontend", "ai", "bom"],
        "blocks": ["A13"],
        "what": (
            "First concrete use of the document pipeline (A13): parse construction Bill of Materials "
            "PDFs into structured line items (description, quantity, unit of measure, optional target "
            "price). Includes the review UI specialization for BOM line items."
        ),
        "ac": [
            "BOM-specific Gemini prompt + structured output schema (description, qty, UoM, target price)",
            "Review UI: editable table of line items, add / remove / edit rows",
            "Save persists BOM with audit trail (uploaded by, reviewed by, edits)",
            "Accuracy benchmark documented on Ayo's sample BOMs (per risk #1: target ≥80%)",
            "E2E test: upload sample BOM → review → save → BOM available for RFQ creation",
            "Unit tests on parsing / normalization",
        ],
    },
    {
        "id": "A15",
        "epic": "A",
        "summary": "Tokenized link infrastructure: entropy, single-use, expiry, rate limiting",
        "labels": ["needs-triage", "backend", "security"],
        "blocks": ["A5"],
        "what": (
            "The shared token infrastructure that powers Week 2's vendor portal and Week 3's invoice "
            "upload. Cryptographically strong tokens, single-use enforcement, expiry, rate limiting."
        ),
        "ac": [
            "Token schema: subject (RFQ / quote / invoice), purpose, expiry, used-at, attempts",
            "Generator uses crypto-strong randomness (≥128 bits entropy)",
            "Middleware validates token, enforces single-use, enforces expiry, rate-limits per IP",
            "Tests: valid token works; expired / used / invalid → 403; rate limit fires after N attempts",
            "Documentation describing the token lifecycle",
        ],
        "notes": "Security pass in Week 3 (C8) will re-audit this.",
    },
    # ---------- Epic B — Week 2 ----------
    {
        "id": "B1",
        "epic": "B",
        "summary": "RFQ multi-step scrollable form (project → materials → vendors → delivery & specs → review)",
        "labels": ["needs-triage", "frontend", "rfq"],
        "blocks": ["A12"],
        "what": (
            "Rebuild the RFQ creation flow as a multi-step scrollable form with five steps: project, "
            "materials, vendors, delivery & specs, review. Each step validates before advancing; "
            "the user can scroll back to any prior step."
        ),
        "ac": [
            "Backend: RFQ draft persistence between steps (save-as-you-go)",
            "Frontend: five-step layout, step indicator, scrollable, per-step validation",
            "Review step shows full RFQ before send",
            "E2E test: complete the form and persist a draft RFQ",
            "Unit tests per step",
        ],
    },
    {
        "id": "B2",
        "epic": "B",
        "summary": "RFQ CC field, file attachments, multi-vendor tokenized send",
        "labels": ["needs-triage", "backend", "email", "rfq"],
        "blocks": ["B1", "A15", "A3"],
        "what": (
            "On the RFQ send action: allow CC recipients on the email, allow file attachments that "
            "travel through to the vendor email, and send one tokenized link per vendor so each "
            "vendor opens a unique portal page."
        ),
        "ac": [
            "Backend: store CC list, attach files (S3), generate one token per vendor",
            "Outbound email sent via Resend (A3) to vendor + CC, with attachments and the unique link",
            "Token uniqueness verified per vendor (A15)",
            "E2E test: RFQ sent to 3 vendors → 3 distinct tokens → each vendor only sees their own RFQ",
            "Unit tests for attachment handling, CC normalization",
        ],
    },
    {
        "id": "B3",
        "epic": "B",
        "summary": "Material selection from catalog AND from parsed BOM line items",
        "labels": ["needs-triage", "frontend", "rfq", "bom"],
        "blocks": ["B1", "A14"],
        "what": (
            "On the RFQ materials step, allow the user to add line items from two sources: the "
            "product catalog, and a previously-parsed BOM (A14). Both flows produce the same "
            "line-item schema on the RFQ."
        ),
        "ac": [
            "Frontend: catalog search picker + BOM picker (pulls A14's extracted lines)",
            "Backend: RFQ line items normalize to a single schema regardless of source",
            "E2E test: create RFQ with one catalog item and one BOM item",
            "Unit tests on normalization",
        ],
    },
    {
        "id": "B4",
        "epic": "B",
        "summary": "Tokenized vendor portal landing page (form-entry quote submission)",
        "labels": ["needs-triage", "frontend", "backend", "vendor-portal"],
        "blocks": ["A15"],
        "what": (
            "Vendor opens the tokenized link from their RFQ email and lands on a no-signup portal "
            "page showing the RFQ scope (project, line items, delivery terms, attachments). They "
            "can submit a quote via form entry. PDF upload is a separate slice (B5)."
        ),
        "ac": [
            "Public landing page resolves via valid token (A15) — no auth required",
            "Shows full RFQ scope including downloadable attachments",
            "Form-entry quote submission: per-line unit price, lead time, payment terms, notes",
            "Submit persists quote and burns the token",
            "E2E test: open link → submit quote → quote stored",
            "Unit tests on form validation",
        ],
    },
    {
        "id": "B5",
        "epic": "B",
        "summary": "Quote submission via PDF upload (Gemini OCR + vendor confirmation)",
        "labels": ["needs-triage", "frontend", "backend", "ai", "vendor-portal"],
        "blocks": ["B4", "A13"],
        "what": (
            "Alternative to B4's form entry: vendor uploads their existing quote as a PDF. The "
            "document pipeline (A13) extracts line items, vendor confirms extraction in the same "
            "portal, then submits."
        ),
        "ac": [
            "PDF upload from the vendor portal flows through A13's pipeline",
            "Quote-specific extraction prompt + schema (per-line unit price, lead time, totals)",
            "Vendor confirms / edits extraction before submit",
            "E2E test: upload quote PDF → review → submit → quote stored",
            "Accuracy spot-check on real sample quotes (per dependency: sample quotes by Day 5)",
        ],
    },
    {
        "id": "B6",
        "epic": "B",
        "summary": "Quote storage against RFQ with audit trail",
        "labels": ["needs-triage", "backend", "quotes"],
        "blocks": ["B4"],
        "what": (
            "All quotes (from B4 form or B5 PDF) persist against their RFQ with a full audit trail "
            "(submitted at, by which vendor, how — form vs PDF, edits made during confirmation)."
        ),
        "ac": [
            "Schema: Quote, QuoteLine, QuoteAudit",
            "Submission paths from B4 and B5 both write through the same persistence layer",
            "Audit log queryable from the RFQ detail view",
            "Unit + integration tests",
        ],
    },
    {
        "id": "B7",
        "epic": "B",
        "summary": "Quote comparison view: side-by-side, lowest-price highlight, extended cost, lead times, terms",
        "labels": ["needs-triage", "frontend", "quotes"],
        "blocks": ["B6"],
        "what": (
            "On the RFQ detail page, a comparison view shows all received quotes side-by-side. "
            "Lowest price per line is highlighted. Shows extended cost (qty × unit), lead times, "
            "payment terms."
        ),
        "ac": [
            "Backend endpoint aggregates quotes per RFQ",
            "Frontend comparison grid: rows = line items, columns = vendors",
            "Lowest-price highlight per row; vendor totals at bottom",
            "Lead time + payment terms surfaced per vendor",
            "E2E test: 3 quotes received → comparison shows correctly",
            "Unit tests on aggregation + highlight logic",
        ],
    },
    {
        "id": "B8",
        "epic": "B",
        "summary": "Award flow: pick winning vendor → auto-create pre-filled PO",
        "labels": ["needs-triage", "backend", "frontend", "po"],
        "blocks": ["B7"],
        "what": (
            "From the comparison view, the user picks a winning vendor (or split-award per line, if "
            "supported). The system auto-creates a draft PO pre-filled from the awarded quote."
        ),
        "ac": [
            "Backend: award endpoint creates draft PO from quote",
            "Frontend: award button → confirmation → redirects to draft PO",
            "Audit: award decision logged on RFQ",
            "E2E test: award quote → draft PO exists with correct line items",
            "Unit tests on PO derivation",
        ],
    },
    {
        "id": "B9",
        "epic": "B",
        "summary": "PO form: multi-delivery support, attachments, approval-gated sending",
        "labels": ["needs-triage", "frontend", "backend", "po"],
        "blocks": ["B8", "A10"],
        "what": (
            "A PO form supporting multiple delivery locations / dates, attachments, and "
            "approval-gated sending. If the PO total exceeds the user's approval threshold (A10), "
            "the 'Send' action becomes 'Submit for Approval'."
        ),
        "ac": [
            "Backend: PO schema supports multiple delivery rows, attachments",
            "Frontend: form with deliveries, attachments, total calc",
            "Approval gate enforces A10's thresholds",
            "E2E test: PO under threshold sends directly; PO over threshold submits for approval",
            "Unit tests on threshold gate",
        ],
    },
    {
        "id": "B10",
        "epic": "B",
        "summary": "PO PDF template polished + sent via Resend",
        "labels": ["needs-triage", "backend", "pdf", "email", "po"],
        "blocks": ["B9", "A3"],
        "what": (
            "Polished PO PDF template using the chosen PDF library (A6). Sent via Resend (A3) to "
            "the vendor when the PO is approved and sent."
        ),
        "ac": [
            "PDF template renders PO with all required fields (number, vendor, lines, deliveries, terms, signatures)",
            "Outbound email via Resend with the PDF attached",
            "Send tracked (status, opens, bounces) — see B12",
            "E2E test: send PO → vendor receives email with valid PDF",
            "Snapshot test on the PDF template",
        ],
    },
    {
        "id": "B11",
        "epic": "B",
        "summary": "Frontend consolidation: lift remaining features into apps/web with role-based views",
        "labels": ["needs-triage", "frontend", "consolidation"],
        "blocks": ["A12"],
        "what": (
            "Migrate the remaining feature surfaces from the legacy per-role apps into apps/web. "
            "Role-based routing finalized so Super Admin, Company Admin, Procurement Officer, "
            "Financial Officer, Warehouse Officer, Vendor are all served by one app."
        ),
        "ac": [
            "All legacy per-role apps' feature parity covered in apps/web (or explicitly deferred as Phase 2)",
            "Each role's home + key flows accessible from apps/web",
            "E2E test per role: login → home → exercise primary action",
            "Removed legacy app code stays removed",
        ],
        "notes": "Continues A12's foundation work.",
    },
    {
        "id": "B12",
        "epic": "B",
        "summary": "Email log per RFQ and PO: send status, opens, bounces",
        "labels": ["needs-triage", "backend", "email"],
        "blocks": ["B2", "B10"],
        "what": (
            "An email log surfaced on each RFQ and PO detail page showing every outbound email's "
            "send status, opens, and bounces (via Resend webhooks)."
        ),
        "ac": [
            "Resend webhook receiver captures send / delivered / opened / bounced events",
            "Schema: EmailEvent linked to RFQ / PO",
            "Frontend: email log section on RFQ and PO detail pages",
            "Bounce alert visible to the sender",
            "E2E test: simulate a bounce event → log reflects it",
            "Unit + integration tests on the webhook handler",
        ],
    },
    # ---------- Epic C — Week 3 ----------
    {
        "id": "C1",
        "epic": "C",
        "summary": "PO approval workflow wired through RBAC + approver inbox + email notifications",
        "labels": ["needs-triage", "backend", "frontend", "approvals"],
        "blocks": ["A10", "B9"],
        "what": (
            "End-to-end approval flow: when a PO is submitted for approval (B9), the engine resolves "
            "the right approver based on PO amount + permission thresholds (A10) and routes to them. "
            "Approver inbox view lets them approve or reject (rejection requires a reason). "
            "Approval / rejection triggers email notifications via Resend."
        ),
        "ac": [
            "Backend: approval routing based on RBAC + thresholds",
            "Frontend: approver inbox with pending approvals, approve / reject actions, mandatory rejection reason",
            "Email notifications via Resend on submit / approve / reject",
            "E2E test: submit for approval → approver sees in inbox → approves → PO moves to Approved",
            "Unit tests on routing logic",
        ],
    },
    {
        "id": "C2",
        "epic": "C",
        "summary": "PO state machine enforcement + audit trail + cancel-with-reason",
        "labels": ["needs-triage", "backend", "po", "state-machine"],
        "blocks": ["B9"],
        "what": (
            "Enforce the PO state machine (Draft → Pending Approval → Approved → Sent → Acknowledged → "
            "Delivered) at the service layer. Every transition writes an audit entry. A cancel action "
            "is supported from any non-terminal state with a required reason."
        ),
        "ac": [
            "Service layer rejects illegal transitions (e.g. Draft → Delivered)",
            "Each transition writes AuditEntry (who, when, why)",
            "Cancel action available from non-terminal states with reason",
            "Audit trail visible on PO detail page",
            "E2E test: walk a PO through full happy path; attempt illegal transition; cancel",
            "Unit tests on state machine",
        ],
    },
    {
        "id": "C3",
        "epic": "C",
        "summary": "Tokenized vendor invoice upload page",
        "labels": ["needs-triage", "frontend", "backend", "vendor-portal", "invoice"],
        "blocks": ["A15"],
        "what": (
            "Same tokenized pattern as B4 — vendor opens a link from their notification, lands on a "
            "no-signup invoice upload page. Uploads their invoice PDF."
        ),
        "ac": [
            "Public invoice upload page resolves via valid token (A15)",
            "PDF upload feeds into the document pipeline (A13)",
            "Token burns on submit",
            "E2E test: open link → upload invoice PDF → invoice in 'Under Review'",
            "Unit tests on the token + upload path",
        ],
    },
    {
        "id": "C4",
        "epic": "C",
        "summary": "Invoice OCR via Gemini: vendor, PO reference, line items, quantities, prices, totals",
        "labels": ["needs-triage", "backend", "ai", "invoice"],
        "blocks": ["C3", "A13"],
        "what": (
            "Specialize the document pipeline (A13) for invoices: extract vendor name, PO reference, "
            "line items (qty + price), totals. Results surface in a contractor-facing review UI "
            "(precursor to C6)."
        ),
        "ac": [
            "Invoice-specific Gemini prompt + structured output schema",
            "Extraction handles common invoice layouts",
            "PO reference detected so C5's match can run",
            "Accuracy benchmark on Ayo's sample invoices (per dependency: sample invoices by Day 10)",
            "E2E test: upload invoice → extraction populates review fields",
            "Unit tests on normalization",
        ],
    },
    {
        "id": "C5",
        "epic": "C",
        "summary": "Three-way match engine: invoice ↔ PO ↔ delivery confirmation; flag variance and missing PO ref",
        "labels": ["needs-triage", "backend", "three-way-match"],
        "blocks": ["C4", "B10"],
        "what": (
            "The reconciliation engine: given an invoice with a PO reference, fetch the PO and "
            "delivery confirmation, and produce a match result flagging price variance, quantity "
            "variance, missing PO reference."
        ),
        "ac": [
            "Match service compares invoice ↔ PO ↔ delivery row-by-row",
            "Variance thresholds configurable (e.g. ±2% price, exact qty)",
            "Mismatch report includes per-line flags",
            "Handles missing PO ref gracefully (flagged, surfaced to contractor)",
            "Unit + integration tests across happy path, price variance, qty variance, missing PO",
        ],
    },
    {
        "id": "C6",
        "epic": "C",
        "summary": "Invoice review UI + invoice state machine (Received → Under Review → Approved → Disputed → Paid)",
        "labels": ["needs-triage", "frontend", "backend", "invoice", "state-machine"],
        "blocks": ["C5"],
        "what": (
            "Contractor-facing invoice review UI: see match status from C5, approve / reject / dispute. "
            "State machine enforces transitions."
        ),
        "ac": [
            "Frontend invoice detail page shows match results, original PDF, extracted fields",
            "Approve / Reject / Dispute actions with required reason where applicable",
            "State machine enforced in service layer",
            "Audit trail per transition",
            "E2E test: approve a clean-match invoice; dispute a mismatched invoice",
            "Unit tests on state machine",
        ],
    },
    {
        "id": "C7",
        "epic": "C",
        "summary": "Vendor notifications on invoice approval/dispute via Resend",
        "labels": ["needs-triage", "backend", "email", "invoice"],
        "blocks": ["C6", "A3"],
        "what": (
            "When a contractor approves or disputes an invoice (C6), the vendor receives an email "
            "notification with the outcome and any dispute reason."
        ),
        "ac": [
            "Outbound email via Resend triggered on approve / dispute",
            "Dispute email includes reason",
            "Email log captured (per B12)",
            "E2E test: dispute → vendor receives email with reason",
            "Unit tests on the notification trigger",
        ],
    },
    {
        "id": "C8",
        "epic": "C",
        "summary": "Security pass on tokenized links: entropy, expiry, single-use enforcement review",
        "labels": ["needs-triage", "security", "qa"],
        "blocks": ["A15", "B4", "C3"],
        "what": (
            "Re-audit the tokenized link infrastructure (A15) before pilot. Verify entropy, expiry, "
            "single-use enforcement under concurrent load. Test attack scenarios."
        ),
        "ac": [
            "Pen-test-style review documented: token guessing, replay, race conditions, scope leakage",
            "Single-use enforcement holds under concurrent submission attempts (transaction or row-level lock)",
            "Rate limiting validated under burst load",
            "Findings filed as separate Bug tickets if any",
            "Security review document in docs/security/tokens.md",
        ],
    },
    {
        "id": "C9",
        "epic": "C",
        "summary": "Email deliverability check across Gmail, Outlook, Yahoo",
        "labels": ["needs-triage", "email", "qa"],
        "blocks": ["A3", "B10", "C7"],
        "what": (
            "Before pilot, verify outbound emails (RFQ, PO, invoice notification) land in the inbox "
            "(not spam) across Gmail, Outlook, Yahoo."
        ),
        "ac": [
            "Test sends from staging to seed addresses on each provider",
            "DKIM / SPF / DMARC alignment verified",
            "Inbox placement screenshots captured",
            "Any deliverability issues filed as Bug tickets",
        ],
    },
    {
        "id": "C10",
        "epic": "C",
        "summary": "Full end-to-end pilot test with real BOMs/emails/invoices + bug bash",
        "labels": ["needs-triage", "qa"],
        "blocks": ["B12", "C6"],
        "what": (
            "Run the full procurement loop using real Ayo data: real BOM PDFs, real vendor email "
            "addresses (pilot vendors), real invoice PDFs. Capture issues in a bug bash; triage and fix."
        ),
        "ac": [
            "Test plan written covering happy path + 2-3 edge cases per phase",
            "Test executed against staging with real data",
            "Issues filed as Bug tickets; critical issues fixed before pilot",
            "Test report committed to docs/qa/pilot-readiness.md",
        ],
    },
    {
        "id": "C11",
        "epic": "C",
        "summary": "Pilot-ready deployment to Ayo's AWS account + walkthrough doc + Loom demo",
        "labels": ["needs-triage", "infra", "docs"],
        "blocks": ["A2", "C10"],
        "what": (
            "Deploy the final build to Ayo's AWS account (A2), produce a client walkthrough document, "
            "and record a Loom demo video as a backup."
        ),
        "ac": [
            "Production-style deploy to Ayo's AWS",
            "Smoke test on production: login per role, create RFQ, send, receive, award, PO, invoice, match",
            "Client walkthrough doc covers each role's primary flows",
            "Loom recorded covering the same flows end-to-end",
            "Handoff meeting scheduled",
        ],
    },
]


# --- JIRA HTTP --------------------------------------------------------------

def http(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url=f"{JIRA_BASE_URL}{path}",
        method=method,
        data=data,
        headers=HEADERS,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            text = resp.read().decode() or "{}"
            return json.loads(text) if text.strip() else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise SystemExit(f"HTTP {e.code} on {method} {path}: {err}")


def create_epic(summary, adf_body):
    payload = {
        "fields": {
            "project": {"key": PROJECT},
            "issuetype": {"name": "Epic"},
            "summary": summary,
            "description": adf_body,
            "labels": ["needs-triage", "phase-epic"],
        }
    }
    res = http("POST", "/rest/api/3/issue", payload)
    return res["key"]


def create_story(summary, epic_key, adf_body, labels):
    payload = {
        "fields": {
            "project": {"key": PROJECT},
            "issuetype": {"name": "Story"},
            "summary": summary,
            "description": adf_body,
            "labels": labels,
            "parent": {"key": epic_key},
        }
    }
    res = http("POST", "/rest/api/3/issue", payload)
    return res["key"]


def link_blocks(blocker_key, blocked_key):
    payload = {
        "type": {"name": "Blocks"},
        "inwardIssue": {"key": blocked_key},
        "outwardIssue": {"key": blocker_key},
    }
    http("POST", "/rest/api/3/issueLink", payload)


# --- Run -------------------------------------------------------------------

SEED_KEYS = {
    "A": "FOR-179",
    "B": "FOR-180",
    "C": "FOR-181",
}


def main():
    keys = dict(SEED_KEYS)

    # Step 1: create epics (skip seeded)
    print("Creating epics...")
    for e in EPICS:
        if e["key"] in keys:
            print(f"  {e['key']} -> {keys[e['key']]} (already exists, skipped)")
            continue
        key = create_epic(e["summary"], e["body"])
        keys[e["key"]] = key
        print(f"  {e['key']} -> {key}: {e['summary']}")

    # Step 2: topo-sort stories so blockers are created first
    by_id = {s["id"]: s for s in STORIES}
    created = set()
    order = []
    remaining = list(STORIES)
    safety = 0
    while remaining:
        safety += 1
        if safety > 500:
            raise SystemExit(f"Topo sort failed; remaining: {[s['id'] for s in remaining]}")
        progress = False
        next_remaining = []
        for s in remaining:
            if all(b in created for b in s["blocks"]):
                order.append(s)
                created.add(s["id"])
                progress = True
            else:
                next_remaining.append(s)
        remaining = next_remaining
        if not progress:
            raise SystemExit(f"Cycle detected; remaining: {[s['id'] for s in remaining]}")

    # Step 3: create stories in order
    print("\nCreating stories...")
    for s in order:
        epic_jira_key = keys[s["epic"]]
        body = story_body(s["what"], s["ac"], s.get("notes"))
        jkey = create_story(s["summary"], epic_jira_key, body, s["labels"])
        keys[s["id"]] = jkey
        print(f"  {s['id']} -> {jkey} (parent {epic_jira_key}): {s['summary']}")

    # Step 4: add "blocks" links
    print("\nAdding 'is blocked by' links...")
    for s in STORIES:
        this_key = keys[s["id"]]
        for b in s["blocks"]:
            blocker_key = keys[b]
            link_blocks(blocker_key, this_key)
            print(f"  {this_key} is blocked by {blocker_key}  ({s['id']} <- {b})")

    OUT_KEYS.write_text(json.dumps(keys, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT_KEYS}")
    print(f"\nDone. {len(EPICS)} epics + {len(STORIES)} stories.")


if __name__ == "__main__":
    main()
