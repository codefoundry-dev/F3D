# Data Model: B2B Procurement Management Platform

**Feature Branch**: `001-procurement-platform` **Created**: 2026-02-21 **Status**: Draft

---

## Entity Relationship Summary

| Entity                 | Relates To                    | Relationship                    | Cardinality        |
| ---------------------- | ----------------------------- | ------------------------------- | ------------------ |
| User                   | Company                       | belongs to                      | Many → One         |
| User                   | Project                       | assigned to (via ProjectMember) | Many ↔ Many        |
| Company                | Project                       | owns                            | One → Many         |
| Company                | Company (vendor–contractor)   | linked via ContractorVendor     | Many ↔ Many        |
| Project                | BOM                           | has                             | One → One (active) |
| BOM                    | BOMLineItem                   | contains                        | One → Many         |
| BOMLineItem            | Material                      | references                      | Many → One         |
| RFQ                    | Project                       | belongs to                      | Many → One         |
| RFQ                    | Company (contractor)          | owned by                        | Many → One         |
| RFQ                    | RFQLineItem                   | has                             | One → Many         |
| RFQLineItem            | Material                      | references                      | Many → One         |
| RFQ                    | RFQVendor (invited vendors)   | sent to                         | One → Many         |
| Quote                  | RFQ                           | responds to                     | Many → One         |
| Quote                  | Company (vendor)              | submitted by                    | Many → One         |
| QuoteLineItem          | Quote                         | belongs to                      | Many → One         |
| QuoteLineItem          | RFQLineItem                   | references                      | Many → One         |
| PurchaseOrder          | Project                       | belongs to                      | Many → One         |
| PurchaseOrder          | Company (vendor)              | issued to                       | Many → One         |
| PurchaseOrder          | RFQ                           | sourced from (optional)         | Many → One         |
| PurchaseOrder          | BulkOrder                     | drawn from (optional)           | Many → One         |
| PurchaseOrder          | POLineItem                    | contains                        | One → Many         |
| POLineItem             | Material                      | references                      | Many → One         |
| BulkOrder              | Quote                         | created from                    | Many → One         |
| BulkOrder              | Project                       | belongs to (optional)           | Many → One         |
| BulkOrder              | Company (vendor)              | agreed with                     | Many → One         |
| BulkOrder              | BulkOrderLineItem             | contains                        | One → Many         |
| BulkDrawdown           | BulkOrder                     | draws from                      | Many → One         |
| BulkDrawdown           | PurchaseOrder                 | fulfils                         | One → One          |
| Invoice                | Company (vendor)              | submitted by                    | Many → One         |
| Invoice                | InvoiceLineItem               | contains                        | One → Many         |
| Invoice                | PurchaseOrder (via InvoicePO) | linked to                       | Many ↔ Many        |
| InvoiceLineItem        | POLineItem                    | reconciles against              | Many → One         |
| DeliveryReport         | PurchaseOrder                 | records delivery for            | Many → One         |
| DeliveryReport         | User (submitter)              | submitted by                    | Many → One         |
| DeliveryReportLineItem | POLineItem                    | records outcome for             | Many → One         |
| Notification           | User (recipient)              | delivered to                    | Many → One         |
| AuditLog               | User (actor)                  | performed by                    | Many → One         |
| Material               | Company (suggester, optional) | suggested by                    | Many → One         |
| ApprovalScenario       | Company                       | configured for                  | Many → One         |
| ApprovalRequest        | ApprovalScenario              | governed by                     | Many → One         |
| Message                | User (sender)                 | sent by                         | Many → One         |

---

## Entities

---

### 1. User

**Description**: A person with authenticated access to the platform. Every user belongs to exactly
one Company and holds exactly one Role. Users can be assigned to multiple Projects (contractor users
only). The lifecycle of a user account is tracked via status.

#### Fields

| Field                         | Type         | Constraints                               | Notes                                                                                                                                          |
| ----------------------------- | ------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                          | UUID         | Primary Key, required                     | Stable surrogate key                                                                                                                           |
| `email`                       | VARCHAR(255) | Required, unique (platform-wide), indexed | Used for login and notifications                                                                                                               |
| `name`                        | VARCHAR(255) | Required                                  | Display name                                                                                                                                   |
| `position`                    | VARCHAR(255) | Required                                  | Job title / position                                                                                                                           |
| `password_hash`               | VARCHAR(255) | Required after activation                 | Bcrypt hash; null until activated                                                                                                              |
| `role`                        | ENUM         | Required                                  | See Role enum below                                                                                                                            |
| `status`                      | ENUM         | Required, default `Invited`               | See status state machine below                                                                                                                 |
| `company_id`                  | UUID         | Required, FK → Company                    | The company the user belongs to. SuperAdmin is assigned to a platform-level "System" company record (not nullable — every user has a company). |
| `invited_by_user_id`          | UUID         | Optional, FK → User                       | The admin who created the invitation                                                                                                           |
| `invitation_token`            | VARCHAR(255) | Optional, unique                          | Secure random token for activation link                                                                                                        |
| `invitation_token_expires_at` | TIMESTAMP    | Optional                                  | Set to 30 days after creation; null after activation                                                                                           |
| `password_reset_token`        | VARCHAR(255) | Optional, unique                          | Secure random token; valid 15 minutes                                                                                                          |
| `password_reset_expires_at`   | TIMESTAMP    | Optional                                  | Null when no reset is pending                                                                                                                  |
| `created_at`                  | TIMESTAMP    | Required, default now()                   |                                                                                                                                                |
| `updated_at`                  | TIMESTAMP    | Required, auto-updated                    |                                                                                                                                                |
| `deactivated_at`              | TIMESTAMP    | Optional                                  | Set when status transitions to Inactive                                                                                                        |

#### Role Enum

| Value                | Company Type          | Description                                          |
| -------------------- | --------------------- | ---------------------------------------------------- |
| `SuperAdmin`         | Platform (no company) | Full platform administration                         |
| `CompanyAdmin`       | Contractor            | Company-level administration and user management     |
| `ProcurementOfficer` | Contractor            | Creates RFQs, POs, manages procurement documents     |
| `FinancialOfficer`   | Contractor            | Manages invoices, payments, financial reconciliation |
| `WarehouseOfficer`   | Contractor            | Manages deliveries and warehouse releases            |
| `Foreman`            | Contractor            | Field access; views project materials and BOMs       |
| `Vendor`             | Vendor                | Responds to RFQs, manages quotes and invoices        |

#### Status State Machine

```
Invited → Active        (user follows invitation link and sets password)
Active  → Inactive      (admin deactivates the user)
Inactive → Active       (admin reactivates the user)
Invited → [cancelled]   (admin cancels invitation — token invalidated, record retained)
```

Valid transitions only. An Invited user cannot skip to Inactive. An Active user cannot return to
Invited.

#### Relationships

- Belongs to one **Company** (`company_id`)
- Invited by one **User** (self-referential, optional)
- Assigned to many **Projects** via **ProjectMember**
- Sends many **Messages**
- Receives many **Notifications**
- Creates many **AuditLog** entries (as actor)
- Can be assigned as approver in many **ApprovalScenario** configurations

#### Key Indexes

| Index                        | Columns                | Purpose                           |
| ---------------------------- | ---------------------- | --------------------------------- |
| `idx_users_email`            | `email`                | Unique login lookup               |
| `idx_users_company_status`   | `company_id, status`   | List users in a company by status |
| `idx_users_company_role`     | `company_id, role`     | Filter by role within a company   |
| `idx_users_invitation_token` | `invitation_token`     | Validate activation links         |
| `idx_users_reset_token`      | `password_reset_token` | Validate password-reset links     |

---

### 2. Company

**Description**: An organisation registered on the platform. Companies are either Contractors (the
platform's client organisations running procurement workflows) or Vendors (suppliers who respond to
RFQs and fulfil POs). A Contractor can have a network of Vendors it works with.

#### Fields

| Field             | Type                          | Constraints                | Notes                                                       |
| ----------------- | ----------------------------- | -------------------------- | ----------------------------------------------------------- |
| `id`              | UUID                          | Primary Key, required      |                                                             |
| `type`            | ENUM (`Contractor`, `Vendor`) | Required                   | Determines available roles and workflows                    |
| `legal_name`      | VARCHAR(255)                  | Required                   | Official registered name                                    |
| `trade_name`      | VARCHAR(255)                  | Optional                   | Trading as name                                             |
| `abn`             | VARCHAR(14)                   | Required, unique           | Format: `XX XXX XXX XXX` (11 digits, stored without spaces) |
| `tax_code`        | VARCHAR(11)                   | Optional                   | Format: `XXX XXX XXX` (9 digits)                            |
| `legal_address`   | TEXT                          | Required                   | Full legal address                                          |
| `contact_email`   | VARCHAR(255)                  | Optional                   | General company contact email                               |
| `contact_phone`   | VARCHAR(50)                   | Optional                   | General company phone                                       |
| `website`         | VARCHAR(255)                  | Optional                   |                                                             |
| `logo_url`        | VARCHAR(500)                  | Optional                   | URL to uploaded logo                                        |
| `status`          | ENUM (`Active`, `Inactive`)   | Required, default `Active` |                                                             |
| `specialisations` | VARCHAR[] or join table       | Required for Vendor        | Multi-select from predefined list                           |
| `created_at`      | TIMESTAMP                     | Required, default now()    |                                                             |
| `updated_at`      | TIMESTAMP                     | Required, auto-updated     |                                                             |

#### Relationships

- Has many **Users**
- Has many **Projects** (if Contractor)
- Linked to many other Companies (vendor ↔ contractor) via **ContractorVendor**
- Issues many **PurchaseOrders** (as vendor receiving company)
- Creates many **Quotes** (as vendor)
- Submits many **Invoices** (as vendor)

#### Key Indexes

| Index                      | Columns      | Purpose                                     |
| -------------------------- | ------------ | ------------------------------------------- |
| `idx_companies_type`       | `type`       | Filter by company type during user creation |
| `idx_companies_abn`        | `abn`        | Unique ABN lookup                           |
| `idx_companies_legal_name` | `legal_name` | Alphabetical list and search                |

---

### 3. ContractorVendor

**Description**: A join table recording which Vendor companies are in a given Contractor company's
vendor list. A Vendor may appear in multiple Contractors' lists. This enables the "if vendor already
exists, add directly without re-inviting" rule.

#### Fields

| Field                   | Type      | Constraints                              | Notes                                                 |
| ----------------------- | --------- | ---------------------------------------- | ----------------------------------------------------- |
| `id`                    | UUID      | Primary Key                              |                                                       |
| `contractor_company_id` | UUID      | Required, FK → Company (type=Contractor) |                                                       |
| `vendor_company_id`     | UUID      | Required, FK → Company (type=Vendor)     |                                                       |
| `added_at`              | TIMESTAMP | Required, default now()                  |                                                       |
| `added_by_user_id`      | UUID      | Required, FK → User                      | The procurement officer or admin who added the vendor |

#### Constraints

- `(contractor_company_id, vendor_company_id)` must be unique (a vendor appears once per contractor
  list)

#### Key Indexes

| Index               | Columns                 | Purpose                                          |
| ------------------- | ----------------------- | ------------------------------------------------ |
| `idx_cv_contractor` | `contractor_company_id` | List all vendors for a contractor                |
| `idx_cv_vendor`     | `vendor_company_id`     | Find all contractors a vendor is associated with |

---

### 4. Project

**Description**: The organisational unit for all procurement activity. Belongs to a Contractor
company. Every RFQ, PO, BOM, and invoice is scoped to a project. Only users explicitly assigned to a
project can view or act on its documents.

#### Fields

| Field                 | Type                                                 | Constraints                              | Notes                                                                        |
| --------------------- | ---------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| `id`                  | UUID                                                 | Primary Key, required                    |                                                                              |
| `company_id`          | UUID                                                 | Required, FK → Company (type=Contractor) | Owning contractor company                                                    |
| `name`                | VARCHAR(255)                                         | Required                                 | Must be unique within the company                                            |
| `description`         | TEXT                                                 | Optional                                 | Project description or notes                                                 |
| `type`                | VARCHAR(100)                                         | Optional                                 | Project type from predefined list (e.g. Residential, Commercial, Industrial) |
| `status`              | ENUM (`Planned`, `Ongoing`, `Completed`, `Archived`) | Required, default `Planned`              | See status state machine below                                               |
| `planned_budget`      | NUMERIC(18,4)                                        | Optional                                 | Planned budget in project currency                                           |
| `currency`            | VARCHAR(3)                                           | Required, default `AUD`                  | ISO 4217 currency code                                                       |
| `start_date`          | DATE                                                 | Optional                                 | Project start date                                                           |
| `expected_end_date`   | DATE                                                 | Optional                                 | Expected completion date                                                     |
| `point_of_contact_id` | UUID                                                 | Optional, FK → User                      | Primary contact person for the project                                       |
| `created_by_user_id`  | UUID                                                 | Required, FK → User                      | The user who created the project                                             |
| `created_at`          | TIMESTAMP                                            | Required, default now()                  |                                                                              |
| `updated_at`          | TIMESTAMP                                            | Required, auto-updated                   |                                                                              |

#### Status State Machine

```
Planned    → Ongoing     (procurement activity begins)
Ongoing    → Completed   (project work finished, documents finalised)
Planned    → Archived    (project abandoned before start)
Ongoing    → Archived    (project abandoned mid-flight)
Completed  → Archived    (historical cleanup)
```

Valid transitions only. A Completed project cannot return to Ongoing.

#### Relationships

- Belongs to one **Company** (Contractor)
- Has many **ProjectLocation** entries (at least one delivery, at least one storage)
- Has many **ProjectMember** entries (assigned users)
- Has optional point of contact **User**
- Has one active **BOM** (Epic 7)
- Has many **RFQs** (Epic 3+)
- Has many **PurchaseOrders** (Epic 5+)

#### Constraints

- `(company_id, name)` must be unique (no duplicate project names within a company)
- The creating user is automatically added as a ProjectMember at creation time
- Procurement Officers assigned to a project cannot manage (add/remove) other ProjectMembers — only
  CompanyAdmins can
- At least one ProjectLocation of type `Delivery` must exist with `is_default = true`
- At least one ProjectLocation of type `Storage` must exist with `is_default = true`

#### Key Indexes

| Index                         | Columns              | Purpose                            |
| ----------------------------- | -------------------- | ---------------------------------- |
| `idx_projects_company`        | `company_id`         | List all projects for a contractor |
| `idx_projects_company_name`   | `company_id, name`   | Enforce name uniqueness and search |
| `idx_projects_company_status` | `company_id, status` | Filter by status within a company  |
| `idx_projects_created_by`     | `created_by_user_id` | "My projects" filter               |

---

### 5. ProjectLocation

**Description**: Delivery or storage locations associated with a project. Each project must have at
least one delivery location and one storage location, each with exactly one default. The `type`
field distinguishes between delivery (site/drop-off) and storage (warehouse/yard) locations.

#### Fields

| Field        | Type                         | Constraints               | Notes                                                            |
| ------------ | ---------------------------- | ------------------------- | ---------------------------------------------------------------- |
| `id`         | UUID                         | Primary Key               |                                                                  |
| `project_id` | UUID                         | Required, FK → Project    |                                                                  |
| `type`       | ENUM (`Delivery`, `Storage`) | Required                  | Distinguishes location purpose                                   |
| `address`    | TEXT                         | Required                  | Full address                                                     |
| `label`      | VARCHAR(255)                 | Optional                  | Human-readable label (e.g. "Site A – North Gate", "Warehouse B") |
| `is_default` | BOOLEAN                      | Required, default `false` | Exactly one per project per type must be `true`                  |

#### Constraints

- `(project_id, type)` partial unique index where `is_default = true` — enforces one default per
  type
- At least one record of each type must exist per project (enforced at application level)

#### Key Indexes

| Index                              | Columns                                      | Purpose                                  |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------- |
| `idx_projectlocation_project`      | `project_id`                                 | List all locations for a project         |
| `idx_projectlocation_project_type` | `project_id, type`                           | Filter by location type                  |
| `idx_projectlocation_default`      | `project_id, type` WHERE `is_default = true` | Fast lookup of default location per type |

---

### 6. ProjectMember

**Description**: Join table between Users and Projects. Controls who has access to a project's
documents.

#### Fields

| Field                 | Type      | Constraints             | Notes                    |
| --------------------- | --------- | ----------------------- | ------------------------ |
| `id`                  | UUID      | Primary Key             |                          |
| `project_id`          | UUID      | Required, FK → Project  |                          |
| `user_id`             | UUID      | Required, FK → User     |                          |
| `assigned_at`         | TIMESTAMP | Required, default now() |                          |
| `assigned_by_user_id` | UUID      | Optional, FK → User     | Who assigned this member |

#### Constraints

- `(project_id, user_id)` must be unique

#### Key Indexes

| Index                       | Columns      | Purpose                                 |
| --------------------------- | ------------ | --------------------------------------- |
| `idx_projectmember_project` | `project_id` | List all members of a project           |
| `idx_projectmember_user`    | `user_id`    | List all projects a user is assigned to |

---

### 6b. MaterialCategory

**Last synced with Prisma schema**: 2026-03-18

**Description**: A category for grouping materials in the catalogue.

**Table**: `material_categories`

#### Fields

| Field        | Type         | Constraints             | Notes |
| ------------ | ------------ | ----------------------- | ----- |
| `id`         | UUID         | Primary Key, required   |       |
| `name`       | VARCHAR(255) | Required, unique        |       |
| `created_at` | TIMESTAMP    | Required, default now() |       |

#### Relationships

- Has many **Material**

---

### 7. Material

**Last synced with Prisma schema**: 2026-03-18

**Description**: An item in the material catalogue. Materials can be public (visible to all),
pending approval, or archived. The public catalogue is managed by the Super Admin. Contractor users
can suggest new materials, which remain invisible until approved.

**Table**: `materials`

#### Fields

| Field           | Type         | Constraints                          | Notes                                    |
| --------------- | ------------ | ------------------------------------ | ---------------------------------------- |
| `id`            | UUID         | Primary Key, required                |                                          |
| `name`          | VARCHAR(255) | Required                             | Material description / name              |
| `category_id`   | UUID         | Required, FK → MaterialCategory      | Catalogue category for grouping          |
| `uom`           | VARCHAR(50)  | Required                             | e.g. `each`, `m`, `m²`, `kg`, `L`, `box` |
| `upc`           | VARCHAR(100) | Optional                             | Universal Product Code                   |
| `manufacturer`  | VARCHAR(255) | Optional                             |                                          |
| `description`   | TEXT         | Optional                             |                                          |
| `status`        | ENUM         | Required, default `PENDING_APPROVAL` | See status enum below                    |
| `created_by_id` | UUID         | Required, FK → User                  | The user who created this material       |
| `created_at`    | TIMESTAMP    | Required, default now()              |                                          |
| `updated_at`    | TIMESTAMP    | Required, auto-updated               |                                          |

#### Status Enum — `MaterialStatus`

| Value              | Description                                                             |
| ------------------ | ----------------------------------------------------------------------- |
| `PUBLIC`           | Visible to all platform users; in the active catalogue                  |
| `PENDING_APPROVAL` | Suggested by a user; awaiting Super Admin review; not visible to others |
| `ARCHIVED`         | Removed from active use; retained for historical document integrity     |

#### Status State Machine

```
[New by SuperAdmin]   → PUBLIC
[New by other user]   → PENDING_APPROVAL → PUBLIC     (Super Admin approves)
                                          → ARCHIVED   (Super Admin rejects / later archives)
PUBLIC                → ARCHIVED          (Super Admin archives)
ARCHIVED              → PUBLIC            (Super Admin restores)
```

#### Relationships

- Belongs to one **MaterialCategory**
- Created by one **User**
- Referenced by many **BOMLineItem**, **RFQLineItem**, **POLineItem**, **BulkOrderLineItem**

#### Key Indexes

| Index                      | Columns        | Purpose                                |
| -------------------------- | -------------- | -------------------------------------- |
| `idx_material_name_status` | `name, status` | Unique constraint (composite)          |
| `idx_materials_category`   | `category_id`  | Browse by category                     |
| `idx_materials_status`     | `status`       | Filter public vs pending vs archived   |
| `idx_materials_name`       | `name`         | Full-text / prefix search in catalogue |

---

### 8. BOM (Bill of Materials)

**Description**: A versioned list of materials required for a project. A project has one active BOM
at any time. The BOM can be used as the starting point for RFQ creation. Each new version supersedes
the previous one.

#### Fields

| Field                | Type      | Constraints              | Notes                                            |
| -------------------- | --------- | ------------------------ | ------------------------------------------------ |
| `id`                 | UUID      | Primary Key, required    |                                                  |
| `project_id`         | UUID      | Required, FK → Project   |                                                  |
| `version`            | INTEGER   | Required, default `1`    | Increments on each revision                      |
| `is_current`         | BOOLEAN   | Required, default `true` | Only one BOM per project may be `true` at a time |
| `notes`              | TEXT      | Optional                 |                                                  |
| `created_by_user_id` | UUID      | Required, FK → User      |                                                  |
| `created_at`         | TIMESTAMP | Required, default now()  |                                                  |
| `updated_at`         | TIMESTAMP | Required, auto-updated   |                                                  |

#### Relationships

- Belongs to one **Project**
- Has many **BOMLineItems**

#### Key Indexes

| Index                     | Columns                  | Purpose                                      |
| ------------------------- | ------------------------ | -------------------------------------------- |
| `idx_bom_project_current` | `project_id, is_current` | Fast lookup of the current BOM for a project |
| `idx_bom_project_version` | `project_id, version`    | Version history ordering                     |

---

### 9. BOMLineItem

**Description**: A single material entry within a BOM, specifying the required quantity.

#### Fields

| Field             | Type          | Constraints             | Notes                                                              |
| ----------------- | ------------- | ----------------------- | ------------------------------------------------------------------ |
| `id`              | UUID          | Primary Key             |                                                                    |
| `bom_id`          | UUID          | Required, FK → BOM      |                                                                    |
| `material_id`     | UUID          | Required, FK → Material |                                                                    |
| `quantity`        | NUMERIC(18,4) | Required, > 0           |                                                                    |
| `unit_of_measure` | VARCHAR(50)   | Required                | Copied from Material at time of addition; can differ if overridden |
| `notes`           | TEXT          | Optional                |                                                                    |
| `sort_order`      | INTEGER       | Optional                | Display ordering within the BOM                                    |

#### Key Indexes

| Index                      | Columns       | Purpose                              |
| -------------------------- | ------------- | ------------------------------------ |
| `idx_bomlineitem_bom`      | `bom_id`      | List all items in a BOM              |
| `idx_bomlineitem_material` | `material_id` | Find all BOMs referencing a material |

---

### 10. RFQ (Request for Quotation)

**Last synced with Prisma schema**: 2026-03-18

**Description**: A formal request sent to one or more Vendors asking them to provide pricing,
availability, and delivery dates for a list of materials. RFQs belong to a Project and are created
by Contractor users.

**Table**: `rfqs`

#### Fields

| Field                    | Type        | Constraints                              | Notes                                          |
| ------------------------ | ----------- | ---------------------------------------- | ---------------------------------------------- |
| `id`                     | UUID        | Primary Key, required                    |                                                |
| `rfq_number`             | VARCHAR(50) | Required, unique (system-generated)      | Human-readable reference e.g. `RFQ-2026-00042` |
| `project_id`             | UUID        | Required, FK → Project                   |                                                |
| `company_id`             | UUID        | Required, FK → Company (type=Contractor) | Owning contractor                              |
| `status`                 | ENUM        | Required, default `DRAFT`                | `RfqStatus` — see enum below                   |
| `currency`               | VARCHAR(3)  | Required, default `AUD`                  | ISO 4217                                       |
| `delivery_location_id`   | UUID        | Optional, FK → ProjectLocation           | Preferred delivery location                    |
| `need_by_date`           | DATETIME    | Optional                                 | Requested delivery date                        |
| `hold_for_release`       | BOOLEAN     | Required, default `false`                |                                                |
| `earliest_delivery_date` | DATETIME    | Optional                                 |                                                |
| `pick_up_date`           | DATETIME    | Optional                                 |                                                |
| `pick_up_location`       | TEXT        | Optional                                 |                                                |
| `deadline_start`         | DATETIME    | Optional                                 |                                                |
| `deadline_end`           | DATETIME    | Optional                                 |                                                |
| `total_requested_qty`    | INT         | Required, default `0`                    | Aggregate line-item quantity                   |
| `message`                | TEXT        | Optional                                 | Instructions to vendors                        |
| `approval_status`        | ENUM        | Optional, `ApprovalStatus`               | NOT_REQUIRED / PENDING / APPROVED / REJECTED   |
| `approved_by_id`         | UUID        | Optional, FK → User                      |                                                |
| `created_by_user_id`     | UUID        | Required, FK → User                      |                                                |
| `created_at`             | TIMESTAMP   | Required, default now()                  |                                                |
| `updated_at`             | TIMESTAMP   | Required, auto-updated                   |                                                |

#### Status Enum — `RfqStatus`

| Status              | Description                                |
| ------------------- | ------------------------------------------ |
| `DRAFT`             | Being composed; not visible to vendors     |
| `OPEN`              | Sent to vendors; accepting quote responses |
| `AWAITING_RESPONSE` | Waiting for vendor responses               |
| `QUOTED`            | At least one vendor has submitted a quote  |
| `AWARDED`           | Quote(s) awarded; ready for PO conversion  |
| `CLOSED`            | All quotes reviewed; RFQ concluded         |
| `CANCELLED`         | Abandoned before conclusion                |

```
DRAFT             → OPEN               (user sends RFQ to vendors)
OPEN              → AWAITING_RESPONSE  (vendors invited)
AWAITING_RESPONSE → QUOTED             (first quote received)
QUOTED            → AWARDED            (contractor awards quote(s))
AWARDED           → CLOSED             (PO created or RFQ concluded)
OPEN              → CANCELLED          (user explicitly cancels)
DRAFT             → CANCELLED          (user explicitly cancels before sending)
```

#### Relationships

- Belongs to one **Project**
- Belongs to one **Company** (Contractor)
- Belongs to one **ProjectLocation** (optional delivery location)
- Approved by one **User** (optional)
- Created by one **User**
- Has many **RfqLineItem**
- Has many **RfqVendor** (invited vendors)
- Has many **QuoteResponse** (vendor responses)
- Has many **BulkOrder**
- Has many **PurchaseOrder** (via `PoSourceRfq`)
- Has many **RfqDocument**

#### Key Indexes

| Index                        | Columns                | Purpose                        |
| ---------------------------- | ---------------------- | ------------------------------ |
| `idx_rfqs_company`           | `company_id`           | Contractor-level RFQ dashboard |
| `idx_rfqs_project`           | `project_id`           | List RFQs for a project        |
| `idx_rfqs_status`            | `status`               | Filter by status               |
| `idx_rfqs_delivery_location` | `delivery_location_id` | Filter by delivery location    |

---

### 11. RFQLineItem

**Last synced with Prisma schema**: 2026-03-18

**Description**: A single material line within an RFQ, specifying the material requested and the
required quantity. The vendor responds with pricing per line item.

**Table**: `rfq_line_items`

#### Fields

| Field         | Type         | Constraints               | Notes                        |
| ------------- | ------------ | ------------------------- | ---------------------------- |
| `id`          | UUID         | Primary Key               |                              |
| `rfq_id`      | UUID         | Required, FK → Rfq        |                              |
| `material_id` | UUID         | Required, FK → Material   |                              |
| `quantity`    | INT          | Required                  |                              |
| `unit`        | VARCHAR(50)  | Required                  | Unit of measure              |
| `cost_code`   | VARCHAR(100) | Optional                  |                              |
| `description` | TEXT         | Optional                  | Per-line description         |
| `pick_up`     | BOOLEAN      | Required, default `false` | Whether this line is pick-up |

#### Key Indexes

| Index                         | Columns       | Purpose                              |
| ----------------------------- | ------------- | ------------------------------------ |
| `idx_rfq_line_items_material` | `material_id` | Find all RFQs referencing a material |

---

### 12. RFQVendor

**Last synced with Prisma schema**: 2026-03-18

**Description**: Records which Vendor companies were invited to respond to an RFQ.

**Table**: `rfq_vendors`

#### Fields

| Field        | Type      | Constraints                          | Notes |
| ------------ | --------- | ------------------------------------ | ----- |
| `id`         | UUID      | Primary Key                          |       |
| `rfq_id`     | UUID      | Required, FK → Rfq                   |       |
| `vendor_id`  | UUID      | Required, FK → Company (type=Vendor) |       |
| `invited_at` | TIMESTAMP | Required, default now()              |       |

> **Planned — not yet in schema**: `response_token` (VARCHAR), `response_token_expires_at`
> (TIMESTAMP), `notified_at` (TIMESTAMP) — will be added when tokenized vendor response is
> implemented.

#### Constraints

- `(rfq_id, vendor_id)` must be unique (`idx_rfq_vendor_unique`)

#### Key Indexes

| Index                    | Columns     | Purpose                                |
| ------------------------ | ----------- | -------------------------------------- |
| `idx_rfq_vendors_rfq`    | `rfq_id`    | List vendors invited to an RFQ         |
| `idx_rfq_vendors_vendor` | `vendor_id` | List RFQs a vendor has been invited to |

---

### 13. QuoteResponse

**Last synced with Prisma schema**: 2026-03-18

**Description**: A vendor's formal response to an RFQ. Tracks total cost, discount, and item
coverage. After the contractor reviews the response, it may be approved or declined.

**Table**: `quote_responses`

#### Fields

| Field              | Type          | Constraints                          | Notes                               |
| ------------------ | ------------- | ------------------------------------ | ----------------------------------- |
| `id`               | UUID          | Primary Key, required                |                                     |
| `rfq_id`           | UUID          | Required, FK → Rfq                   | The RFQ being responded to          |
| `vendor_id`        | UUID          | Required, FK → Company (type=Vendor) |                                     |
| `total_cost`       | DECIMAL(18,4) | Required                             | Total quoted cost                   |
| `discount_percent` | DECIMAL(5,2)  | Optional                             | Percentage discount offered         |
| `discount_amount`  | DECIMAL(18,4) | Optional                             | Absolute discount amount            |
| `items_covered`    | INT           | Required, default `0`                | Number of RFQ line items quoted     |
| `total_items`      | INT           | Required, default `0`                | Total RFQ line items                |
| `status`           | ENUM          | Required, default `PENDING`          | `QuoteResponseStatus` — see below   |
| `submitted_at`     | TIMESTAMP     | Optional                             | When the vendor submitted the quote |
| `created_at`       | TIMESTAMP     | Required, default now()              |                                     |
| `updated_at`       | TIMESTAMP     | Required, auto-updated               |                                     |

> **Planned — not yet in schema**: `submitted_by_user_id` (FK→User), `validity_days` (INT), `notes`
> (TEXT), `reviewed_at` (TIMESTAMP), `reviewed_by_user_id` (FK→User).

#### Status Enum — `QuoteResponseStatus`

| Status      | Description                                                |
| ----------- | ---------------------------------------------------------- |
| `PENDING`   | Response created; not yet submitted by vendor              |
| `SUBMITTED` | Vendor has submitted the quote; awaiting contractor review |
| `APPROVED`  | Contractor has approved the quote                          |
| `DECLINED`  | Contractor has declined the quote                          |

```
PENDING   → SUBMITTED   (vendor submits the quote)
SUBMITTED → APPROVED    (contractor approves)
SUBMITTED → DECLINED    (contractor declines)
APPROVED  → DECLINED    (contractor reverses decision before PO creation)
```

#### Relationships

- Belongs to one **Rfq**
- Belongs to one **Company** (Vendor)

#### Key Indexes

None defined in current schema (implicit PK index only).

---

### 14. QuoteLineItem

**Description**: A vendor's pricing response for a single RFQLineItem. Also tracks the contractor's
approval decision at the line level.

#### Fields

| Field                     | Type                                     | Constraints                 | Notes                                                     |
| ------------------------- | ---------------------------------------- | --------------------------- | --------------------------------------------------------- |
| `id`                      | UUID                                     | Primary Key                 |                                                           |
| `quote_id`                | UUID                                     | Required, FK → Quote        |                                                           |
| `rfq_line_item_id`        | UUID                                     | Required, FK → RFQLineItem  |                                                           |
| `unit_price`              | NUMERIC(18,4)                            | Required                    | Vendor's quoted unit price                                |
| `quantity_offered`        | NUMERIC(18,4)                            | Required                    | Quantity the vendor can supply                            |
| `discount_percent`        | NUMERIC(5,2)                             | Optional, default `0`       | Percentage discount offered                               |
| `lead_time_days`          | INTEGER                                  | Optional                    | Estimated lead time in days                               |
| `estimated_delivery_date` | DATE                                     | Optional                    | Vendor's estimated delivery date                          |
| `notes`                   | TEXT                                     | Optional                    | Vendor notes per line item                                |
| `approval_status`         | ENUM (`Pending`, `Approved`, `Declined`) | Required, default `Pending` | Contractor's decision on this line                        |
| `approved_quantity`       | NUMERIC(18,4)                            | Optional                    | The quantity the contractor approves (≤ quantity_offered) |
| `approved_by_user_id`     | UUID                                     | Optional, FK → User         |                                                           |
| `approved_at`             | TIMESTAMP                                | Optional                    |                                                           |

#### Constraints

- `(quote_id, rfq_line_item_id)` must be unique (one vendor response per line)
- `approved_quantity` must not exceed `quantity_offered`

#### Key Indexes

| Index                        | Columns                     | Purpose                                    |
| ---------------------------- | --------------------------- | ------------------------------------------ |
| `idx_quotelineitem_quote`    | `quote_id`                  | List all lines in a quote                  |
| `idx_quotelineitem_rfqline`  | `rfq_line_item_id`          | Cross-vendor price comparison per RFQ line |
| `idx_quotelineitem_approval` | `quote_id, approval_status` | Filter approved/declined lines             |

---

### 15. PurchaseOrder

**Last synced with Prisma schema**: 2026-03-18

**Description**: A formal commitment to purchase from a Vendor. POs are the central document of the
procurement workflow. They can be created from approved RFQ quotes, from bulk order drawdowns, or
manually. The system assigns a unique PO number to every PO.

**Table**: `purchase_orders`

#### Fields

| Field                        | Type          | Constraints                             | Notes                                                |
| ---------------------------- | ------------- | --------------------------------------- | ---------------------------------------------------- |
| `id`                         | UUID          | Primary Key, required                   |                                                      |
| `po_number`                  | VARCHAR(50)   | Required, unique (system-generated)     | e.g. `PO-2026-00137`                                 |
| `project_id`                 | UUID          | Required, FK → Project                  |                                                      |
| `company_id`                 | UUID          | Required, FK → Company (Contractor)     | Owning contractor company                            |
| `vendor_id`                  | UUID          | Required, FK → Company (Vendor)         |                                                      |
| `rfq_id`                     | UUID          | Optional, FK → Rfq                      | Set when PO is sourced from an RFQ                   |
| `parent_po_id`               | UUID          | Optional, FK → PurchaseOrder (self-ref) | Parent PO for split/drawdown POs                     |
| `status`                     | ENUM          | Required, default `DRAFT`               | `PoStatus` — see enum below                          |
| `po_type`                    | ENUM          | Required, default `STANDARD`            | `PoType` — see enum below                            |
| `approval_status`            | ENUM          | Required, default `NOT_REQUIRED`        | `ApprovalStatus`                                     |
| `source_of_creation`         | ENUM          | Required, default `MANUAL`              | `PoSourceOfCreation` — see enum below                |
| `priority`                   | ENUM          | Optional                                | `PoPriority`: LOW, MEDIUM, HIGH                      |
| `revision`                   | INT           | Required, default `1`                   | Increments on each accepted change request           |
| `delivery_location_id`       | UUID          | Optional, FK → ProjectLocation          |                                                      |
| `pick_up`                    | BOOLEAN       | Required, default `false`               | When true, delivery fields are suppressed            |
| `pick_up_location`           | TEXT          | Optional                                | Address for pick-up                                  |
| `pick_up_time_expectation`   | ENUM          | Optional                                | `PickUpTimeExpectation`: ASAP, TOMORROW, CUSTOM_DATE |
| `pick_up_person_name`        | TEXT          | Optional                                |                                                      |
| `pick_up_person_phone`       | TEXT          | Optional                                |                                                      |
| `hold_for_release`           | BOOLEAN       | Required, default `false`               |                                                      |
| `deadline_start`             | DATETIME      | Optional                                | Earliest delivery date                               |
| `deadline_end`               | DATETIME      | Optional                                | Latest delivery date (need-by date)                  |
| `planned_delivery_date`      | DATETIME      | Optional                                | Vendor-confirmed planned delivery date               |
| `delivery_notes`             | TEXT          | Optional                                |                                                      |
| `delivery_responsible_name`  | TEXT          | Optional                                |                                                      |
| `delivery_responsible_email` | TEXT          | Optional                                |                                                      |
| `currency`                   | VARCHAR(3)    | Required, default `AUD`                 | ISO 4217                                             |
| `subtotal`                   | DECIMAL(18,4) | Optional                                |                                                      |
| `discount_amount`            | DECIMAL(18,4) | Optional                                |                                                      |
| `tax_amount`                 | DECIMAL(18,4) | Optional                                |                                                      |
| `total_amount`               | DECIMAL(18,4) | Optional                                | Computed from line items                             |
| `payment_terms_days`         | INT           | Optional                                | e.g. 30 for Net 30                                   |
| `cost_code`                  | VARCHAR(100)  | Optional                                |                                                      |
| `message`                    | TEXT          | Optional                                | Internal or external message                         |
| `line_item_count`            | INT           | Required, default `0`                   | Count of line items                                  |
| `total_requested_qty`        | INT           | Required, default `0`                   | Aggregate quantity across line items                 |
| `issued_at`                  | TIMESTAMP     | Optional                                | When status transitioned to SENT                     |
| `approved_by_id`             | UUID          | Optional, FK → User                     |                                                      |
| `created_by_user_id`         | UUID          | Required, FK → User                     |                                                      |
| `last_modified_by_id`        | UUID          | Optional, FK → User                     |                                                      |
| `created_at`                 | TIMESTAMP     | Required, default now()                 |                                                      |
| `updated_at`                 | TIMESTAMP     | Required, auto-updated                  |                                                      |

#### PO Type Enum — `PoType`

| Value              | Description                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `STANDARD`         | A normal one-off purchase order                                                                  |
| `BULK`             | A bulk purchase order                                                                            |
| `HOLD_FOR_RELEASE` | A PO issued but with a mandatory earliest delivery date before which the vendor must not deliver |
| `DRAWDOWN`         | A PO drawing down quantity from an active BulkOrder                                              |
| `SPLIT`            | A PO split from a parent PO                                                                      |

#### Source of Creation Enum — `PoSourceOfCreation`

| Value              | Description                     |
| ------------------ | ------------------------------- |
| `RFQ`              | Created from an awarded RFQ     |
| `BULK_DRAWDOWN`    | Drawn down from a bulk order    |
| `MATERIAL_REQUEST` | Created from a material request |
| `MANUAL`           | Manually created                |

#### Approval Status Enum — `ApprovalStatus`

| Value          | Description        |
| -------------- | ------------------ |
| `NOT_REQUIRED` | No approval needed |
| `PENDING`      | Awaiting approval  |
| `APPROVED`     | Approved           |
| `REJECTED`     | Rejected           |

#### Pick-Up Time Expectation Enum — `PickUpTimeExpectation`

| Value         | Description            |
| ------------- | ---------------------- |
| `ASAP`        | As soon as possible    |
| `TOMORROW`    | Next business day      |
| `CUSTOM_DATE` | Specific date provided |

#### Status Enum — `PoStatus`

| Status                   | Description                                  |
| ------------------------ | -------------------------------------------- |
| `DRAFT`                  | Being composed; not visible to vendor        |
| `PENDING_APPROVAL`       | Awaiting internal approval                   |
| `APPROVED`               | Internally approved; ready to send           |
| `SENT`                   | Sent to the vendor; awaiting acknowledgement |
| `ACKNOWLEDGED`           | Vendor has acknowledged receipt              |
| `ACCEPTED`               | Vendor has accepted the PO                   |
| `DECLINED`               | Vendor has declined the PO                   |
| `SCHEDULED_FOR_DELIVERY` | Delivery has been scheduled                  |
| `CANCELLED`              | PO abandoned                                 |
| `CLOSED`                 | All goods delivered and reconciled           |
| `PARTIALLY_DELIVERED`    | Some line items delivered                    |
| `DELIVERED`              | All goods delivered                          |
| `LATE_FOR_DELIVERY`      | Past deadline, not yet delivered             |
| `CANCELLED_BY_VENDOR`    | Vendor cancelled the PO                      |
| `INVOICED`               | Invoice received for this PO                 |
| `DISPUTE`                | PO is in dispute                             |
| `NOT_DELIVERED`          | Delivery failed or not received              |
| `CHANGE_PENDING`         | A change request is pending                  |

#### PO Change Type Enum — `PoChangeType`

| Value        | Description                                             |
| ------------ | ------------------------------------------------------- |
| `COMMERCIAL` | Price, quantity, or delivery changes (require approval) |
| `INTERNAL`   | Internal notes, cost codes, etc. (applied immediately)  |

#### Relationships

- Belongs to one **Project**
- Belongs to one **Company** (Contractor, via `company_id`)
- Issued to one **Company** (Vendor, via `vendor_id`)
- Sourced from one **Rfq** (optional)
- Parent of many **PurchaseOrder** (self-referential via `parent_po_id`)
- Child of one **PurchaseOrder** (optional, via `parent_po_id`)
- Delivery at one **ProjectLocation** (optional)
- Approved by one **User** (optional)
- Created by one **User**
- Last modified by one **User** (optional)
- Has many **PoLineItem**
- Has many **PoDocument**
- Has many **PoChangeRequest**
- Has many **Drawdown**
- Has many **Invoice** (via `InvoiceRelatedPo`)

#### Key Indexes

| Index                       | Columns                | Purpose                           |
| --------------------------- | ---------------------- | --------------------------------- |
| `idx_pos_company`           | `company_id`           | Contractor's PO dashboard         |
| `idx_pos_project`           | `project_id`           | POs for a project                 |
| `idx_pos_vendor`            | `vendor_id`            | Vendor's PO dashboard             |
| `idx_pos_status`            | `status`               | Filter by status                  |
| `idx_pos_parent`            | `parent_po_id`         | Child POs of a parent             |
| `idx_pos_rfq`               | `rfq_id`               | Link POs back to their source RFQ |
| `idx_pos_delivery_location` | `delivery_location_id` | Filter by delivery location       |

---

### 16. POLineItem

**Last synced with Prisma schema**: 2026-03-18

**Description**: A single material line within a Purchase Order, specifying material, quantity, and
agreed pricing.

**Table**: `po_line_items`

#### Fields

| Field                    | Type          | Constraints                    | Notes                                           |
| ------------------------ | ------------- | ------------------------------ | ----------------------------------------------- |
| `id`                     | UUID          | Primary Key                    |                                                 |
| `purchase_order_id`      | UUID          | Required, FK → PurchaseOrder   | Cascade delete                                  |
| `line_number`            | INT           | Required                       | Sequential line number within the PO            |
| `material_id`            | UUID          | Required, FK → Material        |                                                 |
| `material_code`          | VARCHAR(100)  | Optional                       | Supplier or internal material code              |
| `description`            | TEXT          | Optional                       | Line-item description                           |
| `quantity_ordered`       | INT           | Required                       |                                                 |
| `quantity_delivered`     | INT           | Required, default `0`          | Aggregate from approved DeliveryReportLineItems |
| `unit_of_measure`        | VARCHAR(50)   | Required                       |                                                 |
| `unit_price`             | DECIMAL(18,4) | Required                       | Agreed price per unit                           |
| `line_total`             | DECIMAL(18,4) | Required                       | Computed line total                             |
| `cost_code`              | VARCHAR(100)  | Optional                       |                                                 |
| `expected_delivery_date` | DATETIME      | Optional                       |                                                 |
| `delivery_location_id`   | UUID          | Optional, FK → ProjectLocation | Line-level delivery location                    |
| `notes`                  | TEXT          | Optional                       |                                                 |

#### Key Indexes

| Index                        | Columns             | Purpose                     |
| ---------------------------- | ------------------- | --------------------------- |
| `idx_po_line_items_po`       | `purchase_order_id` | List all line items in a PO |
| `idx_po_line_items_material` | `material_id`       | Material usage across POs   |

---

### 17. POChangeRequest

**Last synced with Prisma schema**: 2026-03-18

**Description**: Records a proposed change to a PO. Commercial changes (e.g. price, quantity,
delivery date) require counter-party approval. Internal changes (e.g. internal notes, cost codes)
are applied immediately.

**Table**: `po_change_requests`

#### Fields

| Field               | Type      | Constraints                  | Notes                                         |
| ------------------- | --------- | ---------------------------- | --------------------------------------------- |
| `id`                | UUID      | Primary Key                  |                                               |
| `purchase_order_id` | UUID      | Required, FK → PurchaseOrder | Cascade delete                                |
| `change_type`       | ENUM      | Required, `PoChangeType`     | `COMMERCIAL` or `INTERNAL`                    |
| `changed_fields`    | JSON      | Required                     | Snapshot of `{field: {old_value, new_value}}` |
| `requested_by_id`   | UUID      | Required, FK → User          | User who proposed the change                  |
| `approved_by_id`    | UUID      | Optional, FK → User          | Counter-party who approved or rejected        |
| `created_at`        | TIMESTAMP | Required, default now()      |                                               |

> **Planned — T748**: `status` (ENUM: Pending/Approved/Rejected), `reviewed_at` (TIMESTAMP) — not
> yet in schema.

#### Key Indexes

| Index                       | Columns             | Purpose                |
| --------------------------- | ------------------- | ---------------------- |
| `idx_po_change_requests_po` | `purchase_order_id` | Change requests per PO |

---

### 18. BulkOrder

**Description**: A pre-committed supply agreement with a Vendor for a defined period. Created
exclusively from approved RFQ Quotes. Tracks available quantity per material. Multiple POs
(BulkDrawdown type) draw down from a BulkOrder over time. Can optionally be restricted to specific
Projects.

#### Fields

| Field                           | Type        | Constraints                              | Notes                                               |
| ------------------------------- | ----------- | ---------------------------------------- | --------------------------------------------------- |
| `id`                            | UUID        | Primary Key, required                    |                                                     |
| `bulk_order_number`             | VARCHAR(50) | Required, unique (system-generated)      |                                                     |
| `company_id`                    | UUID        | Required, FK → Company (type=Contractor) | Owning contractor                                   |
| `vendor_company_id`             | UUID        | Required, FK → Company (type=Vendor)     |                                                     |
| `source_quote_id`               | UUID        | Required, FK → Quote                     | The approved Quote this bulk order was created from |
| `rfq_id`                        | UUID        | Optional, FK → RFQ                       | The originating RFQ                                 |
| `status`                        | ENUM        | Required, default `Active`               | See status state machine below                      |
| `currency`                      | VARCHAR(3)  | Required, default `AUD`                  |                                                     |
| `start_date`                    | DATE        | Required                                 | When the bulk agreement becomes effective           |
| `end_date`                      | DATE        | Required                                 | When the bulk agreement expires                     |
| `proposed_end_date`             | DATE        | Optional                                 | Set when an extension proposal is pending           |
| `extension_proposed_by_user_id` | UUID        | Optional, FK → User                      |                                                     |
| `extension_proposed_at`         | TIMESTAMP   | Optional                                 |                                                     |
| `is_project_restricted`         | BOOLEAN     | Required, default `false`                | If true, only listed projects may draw down         |
| `notes`                         | TEXT        | Optional                                 |                                                     |
| `created_by_user_id`            | UUID        | Required, FK → User                      |                                                     |
| `created_at`                    | TIMESTAMP   | Required, default now()                  |                                                     |
| `updated_at`                    | TIMESTAMP   | Required, auto-updated                   |                                                     |

#### Status Enum and State Machine

| Status                      | Description                                                   |
| --------------------------- | ------------------------------------------------------------- |
| `Active`                    | Agreement is in effect; drawdowns permitted                   |
| `Expired`                   | End date has passed; no new drawdowns permitted               |
| `Cancelled`                 | Terminated before end date                                    |
| `PendingVendorConfirmation` | Vendor has not yet confirmed the initial bulk agreement terms |

```
PendingVendorConfirmation → Active      (vendor confirms terms)
PendingVendorConfirmation → Cancelled   (vendor rejects or contractor cancels)
Active                    → Expired     (automatic on end_date passing)
Active                    → Cancelled   (explicit cancellation by either party)
Active                    → Active      (extension approved — end_date updated in-place)
```

Extension proposals: while a proposal is pending (`proposed_end_date` is set), the current
`end_date` remains in force. On vendor approval, `end_date` is updated to `proposed_end_date` and
`proposed_end_date` is cleared.

#### Relationships

- Belongs to one **Company** (Contractor)
- Agreed with one **Company** (Vendor)
- Created from one **Quote**
- Has many **BulkOrderLineItems**
- Has many **BulkOrderProjectRestrictions** (when `is_project_restricted = true`)
- Referenced by many **PurchaseOrders** (BulkDrawdown type)

#### Key Indexes

| Index                          | Columns                     | Purpose                           |
| ------------------------------ | --------------------------- | --------------------------------- |
| `idx_bulkorder_company_status` | `company_id, status`        | Contractor's active bulk orders   |
| `idx_bulkorder_vendor_status`  | `vendor_company_id, status` | Vendor's active bulk orders       |
| `idx_bulkorder_end_date`       | `end_date, status`          | Expiry monitoring and suggestions |

---

### 19. BulkOrderLineItem

**Description**: A single material commitment within a BulkOrder, tracking the total committed
quantity and the remaining available quantity for drawdown.

#### Fields

| Field                | Type          | Constraints              | Notes                                   |
| -------------------- | ------------- | ------------------------ | --------------------------------------- |
| `id`                 | UUID          | Primary Key              |                                         |
| `bulk_order_id`      | UUID          | Required, FK → BulkOrder |                                         |
| `material_id`        | UUID          | Required, FK → Material  |                                         |
| `unit_price`         | NUMERIC(18,4) | Required                 | Agreed bulk price per unit              |
| `quantity_committed` | NUMERIC(18,4) | Required, > 0            | Total quantity agreed in the bulk order |
| `quantity_drawn`     | NUMERIC(18,4) | Required, default `0`    | Sum of all approved drawdown quantities |
| `quantity_remaining` | NUMERIC(18,4) | Computed                 | `quantity_committed − quantity_drawn`   |
| `unit_of_measure`    | VARCHAR(50)   | Required                 |                                         |

#### Constraints

- `(bulk_order_id, material_id)` should be unique (one pricing line per material per bulk order)
- A drawdown request must not cause `quantity_drawn` to exceed `quantity_committed`

#### Key Indexes

| Index                            | Columns         | Purpose                                 |
| -------------------------------- | --------------- | --------------------------------------- |
| `idx_bulkorderlineitem_bulk`     | `bulk_order_id` | List all lines in a bulk order          |
| `idx_bulkorderlineitem_material` | `material_id`   | Find bulk order coverage for a material |

---

### 20. BulkOrderProjectRestriction

**Description**: When a BulkOrder is project-restricted, this table lists the Projects that are
permitted to initiate drawdowns against it.

#### Fields

| Field           | Type | Constraints              | Notes |
| --------------- | ---- | ------------------------ | ----- |
| `id`            | UUID | Primary Key              |       |
| `bulk_order_id` | UUID | Required, FK → BulkOrder |       |
| `project_id`    | UUID | Required, FK → Project   |       |

#### Constraints

- `(bulk_order_id, project_id)` must be unique

---

### 21. BulkDrawdown

**Description**: Records the fulfilment of a drawdown event — when a BulkDrawdown-type PurchaseOrder
is issued against a BulkOrder. Tracks the quantities drawn per line item and maintains the link
between the PO and the BulkOrder.

#### Fields

| Field                | Type      | Constraints                          | Notes                     |
| -------------------- | --------- | ------------------------------------ | ------------------------- |
| `id`                 | UUID      | Primary Key                          |                           |
| `bulk_order_id`      | UUID      | Required, FK → BulkOrder             |                           |
| `purchase_order_id`  | UUID      | Required, unique, FK → PurchaseOrder | One PO per drawdown event |
| `created_by_user_id` | UUID      | Required, FK → User                  |                           |
| `created_at`         | TIMESTAMP | Required, default now()              |                           |

---

### 22. Invoice

**Description**: A payment request submitted by a Vendor, typically uploaded as a file. Invoices can
be linked to one or more POs. The platform extracts structured data from the file, presents it for
review, and then performs three-way reconciliation against ordered and delivered quantities.

#### Fields

| Field                     | Type                                    | Constraints                              | Notes                                        |
| ------------------------- | --------------------------------------- | ---------------------------------------- | -------------------------------------------- |
| `id`                      | UUID                                    | Primary Key, required                    |                                              |
| `invoice_number`          | VARCHAR(255)                            | Required                                 | As stated on the vendor's invoice document   |
| `vendor_company_id`       | UUID                                    | Required, FK → Company (type=Vendor)     |                                              |
| `contractor_company_id`   | UUID                                    | Required, FK → Company (type=Contractor) |                                              |
| `status`                  | ENUM                                    | Required, default `Uploaded`             | See status state machine below               |
| `currency`                | VARCHAR(3)                              | Required, default `AUD`                  |                                              |
| `total_amount`            | NUMERIC(18,4)                           | Optional                                 | Extracted or manually entered total          |
| `tax_amount`              | NUMERIC(18,4)                           | Optional                                 |                                              |
| `invoice_date`            | DATE                                    | Optional                                 | Date on the vendor's invoice                 |
| `due_date`                | DATE                                    | Optional                                 | Payment due date                             |
| `payment_terms`           | VARCHAR(255)                            | Optional                                 | e.g. `Net 30`                                |
| `file_url`                | VARCHAR(500)                            | Required                                 | Storage URL of the uploaded file             |
| `file_name`               | VARCHAR(255)                            | Required                                 | Original file name                           |
| `file_type`               | VARCHAR(50)                             | Required                                 | MIME type                                    |
| `ocr_status`              | ENUM (`Pending`, `Completed`, `Failed`) | Required, default `Pending`              | Status of the data extraction job            |
| `ocr_confidence_score`    | NUMERIC(5,2)                            | Optional                                 | 0–100 confidence score from OCR engine       |
| `uploaded_by_user_id`     | UUID                                    | Required, FK → User                      |                                              |
| `reviewed_by_user_id`     | UUID                                    | Optional, FK → User                      | User who reviewed extracted data             |
| `reviewed_at`             | TIMESTAMP                               | Optional                                 |                                              |
| `approved_by_user_id`     | UUID                                    | Optional, FK → User                      |                                              |
| `approved_at`             | TIMESTAMP                               | Optional                                 |                                              |
| `paid_at`                 | TIMESTAMP                               | Optional                                 |                                              |
| `payment_due_notified_at` | TIMESTAMP                               | Optional                                 | When the due-date notification was last sent |
| `created_at`              | TIMESTAMP                               | Required, default now()                  |                                              |
| `updated_at`              | TIMESTAMP                               | Required, auto-updated                   |                                              |

#### Status Enum and State Machine

| Status        | Description                                                                |
| ------------- | -------------------------------------------------------------------------- |
| `Uploaded`    | File received; OCR extraction in progress or pending review                |
| `UnderReview` | Extracted data has been reviewed and confirmed; reconciliation in progress |
| `Approved`    | Fully reconciled and approved for payment                                  |
| `Disputed`    | One or more line items have been rejected; dispute thread open             |
| `Paid`        | Payment has been confirmed                                                 |

```
Uploaded     → UnderReview   (user reviews and confirms extracted data)
UnderReview  → Approved      (all line items reconciled and approved)
UnderReview  → Disputed      (one or more line items rejected)
Disputed     → UnderReview   (dispute resolved; re-reconciliation begins)
Disputed     → Approved      (dispute resolved in favour of vendor; all items approved)
Approved     → Paid          (payment marked as made)
Approved     → Disputed      (post-approval dispute raised — exceptional case)
```

#### Relationships

- Submitted by one **Company** (Vendor)
- Directed at one **Company** (Contractor)
- Uploaded by one **User**
- Linked to many **PurchaseOrders** via **InvoicePO**
- Has many **InvoiceLineItems**
- Has many **InvoiceDisputes**

#### Key Indexes

| Index                           | Columns                         | Purpose                        |
| ------------------------------- | ------------------------------- | ------------------------------ |
| `idx_invoice_vendor_status`     | `vendor_company_id, status`     | Vendor invoice list            |
| `idx_invoice_contractor_status` | `contractor_company_id, status` | Contractor invoice list        |
| `idx_invoice_due_date`          | `due_date, status`              | Payment due date notifications |
| `idx_invoice_number`            | `invoice_number`                | Search by invoice number       |
| `idx_invoice_uploaded_by`       | `uploaded_by_user_id`           | "My invoices" filter           |

---

### 23. InvoicePO

**Description**: Join table linking an Invoice to one or more PurchaseOrders. One invoice can span
multiple POs; one PO can have multiple invoices (partial deliveries).

#### Fields

| Field               | Type      | Constraints                  | Notes |
| ------------------- | --------- | ---------------------------- | ----- |
| `id`                | UUID      | Primary Key                  |       |
| `invoice_id`        | UUID      | Required, FK → Invoice       |       |
| `purchase_order_id` | UUID      | Required, FK → PurchaseOrder |       |
| `linked_at`         | TIMESTAMP | Required, default now()      |       |
| `linked_by_user_id` | UUID      | Required, FK → User          |       |

#### Constraints

- `(invoice_id, purchase_order_id)` must be unique

#### Key Indexes

| Index                   | Columns             | Purpose                  |
| ----------------------- | ------------------- | ------------------------ |
| `idx_invoicepo_invoice` | `invoice_id`        | POs linked to an invoice |
| `idx_invoicepo_po`      | `purchase_order_id` | Invoices linked to a PO  |

---

### 24. InvoiceLineItem

**Description**: A single line on the vendor's invoice, representing a billed item. Each line is
matched (reconciled) against a POLineItem. Tracks ordered, delivered, and invoiced quantities
side-by-side for three-way match.

#### Fields

| Field                 | Type                                     | Constraints                 | Notes                                    |
| --------------------- | ---------------------------------------- | --------------------------- | ---------------------------------------- |
| `id`                  | UUID                                     | Primary Key                 |                                          |
| `invoice_id`          | UUID                                     | Required, FK → Invoice      |                                          |
| `po_line_item_id`     | UUID                                     | Optional, FK → POLineItem   | Set after reconciliation matching        |
| `description`         | TEXT                                     | Required                    | As extracted or entered from the invoice |
| `quantity_invoiced`   | NUMERIC(18,4)                            | Required                    | Quantity the vendor is billing for       |
| `unit_price`          | NUMERIC(18,4)                            | Required                    | Vendor's billed unit price               |
| `total_price`         | NUMERIC(18,4)                            | Required                    |                                          |
| `unit_of_measure`     | VARCHAR(50)                              | Optional                    |                                          |
| `approval_status`     | ENUM (`Pending`, `Approved`, `Rejected`) | Required, default `Pending` | Contractor's reconciliation decision     |
| `rejected_reason`     | TEXT                                     | Optional                    | Reason for rejection (triggers dispute)  |
| `approved_by_user_id` | UUID                                     | Optional, FK → User         |                                          |
| `approved_at`         | TIMESTAMP                                | Optional                    |                                          |

#### Key Indexes

| Index                          | Columns                       | Purpose                             |
| ------------------------------ | ----------------------------- | ----------------------------------- |
| `idx_invoicelineitem_invoice`  | `invoice_id`                  | All lines for an invoice            |
| `idx_invoicelineitem_po_line`  | `po_line_item_id`             | Cross-reference invoiced vs ordered |
| `idx_invoicelineitem_approval` | `invoice_id, approval_status` | Filter approved/rejected lines      |

---

### 25. DeliveryReport

**Description**: A record of goods received against a specific PurchaseOrder. Can be submitted by a
registered platform user or by an external (non-registered) delivery person via a QR code /
tokenized URL. Externally submitted reports require Company Admin approval before they affect PO
delivery status.

#### Fields

| Field                         | Type         | Constraints                  | Notes                                      |
| ----------------------------- | ------------ | ---------------------------- | ------------------------------------------ |
| `id`                          | UUID         | Primary Key, required        |                                            |
| `purchase_order_id`           | UUID         | Required, FK → PurchaseOrder |                                            |
| `status`                      | ENUM         | Required, default `Draft`    | See status state machine below             |
| `submitted_by_user_id`        | UUID         | Optional, FK → User          | Null for external (tokenized) submissions  |
| `submitted_by_external_name`  | VARCHAR(255) | Optional                     | Name provided by external delivery person  |
| `submitted_by_external_email` | VARCHAR(255) | Optional                     | Email used for OTP verification            |
| `submission_token`            | VARCHAR(255) | Optional, unique             | QR code / URL token for external access    |
| `submission_token_expires_at` | TIMESTAMP    | Optional                     |                                            |
| `submission_otp`              | VARCHAR(10)  | Optional                     | Hashed OTP; valid 15 minutes               |
| `submission_otp_expires_at`   | TIMESTAMP    | Optional                     |                                            |
| `is_external`                 | BOOLEAN      | Required, default `false`    | `true` for QR code / tokenized submissions |
| `notes`                       | TEXT         | Optional                     | General delivery notes                     |
| `reviewed_by_user_id`         | UUID         | Optional, FK → User          | Company Admin who approved/rejected        |
| `review_comment`              | TEXT         | Optional                     | Comment from reviewer                      |
| `reviewed_at`                 | TIMESTAMP    | Optional                     |                                            |
| `submitted_at`                | TIMESTAMP    | Optional                     | When status transitioned to Submitted      |
| `created_at`                  | TIMESTAMP    | Required, default now()      |                                            |
| `updated_at`                  | TIMESTAMP    | Required, auto-updated       |                                            |

#### Status Enum and State Machine

| Status            | Description                                                     |
| ----------------- | --------------------------------------------------------------- |
| `Draft`           | Being composed by an internal user                              |
| `Submitted`       | Submitted (by internal user or external person)                 |
| `PendingApproval` | External submission awaiting Company Admin review               |
| `Approved`        | Accepted; affects PO delivery status and invoice reconciliation |
| `Rejected`        | Rejected by Company Admin; does not affect PO status            |

```
Draft          → Submitted       (internal user submits)
Submitted      → Approved        (auto-approved for internal users if no approval scenario set)
Submitted      → PendingApproval (external submission, always requires review)
PendingApproval → Approved       (Company Admin approves)
PendingApproval → Rejected       (Company Admin rejects)
```

#### Relationships

- Belongs to one **PurchaseOrder**
- Submitted by one **User** (optional, null for external)
- Reviewed by one **User** (Company Admin)
- Has many **DeliveryReportLineItems**

#### Key Indexes

| Index                          | Columns                                     | Purpose                    |
| ------------------------------ | ------------------------------------------- | -------------------------- |
| `idx_deliveryreport_po_status` | `purchase_order_id, status`                 | Reports for a PO by status |
| `idx_deliveryreport_token`     | `submission_token`                          | Tokenized external access  |
| `idx_deliveryreport_pending`   | `status` WHERE `status = 'PendingApproval'` | Admin review queue         |

---

### 26. DeliveryReportLineItem

**Description**: Records the delivery outcome for a single POLineItem within a DeliveryReport.

#### Fields

| Field                | Type                                                                 | Constraints                   | Notes                   |
| -------------------- | -------------------------------------------------------------------- | ----------------------------- | ----------------------- |
| `id`                 | UUID                                                                 | Primary Key                   |                         |
| `delivery_report_id` | UUID                                                                 | Required, FK → DeliveryReport |                         |
| `po_line_item_id`    | UUID                                                                 | Required, FK → POLineItem     |                         |
| `quantity_delivered` | NUMERIC(18,4)                                                        | Required, ≥ 0                 |                         |
| `outcome`            | ENUM (`Delivered`, `PartiallyDelivered`, `NotDelivered`, `Rejected`) | Required                      | Outcome per line item   |
| `notes`              | TEXT                                                                 | Optional                      | e.g. damage description |

#### Constraints

- `(delivery_report_id, po_line_item_id)` must be unique

#### Key Indexes

| Index                    | Columns              | Purpose                                    |
| ------------------------ | -------------------- | ------------------------------------------ |
| `idx_drlineitem_report`  | `delivery_report_id` | All lines in a delivery report             |
| `idx_drlineitem_po_line` | `po_line_item_id`    | Aggregate delivered quantities per PO line |

---

### 27. Notification

**Description**: A system-generated message delivered in-app and/or by email. Every notification is
linked to a specific recipient User and a source document (the document is referenced via
polymorphic `entity_type` + `entity_id`). Users can configure which notification types they receive
and via which channels.

#### Fields

| Field               | Type                            | Constraints               | Notes                                                                                  |
| ------------------- | ------------------------------- | ------------------------- | -------------------------------------------------------------------------------------- |
| `id`                | UUID                            | Primary Key, required     |                                                                                        |
| `recipient_user_id` | UUID                            | Required, FK → User       |                                                                                        |
| `type`              | ENUM                            | Required                  | See Notification Type enum below                                                       |
| `entity_type`       | VARCHAR(100)                    | Required                  | The entity class this notification relates to (e.g. `RFQ`, `PurchaseOrder`, `Invoice`) |
| `entity_id`         | UUID                            | Required                  | The specific entity instance                                                           |
| `title`             | VARCHAR(500)                    | Required                  | Short notification title                                                               |
| `body`              | TEXT                            | Optional                  | Extended message body                                                                  |
| `is_read`           | BOOLEAN                         | Required, default `false` |                                                                                        |
| `read_at`           | TIMESTAMP                       | Optional                  |                                                                                        |
| `channel`           | ENUM (`InApp`, `Email`, `Both`) | Required                  | Delivery channel                                                                       |
| `email_sent_at`     | TIMESTAMP                       | Optional                  | When email was dispatched                                                              |
| `created_at`        | TIMESTAMP                       | Required, default now()   |                                                                                        |

#### Notification Type Enum (non-exhaustive)

| Type                            | Trigger Event                             |
| ------------------------------- | ----------------------------------------- |
| `UserInvited`                   | New user invitation sent                  |
| `AccountDeactivated`            | User account deactivated                  |
| `AccountReactivated`            | User account reactivated                  |
| `RFQSent`                       | RFQ sent to vendor                        |
| `RFQUpdated`                    | RFQ edited after being sent               |
| `RFQClosed`                     | RFQ closed; non-selected vendors notified |
| `QuoteSubmitted`                | Vendor submits a quote                    |
| `QuoteApproved`                 | Vendor notified of approved line items    |
| `QuoteDeclined`                 | Vendor notified of declined quote         |
| `POIssued`                      | PO sent to vendor                         |
| `POConfirmed`                   | Vendor confirms PO                        |
| `POChangeRequested`             | Change request submitted to counter-party |
| `POChangeApproved`              | Change request approved                   |
| `POChangedRejected`             | Change request rejected                   |
| `BulkOrderExtensionProposed`    | Extension proposal sent to vendor         |
| `BulkOrderExtensionApproved`    | Extension approved                        |
| `InvoiceUploaded`               | New invoice uploaded                      |
| `InvoiceDisputeCreated`         | Invoice line item disputed                |
| `InvoiceApproved`               | Invoice approved for payment              |
| `InvoicePaymentDueSoon`         | Payment due date approaching              |
| `InvoicePaymentOverdue`         | Payment due date passed                   |
| `DeliveryReportPendingApproval` | External delivery report awaiting review  |
| `DeliveryReportApproved`        | Delivery report approved                  |
| `DeliveryReportRejected`        | Delivery report rejected                  |
| `ApprovalRequestCreated`        | New approval request assigned             |
| `ApprovalRequestDecided`        | Approval request approved/rejected        |
| `SystemJobFailed`               | Background job failure (Super Admin only) |

#### Key Indexes

| Index                                | Columns                              | Purpose                                     |
| ------------------------------------ | ------------------------------------ | ------------------------------------------- |
| `idx_notification_recipient_read`    | `recipient_user_id, is_read`         | Unread notifications per user               |
| `idx_notification_recipient_created` | `recipient_user_id, created_at DESC` | Notification inbox feed                     |
| `idx_notification_entity`            | `entity_type, entity_id`             | Notifications linked to a specific document |

---

### 28. AuditLog

**Description**: An immutable, append-only record of every significant action performed on a
business document. Audit log entries cannot be edited or deleted. They provide a complete,
timestamped history of who did what to which document, including the before-and-after values of
changed fields.

#### Fields

| Field            | Type                    | Constraints              | Notes                                                                                                           |
| ---------------- | ----------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `id`             | UUID                    | Primary Key, required    |                                                                                                                 |
| `entity_type`    | VARCHAR(100)            | Required                 | The entity class (e.g. `RFQ`, `PurchaseOrder`, `Invoice`, `User`)                                               |
| `entity_id`      | UUID                    | Required                 | The specific entity instance                                                                                    |
| `action`         | VARCHAR(100)            | Required                 | The action performed (e.g. `Created`, `StatusChanged`, `LineItemApproved`, `FieldUpdated`, `Sent`, `Cancelled`) |
| `actor_user_id`  | UUID                    | Optional, FK → User      | The user who performed the action; null for system-generated actions                                            |
| `actor_type`     | ENUM (`User`, `System`) | Required, default `User` | Distinguishes human actions from automated system events                                                        |
| `timestamp`      | TIMESTAMP               | Required, default now()  | UTC timestamp of the action                                                                                     |
| `changed_fields` | JSONB                   | Optional                 | `{"field_name": {"old": ..., "new": ...}}` — null for Create actions                                            |
| `metadata`       | JSONB                   | Optional                 | Additional context (e.g. IP address, session ID, reason)                                                        |

#### Constraints

- No UPDATE or DELETE operations are permitted on this table
- `actor_user_id` is null only when `actor_type = System`
- The JSONB `changed_fields` structure must follow:
  `{"field_name": {"old_value": ..., "new_value": ...}}`

#### Key Indexes

| Index                    | Columns                                  | Purpose                                   |
| ------------------------ | ---------------------------------------- | ----------------------------------------- |
| `idx_auditlog_entity`    | `entity_type, entity_id, timestamp DESC` | Full history for a specific entity        |
| `idx_auditlog_actor`     | `actor_user_id, timestamp DESC`          | Actions performed by a user               |
| `idx_auditlog_timestamp` | `timestamp DESC`                         | Chronological audit stream                |
| `idx_auditlog_action`    | `entity_type, action`                    | Filter by action type across entity class |

---

### 29. Message

**Description**: An in-app communication message scoped to a specific document (RFQ, PurchaseOrder,
BulkOrder, or Invoice). Messages support file attachments and are visible to all parties with access
to that document. Messages trigger notifications.

#### Fields

| Field            | Type         | Constraints             | Notes                                    |
| ---------------- | ------------ | ----------------------- | ---------------------------------------- |
| `id`             | UUID         | Primary Key, required   |                                          |
| `entity_type`    | VARCHAR(100) | Required                | The document type this thread belongs to |
| `entity_id`      | UUID         | Required                | The specific document                    |
| `sender_user_id` | UUID         | Required, FK → User     |                                          |
| `body`           | TEXT         | Required                | Message text                             |
| `created_at`     | TIMESTAMP    | Required, default now() |                                          |

#### Relationships

- Belongs to one **User** (sender)
- Has many **MessageAttachments**

#### Key Indexes

| Index                | Columns                                  | Purpose                    |
| -------------------- | ---------------------------------------- | -------------------------- |
| `idx_message_entity` | `entity_type, entity_id, created_at ASC` | Thread chronological order |

---

### 30. MessageAttachment

**Description**: A file attached to a Message. Maximum size 10 MB per file.

#### Fields

| Field             | Type         | Constraints             | Notes                              |
| ----------------- | ------------ | ----------------------- | ---------------------------------- |
| `id`              | UUID         | Primary Key             |                                    |
| `message_id`      | UUID         | Required, FK → Message  |                                    |
| `file_url`        | VARCHAR(500) | Required                |                                    |
| `file_name`       | VARCHAR(255) | Required                |                                    |
| `file_type`       | VARCHAR(50)  | Required                | MIME type                          |
| `file_size_bytes` | INTEGER      | Required                | Must not exceed 10,485,760 (10 MB) |
| `uploaded_at`     | TIMESTAMP    | Required, default now() |                                    |

---

### 31. ApprovalScenario

**Description**: Optional configuration per Contractor company that defines which workflow actions
require explicit approval, the triggering condition (e.g. PO amount threshold), and which users are
assigned as approvers. By default all scenarios are disabled.

#### Fields

| Field              | Type         | Constraints                              | Notes                                                                                 |
| ------------------ | ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `id`               | UUID         | Primary Key                              |                                                                                       |
| `company_id`       | UUID         | Required, FK → Company (type=Contractor) |                                                                                       |
| `scenario_type`    | VARCHAR(100) | Required                                 | Predefined type key (e.g. `POAboveThreshold`, `BulkOrderCreation`, `InvoiceApproval`) |
| `is_active`        | BOOLEAN      | Required, default `false`                |                                                                                       |
| `condition_config` | JSONB        | Optional                                 | Condition parameters (e.g. `{"amount_threshold": 50000}`)                             |
| `created_at`       | TIMESTAMP    | Required, default now()                  |                                                                                       |
| `updated_at`       | TIMESTAMP    | Required, auto-updated                   |                                                                                       |

#### Relationships

- Has many **ApprovalScenarioApprover** (assigned users)
- Has many **ApprovalRequests**

---

### 32. ApprovalScenarioApprover

**Description**: Assigns one or more Users as approvers for a specific ApprovalScenario.

#### Fields

| Field                  | Type | Constraints                     | Notes                                      |
| ---------------------- | ---- | ------------------------------- | ------------------------------------------ |
| `id`                   | UUID | Primary Key                     |                                            |
| `approval_scenario_id` | UUID | Required, FK → ApprovalScenario |                                            |
| `user_id`              | UUID | Required, FK → User             | Must be an active user in the same company |

#### Constraints

- `(approval_scenario_id, user_id)` must be unique
- At least one approver must exist per active ApprovalScenario

---

### 33. ApprovalRequest

**Description**: A specific instance of a workflow action that has been gated by an active
ApprovalScenario. Tracks the approval state and all decisions made.

#### Fields

| Field                       | Type                                                         | Constraints                     | Notes                                                    |
| --------------------------- | ------------------------------------------------------------ | ------------------------------- | -------------------------------------------------------- |
| `id`                        | UUID                                                         | Primary Key                     |                                                          |
| `approval_scenario_id`      | UUID                                                         | Required, FK → ApprovalScenario |                                                          |
| `entity_type`               | VARCHAR(100)                                                 | Required                        | The document type requiring approval                     |
| `entity_id`                 | UUID                                                         | Required                        | The specific document instance                           |
| `status`                    | ENUM (`Pending`, `Approved`, `Rejected`, `ChangesRequested`) | Required, default `Pending`     |                                                          |
| `requested_by_user_id`      | UUID                                                         | Required, FK → User             | The user whose action triggered the approval requirement |
| `assigned_approver_user_id` | UUID                                                         | Required, FK → User             | The approver assigned to review                          |
| `decision_comment`          | TEXT                                                         | Optional                        | Comment from approver                                    |
| `decided_by_user_id`        | UUID                                                         | Optional, FK → User             |                                                          |
| `decided_at`                | TIMESTAMP                                                    | Optional                        |                                                          |
| `created_at`                | TIMESTAMP                                                    | Required, default now()         |                                                          |
| `updated_at`                | TIMESTAMP                                                    | Required, auto-updated          |                                                          |

#### Key Indexes

| Index                                 | Columns                             | Purpose                                   |
| ------------------------------------- | ----------------------------------- | ----------------------------------------- |
| `idx_approvalrequest_approver_status` | `assigned_approver_user_id, status` | Approver's pending request queue          |
| `idx_approvalrequest_entity`          | `entity_type, entity_id`            | Approval requests for a specific document |

---

## Currency and Pricing Notes

- All monetary fields use `NUMERIC(18,4)` — 14 integer digits and 4 decimal places — to accommodate
  large procurement amounts with sufficient precision.
- The default currency across the platform is `AUD`. Each document stores its own `currency` field
  (ISO 4217 code) to support per-document currency selection.
- There is no real-time exchange rate conversion; currency selection is informational.
- All price calculations (totals, discounts) are performed at the application layer; the stored
  `total_price` fields are denormalised for query performance.

## Immutability and Soft-Delete Policy

- **AuditLog**: Strictly append-only. The database role used by the application must be denied
  UPDATE and DELETE on this table.
- **Deleted records**: No entity is physically deleted. Documents are archived or cancelled via
  status transitions. Users are deactivated. Materials are archived. This ensures all historical
  references remain intact.

## Indexing Strategy Summary

- **Compound status indexes** are the primary query pattern: most dashboard list views filter by
  `(company_id | project_id, status)` and sort by a timestamp or date column.
- **Polymorphic entity references** (AuditLog, Notification, Message) use a
  `(entity_type, entity_id)` compound index to efficiently retrieve history or messages for any
  document type.
- **Token indexes** (invitation tokens, password reset tokens, QR code tokens) use unique B-tree
  indexes since they are exact-match lookups.
- **Timestamp DESC indexes** are used for feed-style views (audit history, notification inbox).
- Full-text search on `materials.name` should be implemented using the database's native full-text
  search capability (e.g. a `tsvector` column and GIN index in PostgreSQL) to support real-time
  catalogue search suggestions.

---

## New Entities (Backlog Alignment 2026-03-10)

_Added to align with the full product backlog (Epics 3–6). These entities are not yet in the Prisma
schema and require new migrations._

---

### 34. VendorTag

**Description**: A custom tag created by a contractor company to organise and filter vendors. Tags
have a name and a colour. Tags are company-scoped (visible only within the contractor company).

| Field        | Type         | Constraints             | Notes                          |
| ------------ | ------------ | ----------------------- | ------------------------------ |
| `id`         | UUID         | Primary Key             |                                |
| `company_id` | UUID         | FK → Company, required  | The contractor company         |
| `name`       | VARCHAR(100) | Required                | Tag display name               |
| `colour`     | VARCHAR(7)   | Required                | Hex colour code (e.g. #FF5733) |
| `created_at` | TIMESTAMP    | Required, default now() |                                |

#### Relationships

- Belongs to one **Company** (contractor)
- Assigned to many **Companies** (vendors) via **VendorTagAssignment**

---

### 35. VendorTagAssignment

**Description**: Join table linking vendor tags to vendor companies.

| Field         | Type      | Constraints             | Notes |
| ------------- | --------- | ----------------------- | ----- |
| `id`          | UUID      | Primary Key             |       |
| `tag_id`      | UUID      | FK → VendorTag          |       |
| `vendor_id`   | UUID      | FK → Company (vendor)   |       |
| `assigned_at` | TIMESTAMP | Required, default now() |       |

#### Unique Constraint: `(tag_id, vendor_id)`

---

### 36. WarehouseLocation

**Description**: A vendor's warehouse location where materials are stored and shipped from.

| Field        | Type         | Constraints             | Notes               |
| ------------ | ------------ | ----------------------- | ------------------- |
| `id`         | UUID         | Primary Key             |                     |
| `company_id` | UUID         | FK → Company (vendor)   | The vendor company  |
| `city`       | VARCHAR(255) | Required                |                     |
| `postcode`   | VARCHAR(20)  | Required                |                     |
| `address`    | TEXT         | Required                | Full street address |
| `label`      | VARCHAR(255) | Optional                | Friendly name       |
| `created_at` | TIMESTAMP    | Required, default now() |                     |

---

### 37. MaterialRequest

**Description**: A request from a field worker or office user for project materials. May include
free-form items (not yet matched to the material catalogue) alongside catalogue items. Supports
offline creation and automatic routing to bulk drawdown or warehouse release when applicable.

| Field               | Type      | Constraints                | Notes                                              |
| ------------------- | --------- | -------------------------- | -------------------------------------------------- |
| `id`                | UUID      | Primary Key                |                                                    |
| `project_id`        | UUID      | FK → Project, required     |                                                    |
| `company_id`        | UUID      | FK → Company, required     |                                                    |
| `status`            | ENUM      | Required, default `Draft`  | Draft, Submitted, InProgress, Fulfilled, Cancelled |
| `priority`          | ENUM      | Required, default `Normal` | Normal, High, Urgent                               |
| `need_by_date`      | DATE      | Optional                   |                                                    |
| `delivery_location` | TEXT      | Optional                   |                                                    |
| `message`           | TEXT      | Optional                   |                                                    |
| `requested_by_id`   | UUID      | FK → User, required        |                                                    |
| `created_at`        | TIMESTAMP | Required, default now()    |                                                    |
| `updated_at`        | TIMESTAMP | Required, auto-updated     |                                                    |

#### Relationships

- Belongs to one **Project**
- Has many **MaterialRequestLineItem**
- Requested by one **User**
- May have attached **Files**

---

### 38. MaterialRequestLineItem

**Description**: A line item in a material request. May reference a catalogue material or be
free-form text.

| Field            | Type        | Constraints             | Notes                         |
| ---------------- | ----------- | ----------------------- | ----------------------------- |
| `id`             | UUID        | Primary Key             |                               |
| `request_id`     | UUID        | FK → MaterialRequest    |                               |
| `material_id`    | UUID        | FK → Material, optional | Null for free-form items      |
| `free_form_name` | TEXT        | Optional                | Used when material_id is null |
| `quantity`       | INT         | Required, > 0           |                               |
| `unit`           | VARCHAR(50) | Required                |                               |
| `notes`          | TEXT        | Optional                |                               |

---

### 39. WarehouseReleaseRequest

**Description**: A request to release materials from a warehouse for a specific project location.
Created by PO, CA, or Foreman. Must be accepted by a Warehouse Officer before materials are reserved
and shipped.

| Field                  | Type      | Constraints                    | Notes                                                                                  |
| ---------------------- | --------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| `id`                   | UUID      | Primary Key                    |                                                                                        |
| `project_id`           | UUID      | FK → Project, required         |                                                                                        |
| `company_id`           | UUID      | FK → Company, required         |                                                                                        |
| `source_warehouse_id`  | UUID      | FK → ProjectLocation, required | The warehouse to release from                                                          |
| `delivery_location`    | TEXT      | Required                       | Destination site/warehouse                                                             |
| `status`               | ENUM      | Required, default `Draft`      | Draft, Submitted, Approved, PartiallyApproved, Declined, Shipped, Completed, Cancelled |
| `priority`             | ENUM      | Required, default `Normal`     | Normal, High, Urgent                                                                   |
| `need_by_date`         | DATE      | Optional                       |                                                                                        |
| `planned_release_date` | DATE      | Optional                       | Set by Warehouse Officer on acceptance                                                 |
| `requested_by_id`      | UUID      | FK → User, required            |                                                                                        |
| `created_at`           | TIMESTAMP | Required, default now()        |                                                                                        |
| `updated_at`           | TIMESTAMP | Required, auto-updated         |                                                                                        |

#### Relationships

- Belongs to one **Project**
- Has many **WarehouseReleaseLineItem**
- Has many **WarehouseReleaseChangeRequest**
- Linked to **MaterialTransfer** (after shipment)

---

### 40. WarehouseReleaseLineItem

| Field                 | Type        | Constraints                  | Notes                    |
| --------------------- | ----------- | ---------------------------- | ------------------------ |
| `id`                  | UUID        | Primary Key                  |                          |
| `release_id`          | UUID        | FK → WarehouseReleaseRequest |                          |
| `material_id`         | UUID        | FK → Material, required      |                          |
| `requested_qty`       | INT         | Required, > 0                |                          |
| `approved_qty`        | INT         | Optional                     | Set by Warehouse Officer |
| `unit`                | VARCHAR(50) | Required                     |                          |
| `availability_status` | ENUM        | Optional                     | Sufficient, Insufficient |
| `notes`               | TEXT        | Optional                     |                          |

---

### 41. WarehouseReleaseChangeRequest

| Field             | Type      | Constraints                  | Notes                                          |
| ----------------- | --------- | ---------------------------- | ---------------------------------------------- |
| `id`              | UUID      | Primary Key                  |                                                |
| `release_id`      | UUID      | FK → WarehouseReleaseRequest |                                                |
| `status`          | ENUM      | Required, default `Pending`  | Pending, Approved, PartiallyApproved, Rejected |
| `requested_by_id` | UUID      | FK → User                    |                                                |
| `reviewed_by_id`  | UUID      | FK → User, optional          |                                                |
| `reason`          | TEXT      | Optional                     | Rejection reason                               |
| `changes`         | JSON      | Required                     | Before/after field values                      |
| `created_at`      | TIMESTAMP | Required, default now()      |                                                |

---

### 42. DeliveryReportPhoto

**Description**: Photos attached to delivery report line items as evidence (mandatory for damaged
items).

| Field                     | Type      | Constraints                 | Notes |
| ------------------------- | --------- | --------------------------- | ----- |
| `id`                      | UUID      | Primary Key                 |       |
| `delivery_report_line_id` | UUID      | FK → DeliveryReportLineItem |       |
| `file_id`                 | UUID      | FK → File                   |       |
| `created_at`              | TIMESTAMP | Required, default now()     |       |

---

### 43. Note

**Description**: Personal in-app notepad entries for field workers. Notes are private (visible only
to the creator), support offline creation, and can be converted to material requests.

| Field        | Type         | Constraints                | Notes                          |
| ------------ | ------------ | -------------------------- | ------------------------------ |
| `id`         | UUID         | Primary Key                |                                |
| `user_id`    | UUID         | FK → User, required        | The note creator               |
| `title`      | VARCHAR(255) | Required                   |                                |
| `content`    | TEXT         | Optional                   | Supports basic text formatting |
| `status`     | ENUM         | Required, default `Active` | Active, Archived               |
| `created_at` | TIMESTAMP    | Required, default now()    |                                |
| `updated_at` | TIMESTAMP    | Required, auto-updated     |                                |

---

### 44. MaterialTransfer

**Description**: Records the internal transfer of materials between a source warehouse and a
destination location (project site or another warehouse), triggered by a shipped warehouse release.

| Field                     | Type      | Constraints                  | Notes                        |
| ------------------------- | --------- | ---------------------------- | ---------------------------- |
| `id`                      | UUID      | Primary Key                  |                              |
| `release_request_id`      | UUID      | FK → WarehouseReleaseRequest |                              |
| `source_location_id`      | UUID      | FK → ProjectLocation         | Source warehouse             |
| `destination_location_id` | UUID      | FK → ProjectLocation         | Destination                  |
| `status`                  | ENUM      | Required, default `Pending`  | Pending, Confirmed, Disputed |
| `confirmed_by_id`         | UUID      | FK → User, optional          |                              |
| `confirmed_at`            | TIMESTAMP | Optional                     |                              |
| `created_at`              | TIMESTAMP | Required, default now()      |                              |

---

### 45. InventoryEntry

**Description**: Tracks current stock levels for materials at a specific location (warehouse or
project site). Updated automatically from deliveries, releases, and transfers.

| Field             | Type      | Constraints                    | Notes                                 |
| ----------------- | --------- | ------------------------------ | ------------------------------------- |
| `id`              | UUID      | Primary Key                    |                                       |
| `location_id`     | UUID      | FK → ProjectLocation, required | Warehouse or project site             |
| `material_id`     | UUID      | FK → Material, required        |                                       |
| `quantity`        | INT       | Required, >= 0                 | Current available stock               |
| `reserved_qty`    | INT       | Required, default 0            | Reserved by accepted release requests |
| `last_updated_at` | TIMESTAMP | Required, auto-updated         |                                       |

#### Unique Constraint: `(location_id, material_id)`

---

### 46. VendorRating

**Description**: Auto-calculated vendor performance rating scoped to a contractor company. Computed
from historical data: delivery on-time rate, average delivery time, RFQ response time, and price
level relative to other vendors.

| Field                   | Type         | Constraints               | Notes                            |
| ----------------------- | ------------ | ------------------------- | -------------------------------- |
| `id`                    | UUID         | Primary Key               |                                  |
| `vendor_id`             | UUID         | FK → Company (vendor)     |                                  |
| `contractor_id`         | UUID         | FK → Company (contractor) |                                  |
| `delivery_reliability`  | DECIMAL(5,2) | Optional                  | % of on-time deliveries          |
| `avg_delivery_days`     | DECIMAL(7,2) | Optional                  | Average days from PO to delivery |
| `rfq_response_time_hrs` | DECIMAL(7,2) | Optional                  | Average hours to respond to RFQ  |
| `price_level`           | ENUM         | Optional                  | Lower, Average, Higher           |
| `data_points`           | INT          | Required, default 0       | Number of transactions in rating |
| `last_calculated_at`    | TIMESTAMP    | Required                  |                                  |

#### Unique Constraint: `(vendor_id, contractor_id)`

---

### 47. MaterialComponent

**Description**: Defines the composition of an aggregated product. Links a parent material (type
Aggregated) to its component materials with quantities.

| Field                   | Type | Constraints   | Notes                    |
| ----------------------- | ---- | ------------- | ------------------------ |
| `id`                    | UUID | Primary Key   |                          |
| `parent_material_id`    | UUID | FK → Material | The aggregated product   |
| `component_material_id` | UUID | FK → Material | A component material     |
| `quantity`              | INT  | Required, > 0 | Quantity per parent unit |

#### Unique Constraint: `(parent_material_id, component_material_id)`

---

### 48. MaterialPriceHistory

**Description**: Historical price data for materials, auto-populated from vendor quote responses.
Used to calculate min/max/avg/last price shown in the material catalogue.

| Field                | Type          | Constraints             | Notes                 |
| -------------------- | ------------- | ----------------------- | --------------------- |
| `id`                 | UUID          | Primary Key             |                       |
| `material_id`        | UUID          | FK → Material, required |                       |
| `quote_line_item_id` | UUID          | FK → QuoteLineItem      | Source quote          |
| `vendor_id`          | UUID          | FK → Company (vendor)   |                       |
| `unit_price`         | DECIMAL(18,4) | Required                |                       |
| `quoted_at`          | TIMESTAMP     | Required                | Quote submission date |

---

### 49. MaterialList

**Description**: User-created lists for organising favourite/commonly used materials. Lists are
company-scoped (visible to all users within the company).

| Field        | Type         | Constraints             | Notes   |
| ------------ | ------------ | ----------------------- | ------- |
| `id`         | UUID         | Primary Key             |         |
| `user_id`    | UUID         | FK → User, required     | Creator |
| `company_id` | UUID         | FK → Company, required  |         |
| `name`       | VARCHAR(255) | Required                |         |
| `created_at` | TIMESTAMP    | Required, default now() |         |

---

### 50. MaterialListItem

| Field         | Type | Constraints       | Notes |
| ------------- | ---- | ----------------- | ----- |
| `id`          | UUID | Primary Key       |       |
| `list_id`     | UUID | FK → MaterialList |       |
| `material_id` | UUID | FK → Material     |       |

#### Unique Constraint: `(list_id, material_id)`

---

### 51. MaterialFavourite

**Description**: A user's favourited material. Favourites are company-scoped.

| Field         | Type | Constraints   | Notes |
| ------------- | ---- | ------------- | ----- |
| `id`          | UUID | Primary Key   |       |
| `user_id`     | UUID | FK → User     |       |
| `material_id` | UUID | FK → Material |       |

#### Unique Constraint: `(user_id, material_id)`
