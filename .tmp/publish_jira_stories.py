#!/usr/bin/env python3
"""Publish FOR-project User Stories to JIRA from specs/001-procurement-platform/spec.md.

Reads .env.local for JIRA creds. Idempotent only if re-run with the same dry-run
flag — re-running with publish=True will create duplicates. Always check FOR
project before re-running.
"""

import base64
import json
import os
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / ".env.local"
SPEC = ROOT / "specs" / "001-procurement-platform" / "spec.md"
OUT_KEYS = ROOT / ".tmp" / "published_keys.json"

# Load .env.local
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

# --- Story registry ----------------------------------------------------------
# slug: stable id used for blocker resolution
# header: markdown header to anchor the section (matched exactly in spec.md)
# summary: JIRA summary line
# epic: parent Epic key
# blocks: list of slugs that block this one (becomes "is blocked by" link)
STORIES = [
    # ---------- Cross-cutting primitives (publish first; many things block on these) ----------
    {
        "slug": "US-19",
        "header": "### User Story 19 - Action Token Management (Architectural Primitive, Priority: P3 / cross-cutting)",
        "summary": "US-19 — Action Token Management (vendor token-only auth)",
        "epic": "FOR-51",
        "blocks": [],
    },
    {
        "slug": "US-16",
        "header": "### User Story 16 - Document Extraction (Architectural Primitive, Priority: P3 / cross-cutting)",
        "summary": "US-16 — Document Extraction primitive (BOM, quote, invoice, MR, receipt)",
        "epic": "FOR-51",
        "blocks": [],
    },
    {
        "slug": "US-17",
        "header": "### User Story 17 - Threads, Email-In, and Unified Inbox (Architectural Primitive, Priority: P6 / cross-cutting)",
        "summary": "US-17 — Threads, Email-In, and Unified Inbox primitive",
        "epic": "FOR-51",
        "blocks": ["US-19"],
    },
    {
        "slug": "US-11A",
        "header": "### User Story 11 - System-Wide Requirements (Cross-Cutting)",
        "summary": "US-11A — System-wide notifications, audit log, multi-currency, admin panel",
        "epic": "FOR-51",
        "blocks": [],
    },
    # ---------- Foundation user/project flows ----------
    {
        "slug": "US-1",
        "header": "### User Story 1 - User Registration & Access Management (Priority: P1)",
        "summary": "US-1 — User Registration & Access Management (Super Admin invites, OTP login, OOO delegation)",
        "epic": "FOR-43",
        "blocks": [],
    },
    {
        "slug": "US-2",
        "header": "### User Story 2 - Project Creation & Management (Priority: P2)",
        "summary": "US-2 — Project Creation & Management",
        "epic": "FOR-43",
        "blocks": ["US-1"],
    },
    # ---------- Vendor + Catalogue prereqs for procurement ----------
    {
        "slug": "US-6",
        "header": "### User Story 6 - Vendor & Supplier Management (Priority: P6)",
        "summary": "US-6 — Vendor & Supplier Management (invite, profile, per-Contractor list)",
        "epic": "FOR-45",
        "blocks": ["US-1", "US-19"],
    },
    {
        "slug": "US-7",
        "header": "### User Story 7 - Material Catalogue Management (Priority: P7)",
        "summary": "US-7 — Material Catalogue Management (BOMs, imports, suggestions, price history)",
        "epic": "FOR-46",
        "blocks": ["US-1", "US-16"],
    },
    # ---------- Procurement core ----------
    {
        "slug": "US-3",
        "header": "### User Story 3 - RFQ Creation & Vendor Quote Collection (Priority: P3)",
        "summary": "US-3 — RFQ Creation & Vendor Quote Collection",
        "epic": "FOR-47",
        "blocks": ["US-2", "US-6", "US-7", "US-16", "US-19"],
    },
    {
        "slug": "US-4",
        "header": "### User Story 4 - Quote Review & Approval (Priority: P4)",
        "summary": "US-4 — Quote Review & Approval (side-by-side comparison, line-item award)",
        "epic": "FOR-47",
        "blocks": ["US-3"],
    },
    {
        "slug": "US-5",
        "header": "### User Story 5 - Purchase Order Creation & Issuance (Priority: P5)",
        "summary": "US-5 — Purchase Order Creation & Issuance (manual, from RFQ, from bulk)",
        "epic": "FOR-47",
        "blocks": ["US-4"],
    },
    {
        "slug": "US-5b",
        "header": "### User Story 5b - Change Request Management (Priority: P5)",
        "summary": "US-5b — PO Change Request Management",
        "epic": "FOR-47",
        "blocks": ["US-5"],
    },
    {
        "slug": "US-5c",
        "header": "### User Story 5c - Pick-up PO & RFQ Items (Priority: P5)",
        "summary": "US-5c — Pick-up PO & RFQ Items",
        "epic": "FOR-47",
        "blocks": ["US-3", "US-5"],
    },
    {
        "slug": "US-8",
        "header": "### User Story 8 - Bulk Order Management (Priority: P8)",
        "summary": "US-8 — Bulk Order Management (creation from RFQ, drawdowns, amendments)",
        "epic": "FOR-47",
        "blocks": ["US-4"],
    },
    {
        "slug": "US-5d",
        "header": "### User Story 5d - PO & Bulk Auto-Apply (Priority: P5)",
        "summary": "US-5d — PO & Bulk Auto-Apply (bulk pricing applied during PO creation)",
        "epic": "FOR-47",
        "blocks": ["US-5", "US-8"],
    },
    {
        "slug": "US-5e",
        "header": "### User Story 5e - Delivery Responsible Person (Priority: P5)",
        "summary": "US-5e — Delivery Responsible Person (tokenized delivery-report link)",
        "epic": "FOR-47",
        "blocks": ["US-5", "US-19"],
    },
    {
        "slug": "US-15",
        "header": "### User Story 15 - Change Orders for Purchase Orders (Priority: P15)",
        "summary": "US-15 — Change Orders for Purchase Orders (Minor/Major classification, approval engine)",
        "epic": "FOR-47",
        "blocks": ["US-5"],
    },
    # ---------- Field PWA ----------
    {
        "slug": "US-14",
        "header": "### User Story 14 - Field Material Requests & Delivery Confirmation (Priority: P14)",
        "summary": "US-14 — Field Material Requests & Delivery Confirmation (Foreman PWA)",
        "epic": "FOR-48",
        "blocks": ["US-2", "US-5", "US-7", "US-16"],
    },
    {
        "slug": "US-11B",
        "header": "### User Story 11 - Delivery Report Submission (Priority: P11 — Optional)",
        "summary": "US-11B — Delivery Report Submission (per-line outcomes, QR + OTP for external)",
        "epic": "FOR-48",
        "blocks": ["US-5", "US-19"],
    },
    # ---------- Invoice & Reconciliation ----------
    {
        "slug": "US-9",
        "header": "### User Story 9 - Invoice Reconciliation & Dispute Resolution (Priority: P9)",
        "summary": "US-9 — Invoice Reconciliation & Dispute Resolution",
        "epic": "FOR-50",
        "blocks": ["US-5", "US-16", "US-17"],
    },
    {
        "slug": "US-9b",
        "header": "### User Story 9b - Financial Reports (Priority: P9, Optional)",
        "summary": "US-9b — Financial Reports (spend, committed, by date range)",
        "epic": "FOR-50",
        "blocks": ["US-9"],
    },
    {
        "slug": "US-18",
        "header": "### User Story 18 - Three-Way Match Policy (Architectural Primitive, Priority: P9 / cross-cutting)",
        "summary": "US-18 — Three-Way Match Policy (asymmetric quantity, symmetric price tolerance)",
        "epic": "FOR-51",
        "blocks": ["US-5", "US-9", "US-11B"],
    },
    # ---------- Epic 2 Dashboards ----------
    {
        "slug": "US-10.01",
        "header": "#### US 10.01 — PO/CA Home Dashboard",
        "summary": "US-10.01 — PO/CA Home Dashboard",
        "epic": "FOR-44",
        "blocks": ["US-3", "US-5", "US-9"],
    },
    {
        "slug": "US-10.02",
        "header": "#### US 10.02 — Vendor Home Dashboard",
        "summary": "US-10.02 — Vendor Home Dashboard",
        "epic": "FOR-44",
        "blocks": ["US-3", "US-5", "US-9"],
    },
    {
        "slug": "US-10.03",
        "header": "#### US 10.03 — Finance Officer Home Dashboard",
        "summary": "US-10.03 — Finance Officer Home Dashboard",
        "epic": "FOR-44",
        "blocks": ["US-9"],
    },
    {
        "slug": "US-10.04",
        "header": "#### US 10.04 — RFQ Management Dashboard (US 2.06)",
        "summary": "US-10.04 — RFQ Management Dashboard",
        "epic": "FOR-44",
        "blocks": ["US-3"],
    },
    {
        "slug": "US-10.05",
        "header": "#### US 10.05 — PO Management Dashboard (US 2.07)",
        "summary": "US-10.05 — PO Management Dashboard",
        "epic": "FOR-44",
        "blocks": ["US-5"],
    },
    {
        "slug": "US-10.06",
        "header": "#### US 10.06 — Bulk Order Management (US 2.11)",
        "summary": "US-10.06 — Bulk Order Management Dashboard",
        "epic": "FOR-44",
        "blocks": ["US-8"],
    },
    {
        "slug": "US-10.07",
        "header": "#### US 10.07 — Invoice State Management (US 8.07)",
        "summary": "US-10.07 — Invoice State Management Dashboard",
        "epic": "FOR-44",
        "blocks": ["US-9"],
    },
    # ---------- System admin ----------
    {
        "slug": "US-12",
        "header": "### User Story 12 - System Administration & Observability (Priority: P12)",
        "summary": "US-12 — System Administration & Observability (admin panel, integration health)",
        "epic": "FOR-51",
        "blocks": ["US-1"],
    },
]


# --- Spec parsing ------------------------------------------------------------

def slice_section(text: str, header: str) -> str:
    """Return the section starting at the given header up to the next header
    of equal-or-shallower depth (### or ####), or the next horizontal rule."""
    idx = text.find(header)
    if idx == -1:
        raise SystemExit(f"Header not found: {header!r}")
    start = idx + len(header)
    depth = len(re.match(r"#+", header).group())
    # Find the next sibling/parent header (depth <= current) or next major separator
    pattern = re.compile(rf"^#{{1,{depth}}} ", re.MULTILINE)
    m = pattern.search(text, pos=start + 1)
    end = m.start() if m else len(text)
    return text[start:end].strip()


def parse_section(section: str) -> dict:
    """Extract description prose, acceptance scenarios, and notes from a story section."""
    # Strip Figma Screens block (long noise)
    section = re.sub(
        r"\*\*Figma Screens?\*\*[^\n]*\n(?:- \[.*?\]\(.*?\)\n(?:\s+- \[.*?\]\(.*?\)\n)*)+",
        "",
        section,
    )

    lines = section.splitlines()
    description_lines = []
    ac_blocks = []  # list of (header, [bullets])
    current_ac_header = None
    current_ac_bullets = []
    notes_lines = []

    mode = "desc"
    i = 0
    while i < len(lines):
        line = lines[i]
        lstripped = line.lstrip()
        if lstripped.startswith("**Acceptance Scenarios**") or lstripped.startswith("**Acceptance Criteria**"):
            if current_ac_header is not None:
                ac_blocks.append((current_ac_header, current_ac_bullets))
            current_ac_header = "Acceptance criteria"
            current_ac_bullets = []
            mode = "ac"
            i += 1
            continue
        if re.match(r"\*\*Release 1 additions.*\*\*", lstripped) or re.match(r"\*\*Release 1 note.*\*\*", lstripped):
            if current_ac_header is not None:
                ac_blocks.append((current_ac_header, current_ac_bullets))
            current_ac_header = "Release 1 additions"
            current_ac_bullets = []
            mode = "ac"
            i += 1
            continue
        if lstripped.startswith("**Additional Acceptance Criteria"):
            if current_ac_header is not None:
                ac_blocks.append((current_ac_header, current_ac_bullets))
            current_ac_header = "Additional acceptance criteria"
            current_ac_bullets = []
            mode = "ac"
            i += 1
            continue
        if (
            lstripped.startswith("**Why this priority**")
            or lstripped.startswith("**Independent Test**")
            or lstripped.startswith("**Known Remaining Discrepancies")
            or lstripped.startswith("**Implementation Status")
            or lstripped.startswith("**Additional implemented features")
            or lstripped.startswith("**Remaining work**")
            or lstripped.startswith("**Screens**")
            or lstripped.startswith("**PO Status Lifecycle")
            or lstripped.startswith("**PO Details")
            or lstripped.startswith("**Send PO")
            or lstripped.startswith("**RFQ Screens**")
            or lstripped.startswith("**Material Catalog Screens**")
        ):
            if current_ac_header is not None:
                ac_blocks.append((current_ac_header, current_ac_bullets))
                current_ac_header = None
                current_ac_bullets = []
            mode = "notes"
            notes_lines.append(line.rstrip())
            i += 1
            continue

        if mode == "desc":
            description_lines.append(line.rstrip())
        elif mode == "ac":
            m = re.match(r"^- \[([ xX])\]\s+(.*)$", line.rstrip())
            if m:
                # Multi-line AC: continue reading indented continuations
                checked = m.group(1).lower() == "x"
                text = m.group(2)
                j = i + 1
                while j < len(lines) and lines[j].startswith("      ") and not lines[j].lstrip().startswith("- "):
                    text += " " + lines[j].strip()
                    j += 1
                # Collapse internal whitespace
                text = re.sub(r"\s+", " ", text).strip()
                current_ac_bullets.append({"checked": checked, "text": text})
                i = j
                continue
            elif line.strip() == "" or line.strip() == "---":
                pass
            elif lstripped.startswith("**"):
                # Probably a callout heading we didn't catch — flush and switch to notes
                if current_ac_header is not None:
                    ac_blocks.append((current_ac_header, current_ac_bullets))
                    current_ac_header = None
                    current_ac_bullets = []
                mode = "notes"
                notes_lines.append(line.rstrip())
        elif mode == "notes":
            notes_lines.append(line.rstrip())

        i += 1

    if current_ac_header is not None:
        ac_blocks.append((current_ac_header, current_ac_bullets))

    # Clean description: drop empty lines at ends, drop figma residue
    desc = "\n".join(description_lines).strip()
    desc = re.sub(r"\n{3,}", "\n\n", desc)

    notes = "\n".join(notes_lines).strip()
    notes = re.sub(r"\n{3,}", "\n\n", notes)

    return {"description": desc, "ac_blocks": ac_blocks, "notes": notes}


# --- ADF rendering -----------------------------------------------------------

def adf_text(text: str) -> dict:
    return {"type": "text", "text": text}


def adf_paragraph(text: str) -> dict:
    # Split on newlines into separate paragraphs to keep ADF clean.
    return {"type": "paragraph", "content": [adf_text(text)] if text else []}


def adf_heading(text: str, level: int = 2) -> dict:
    return {"type": "heading", "attrs": {"level": level}, "content": [adf_text(text)]}


def adf_bullet_list(items: list) -> dict:
    return {
        "type": "bulletList",
        "content": [
            {"type": "listItem", "content": [adf_paragraph(it)]} for it in items if it
        ],
    }


def adf_task_list(items: list, list_id: str) -> dict:
    return {
        "type": "taskList",
        "attrs": {"localId": list_id},
        "content": [
            {
                "type": "taskItem",
                "attrs": {
                    "localId": f"{list_id}-{i}",
                    "state": "DONE" if it["checked"] else "TODO",
                },
                "content": [adf_text(it["text"])],
            }
            for i, it in enumerate(items, start=1)
        ],
    }


def build_adf(parsed: dict, slug: str) -> dict:
    content = []

    # What to build
    content.append(adf_heading("What to build", level=2))
    desc = parsed["description"]
    if desc:
        for para in desc.split("\n\n"):
            para = para.strip()
            if para:
                content.append(adf_paragraph(para))

    # Acceptance criteria (and any additional/Release-1 blocks)
    for header, bullets in parsed["ac_blocks"]:
        if not bullets:
            continue
        content.append(adf_heading(header, level=2))
        content.append(adf_task_list(bullets, list_id=f"{slug}-{header.lower().replace(' ', '-')}"))

    # Notes
    notes = parsed["notes"]
    if notes:
        content.append(adf_heading("Notes", level=2))
        for para in notes.split("\n\n"):
            para = para.strip()
            if para:
                content.append(adf_paragraph(para))

    # Source reference
    content.append(adf_heading("Source", level=2))
    content.append(adf_paragraph(f"From specs/001-procurement-platform/spec.md ({slug})"))

    return {"type": "doc", "version": 1, "content": content}


# --- JIRA HTTP ---------------------------------------------------------------

def http(method: str, path: str, body: dict | None = None) -> dict:
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


def create_issue(summary: str, epic: str, adf_body: dict) -> str:
    payload = {
        "fields": {
            "project": {"key": "FOR"},
            "issuetype": {"name": "Story"},
            "summary": summary,
            "description": adf_body,
            "labels": ["needs-triage"],
            "parent": {"key": epic},
        }
    }
    res = http("POST", "/rest/api/3/issue", payload)
    return res["key"]


def link_blocks(blocker_key: str, blocked_key: str) -> None:
    http(
        "POST",
        "/rest/api/3/issueLink",
        {
            "type": {"name": "Blocks"},
            "inwardIssue": {"key": blocked_key},
            "outwardIssue": {"key": blocker_key},
        },
    )


# --- Main --------------------------------------------------------------------

def main():
    dry_run = "--publish" not in sys.argv
    spec_text = SPEC.read_text(encoding="utf-8")

    # Validate every header is present before doing anything
    for s in STORIES:
        if s["header"] not in spec_text:
            raise SystemExit(f"Missing header in spec: {s['slug']} -> {s['header']!r}")

    # Validate blocker slugs all resolve
    known = {s["slug"] for s in STORIES}
    for s in STORIES:
        for b in s["blocks"]:
            if b not in known:
                raise SystemExit(f"{s['slug']} blocked by unknown slug {b!r}")

    if dry_run:
        # Emit a sample first issue's ADF for visual inspection
        sample = STORIES[0]
        section = slice_section(spec_text, sample["header"])
        parsed = parse_section(section)
        adf = build_adf(parsed, sample["slug"])
        print(f"DRY RUN. {len(STORIES)} stories ready to publish.\n")
        print(f"Sample issue: {sample['slug']} → {sample['summary']}")
        print(f"  Epic: {sample['epic']}  Blocked by: {sample['blocks']}")
        print(f"  ADF nodes: {len(adf['content'])}")
        print(f"  AC blocks: {[(h, len(b)) for h, b in parsed['ac_blocks']]}")
        print("\nFirst 800 chars of ADF JSON:\n")
        print(json.dumps(adf, indent=2)[:800])
        print("\n...\n")
        print("Pass --publish to create issues in JIRA.")
        return

    # Publish
    keys: dict[str, str] = {}
    for i, s in enumerate(STORIES, start=1):
        section = slice_section(spec_text, s["header"])
        parsed = parse_section(section)
        adf = build_adf(parsed, s["slug"])
        key = create_issue(s["summary"], s["epic"], adf)
        keys[s["slug"]] = key
        print(f"[{i:>2}/{len(STORIES)}] {s['slug']:>8} -> {key}  ({s['summary']})")

    OUT_KEYS.parent.mkdir(parents=True, exist_ok=True)
    OUT_KEYS.write_text(json.dumps(keys, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT_KEYS}")

    # Link blockers
    print("\nLinking blockers...")
    for s in STORIES:
        blocked_key = keys[s["slug"]]
        for b in s["blocks"]:
            blocker_key = keys[b]
            link_blocks(blocker_key, blocked_key)
            print(f"  {blocker_key} blocks {blocked_key}  ({b} -> {s['slug']})")

    print("\nDone.")


if __name__ == "__main__":
    main()
