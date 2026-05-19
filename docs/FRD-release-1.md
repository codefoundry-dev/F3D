# Role-Based Access Management

**User roles:**

1. Super admin (platform-level admin access)
2. Company Admin (company type: contractor)
3. Procurement Officer (company type: contractor)
4. FInancial Officer (company type: contractor)
5. Vendor (company type: Vendor)

# **Epic 1: User management**

**Scope**

| User story | Name                                                                                                       | Role                 |
| :--------- | :--------------------------------------------------------------------------------------------------------- | :------------------- |
| 1.01       | [New user registration](#user-story-1.01)                                                                  | Super Admin          |
| 1.02       | [User account activation](#user-story-1.02-–-user-account-activation)                                      | All users            |
| 1.03       | [User login](#user-story-1.03-–-user-login)                                                                | All users            |
| 1.04       | [Password reset](#user-story-1.04-–-password-reset)                                                        | All users            |
| 1.05       | [RBA management](#user-story-1.05-–-rba-management)                                                        | Super Admin          |
| 1.07       | [Add users to contractor](#user-story-107--add-users-to-contractor)                                        | Company Admin        |
| 1.08       | [Manage users within a company](#user-story-108--manage-users-within-a-company)                            | Company Admin        |
| 1.09       | [Contractor profile management](#user-story-109--contractor-profile-management)                            | Company Admin        |
| 1.10       | [Manage user profile](#user-story-110--manage-user-profile)                                                | All contractor users |
| 1.06       | [Approval scenarios configuration (**OPT**)](#user-story-1.06---approval-scenarios-configuration-optional) | Company admin        |

### **User Story 1.01** {#user-story-1.01}

_As a Super Admin_  
_I want to create new users and assign them access roles,_  
_so that they can join the platform via a secure invitation link._

**Acceptance criteria:**

1. Admin can create a new user and must assign the user to a company by either:
   1. selecting an existing company, or
   2. creating a new company within the same flow.
2. At the first step of user creation, the admin must choose the company type for the user:
   1. Contractor
   2. Vendor
3. For any new user creation, the following fields are mandatory:
   1. Company name (select existing or create new)
   2. Representative name
   3. Representative email
   4. Position
4. If Contractor company type is selected:
   1. Only contractor companies are available for selection from the list.
   2. Only contractor-related access roles are available in a drop-down.
5. If Vendor company type is selected:
   1. Only vendor companies are available for selection from the list.
   2. Only the vendor access role is available (single by default).

5.1. When displaying the list of companies (contractor or vendor), company names are shown in
alphabetical order.  
5.2. The admin can quickly navigate the company list by selecting the first letter of the company
name.

6. Admin must assign exactly one predefined access role per user.
7. If the admin chooses to create a new company during user creation, the company is created of the
   same type selected in step 2 (Contractor or Vendor), within the same flow and cannot exist
   without the user being created.

7.1. For a new Contractor company the first user access role by default is the Company Admin.  
7.2. For a new Vendor company, additional mandatory fields are required:

- Company email
- Specialisation (multi-select from predefined list):

  7.3. For a new Vendor company:

- Admin must assign the vendor to at least one contractor company.
- Once created, the vendor appears in the selected contractor company’s vendor list.
- Admin can assign the vendor to all contractor companies or select specific ones.

8. Upon creation, the invitation link is sent to the user’s email address (or to all of them) and
   the user is stored with the status "Invited".

8.1. The user is notified that the invitation has been sent successfully.

9. User admin must be able to track the statuses of the users (e.g. Invited, Active).

9.1 Once user activates their account, the user status changes to "Active"

10. User admin must be able to cancel or resend the invitation.
11. If the user’s email already exists in the system, an error message is displayed to prevent
    duplicate user creation.
12. The invitation link is valid for 30 days

**Functional requirements:**

1. List of vendor categories:

[https://docs.google.com/document/d/1Lf8N243xjLqRvlY8paomnPUXVp8pKCgwXqBkI5dCEis/edit?tab=t.0](https://docs.google.com/document/d/1Lf8N243xjLqRvlY8paomnPUXVp8pKCgwXqBkI5dCEis/edit?tab=t.0)

### **User Story 1.02 – User account activation** {#user-story-1.02-–-user-account-activation}

As a **Company Admin, Warehouse Officer, Foreman, Vendor, Finance Officer, and Procurement
Officer**  
_I want to join the platform by following the invitation link and setting my password,_  
_so that I can activate my account_

**Acceptance criteria:**

1. A user can access the account activation page by clicking the invitation link received by email.
2. To activate the account, the user must create a secure password.
3. After successful password creation, the user account status changes from “Invited” to “Active”.
4. Once the account is activated, the invitation link expires.
5. If the user clicks the expired invitation link, the user is informed and instructed to request a
   new one.
6. Passwords must be at least 8 characters long and include a mix of uppercase, lowercase, numbers,
   and symbols

## **User Story 1.03 – User login** {#user-story-1.03-–-user-login}

As a **Platform User**  
_I want to log in to my account,_  
_so that I can access the platform._

**Acceptance criteria:**

1. Users log in using their email address and password.
2. **Only users with an “Active” account status can log in to the platform**.
3. After entering valid login credentials, the user must confirm the login using a one-time OTP code
   sent to their email address.
4. If the OTP code is entered correctly, the user is logged.
5. If an incorrect password or OTP code is entered, an error message is displayed indicating that
   the login attempt was unsuccessful.
6. **If a user attempts to log in without activating their account, an error message informs them
   that account activation is required.**

## **User Story 1.04 – Password reset** {#user-story-1.04-–-password-reset}

**As a Platform User**  
_I want to reset my password securely,_  
_so that I can regain access to my account._

**Acceptance criteria:**

1. A user can request a password reset
2. A password reset link is sent to the user’s email address.
3. **The password reset link is valid for 15 minutes**
4. The new password must meet the requirements US1.2/AC:6
5. If the password reset link has expired or is invalid, the user is informed and prompted to
   request a new reset link.
6. Upon success, the password is stored, and the user can log in using the new password.

## **User Story 1.05 – RBA management** {#user-story-1.05-–-rba-management}

As a **Super Admin**  
_I want to manage platform users,_  
_so that I can control access to the platform._

**Acceptance criteria:**

1. Super admin can view all the platform users and their status in a structured table view.
2. The Super Admin can search users by name, email, or company, and can sort and filter the list by
   company, role, status, and creation date.
3. Super Admin can edit user or company details, change a user’s access role.
4. Super Admin can deactivate and reactivate a user or all company users; deactivated users cannot
   log in to the platform until reactivated. The email notification is sent to the users.
5. Super Admin can initiate a password reset for a user, triggering a US1.04.
6. All actions are logged and visible as a history of activities (edits) for each user.

## **User Story 1.07 – Add users to contractor**

As a **Company Admin**  
_I want to invite new users to my company,_  
_so that they can access the platform with the correct roles and permissions._

**Acceptance criteria:**

1. The Company Admin can create a new user and invite them to join their own company only.
2. When company admin creates a new user for their company, system must assign the user to the
   Admin’s company automatically; selecting or creating other companies is not allowed.
3. The Company Admin must choose one predefined access role that is valid for the contractor
4. The company admin can create another user with the company admin access role.
5. Mandatory fields for creating a new user are:
   1. user name,
   2. user email address,
   3. user position,
   4. access role.
6. Upon user creation, an invitation link is sent to the provided email address and the user is
   created with the status “Invited”.
7. The invitation link is valid for 30 days.
8. If the email address already exists within the same company, the system displays an error and
   prevents duplicate user creation.1
9. The user is notified that the invitation has been sent successfully.
10. Once user activates their account, the user status changes to "Active"

## **User Story 1.08 – Manage users within a company**

As a **Company Admin**  
_I want to manage company users,_  
_so that I can control access to the company profile and workflows._

**Acceptance criteria:**

1. Company Admin can view a list of all users within their company, including each user’s name,
   access role, and current status (Invited, Active, Deactivated).
2. Company Admin can edit user details, including name, position, and access role for all users
   within a company, including other users with the company admin access role.
3. When changing a user’s access role, only roles that are valid for the contractor company type can
   be selected.
4. System prevents the Company Admin from deactivating or downgrading their own access if they are
   the only active Company Admin in the company.
5. The Company Admin can deactivate a user within a company, including other users with the company
   admin access role.
6. Deactivated users cannot log in to the platform or perform any actions.
7. The Company Admin can reactivate a previously deactivated user.
8. When a user is deactivated or reactivated, the user receives an email notification.
9. Company Admin can initiate a password reset for a user, triggering the standard password reset
   flow (User Story 1.04).
10. For users with the status Invited, Company Admin can resend or cancel their invitation.

## **User Story 1.09 – Contractor profile management**

As a **Company Admin**  
_I want to add and edit my company profile information,_  
_so that my data is up to date and can be used in workflows_

**Acceptance criteria:**

1. Company Admin can view and edit company profile data.
2. Company profile includes:
   1. company logo
   2. legal information: legal name, trade name, ABN, tax code, legal address **(mandatory)**
   3. contact email and phone number
   4. website (optional but common)
   5. Compliance documents (licenses, certifications)
3. Mandatory fields must be completed before saving.
4. Changes are saved immediately and apply to all workflows.

**Data validation rules:**

1. **ABN** format:  
   `XX XXX XXX XXX` (11 digits)
2. **Tax code** format: `XXX XXX XXX` (9 digits)

## **User Story 1.10 – Manage user profile** {#user-story-110--manage-user-profile}

\*As a **Contractor User (Company Admin, Procurement Officer, Financial Officer)\*** _I want to view
and edit my own profile information,_ _so that my personal data is accurate and up to date._

**Acceptance criteria:**

_Not yet detailed in the source FRD. Listed in Epic 1 scope table — requires acceptance criteria
from the product owner._

## **User story 1.06 \- Approval scenarios configuration OPTIONAL** {#user-story-1.06---approval-scenarios-configuration-optional}

\*As a **Company Admin\***  
_I want to manage user access and configure approval workflows within my company,_  
*so that platform workfl*ows match my company’s business rules and approval policies.

**Acceptance criteria:**

**A. Approval Workflow Configuration**

1. The Admin can configure which actions require approval
2. The system provides a predefined list of all supported approval scenarios

see list:
[https://docs.google.com/document/d/1lNr-jG_HbxluJtiiXaZc6KOeq8TpkzW8H6xumH85YJU/edit?usp=sharing](https://docs.google.com/document/d/1lNr-jG_HbxluJtiiXaZc6KOeq8TpkzW8H6xumH85YJU/edit?usp=sharing)

3. By default, all approval scenarios are disabled.
4. To configure an approval scenario, the Admin must:
   1. activate the scenario,
   2. define the triggering condition
   3. assign one or more approvers by selecting existing company users,
   4. save the configuration.
5. Each approval scenario must have at least one assigned approver. By default, the assigned
   approval is company admin.
6. The system clearly indicates to end users when an action requires approval and displays the
   assigned approver user name.
7. If an assigned approver becomes inactive or is removed, the system automatically assigns the
   Company Admin as the fallback approver and indicates this change.

**B. Role-Based Action Restrictions (RBAC Overrides)**  
1\. The Admin can allow or restrict specific actions within each predefined user role.  
2\. For each role, the system displays a list of configurable actions that can be allowed or
restricted.  
3\. By default, all configurable actions are allowed for all roles.  
4\. When an action is restricted or allowed, the change applies to all users assigned to that
role.  
5\. The Admin must explicitly mark each configurable action as either Allowed or Restricted.  
**C. Project Access Management**  
1\. The Admin can assign users to specific projects or remove users from projects by selecting a
project and adding or removing users for the selected project.  
2\. Users can access only the projects to which they are assigned.

**Changes to approval workflows, role-based restrictions, and project assignments take effect
immediately for all new actions on the platform.**

**If 1.06 is implemented, user story 5.10 is mandatory:**  
**Approval scenarios**

_As a Company Admin, Procurement Officer, Finance Officer (assigned approval person),_  
_I want to see incoming approval requests and approve or reject them,_  
_so that workflows can move forward without delays._

**Acceptance criteria:**

1. Only users assigned as approvers by company configuration can approve or reject requests.
   1. user can view a list of all pending approval requests assigned to them
   2. user can view a list of all closed (rejected and approved) approval request, approved by him.
   3. approval request must indicate the related document type, project, participants, amount, and
      current status.
2. The user can open an approval request and review all document details.
3. The user can approve, reject or request changes to the request and optionally add a comment.
4. When selecting “Request changes”, the user must provide a comment explaining what needs to be
   changed.
5. The document owner can edit the document
6. The approval request is reopened after resubmission
7. Approval status is updated immediately and cannot be changed.
8. The system records the approver’s name, decision, and timestamp.
9. Relevant users are notified when a request is approved or rejected.

# **Epic 2: Dashboard**

**Scope**

| User story | Name                                                                                                                    | Role                                                                   |
| :--------- | :---------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| 2.06       | [RFQ dashboard](#user-story-2.06-–-rfq-dashboard)                                                                       | Procurement Officer Company Admin Vendor                               |
| 2.07       | [PO Dashboard](#user-story-2.07-–-po-dashboard)                                                                         | Procurement Officer Company Admin Vendor                               |
| 2.11       | [Bulk order view](#user-story-2.11-–-bulk-order-view)                                                                   | Procurement Officer Company Admin Vendor                               |
| 8.07       | [Manage invoice states](#user-story-8.07-–-manage-invoice-states)                                                       | Procurement Officer Financial Officer Company Admin                    |
| X          | [Unified & Simplified user dashboard with quick actions](<#user-story-x-(not-a-part-of-the-general-scope)---main-page>) | Procurement Officer Company Admin Vendor Financial Officer Super Admin |

## **User Story 2.06 – RFQ dashboard** {#user-story-2.06-–-rfq-dashboard}

\*As a **Procurement Officer, Company Admin, Vendor\***  
_I want to view all RFQs related to my projects in a structured table view,_  
_so that I can efficiently manage RFQ document flows_

**Acceptance criteria:**

10. User can view a structured table listing all RFQs for projects they have access to.
11. Each RFQ row displays the following core attributes:
    1. RFQ ID
    2. Project name
    3. Project ID (not visible for vendor)
    4. Delivery location(s)
    5. RFQ status
    6. RFQ response deadline
    7. Number of line items
    8. Total requested quantity
    9. Number of invited vendors (not visible for vendor)
    10. Number of received quotes (not visible for vendor)
    11. **Number of declined line items (not visible for vendor)**
    12. **Number of approved line items (not visible for vendor)**
    13. Approved vendors / **Vendor with approved line items** (not visible for vendor)
    14. Average quoted cost (not visible for vendor)
    15. Created date
    16. Created by (not visible for vendor)
    17. Last modified by (not visible for vendor)
    18. Message indicator
    19. _Approval status (not visible for vendor)_
    20. _Approved by (user) (not visible for vendor) → optional, depends on
        [User story 1.06](#user-story-1.06---approval-scenarios-configuration-optional) Approval
        scenarios_
12. The table supports:
    1. Sorting by any column
    2. Filtering
    3. Grouping by project or status (when vendor: grouping by status only)
    4. Configurable visible columns (show/hide)
    5. Display 50 / 100 items per page.
13. Default state of the table:
    1. Sorted by RFQ response deadline (ascending) (most urgent RFQs at the top)
    2. Pagination: 25 RFQs per page
14. Filtering must be available by:
    1. Project
    2. RFQ status
    3. Delivery location
    4. Created by (not visible for vendor)
    5. Created date (date range)
    6. Response deadline (date range)
    7. Number of approved quotes (not visible for vendor)
    8. Approved vendors (not visible for vendor)
    9. when vendor: by Contractor
15. The system provides quick filter presets, including:
    1. My RFQs (created by the user, when vendor: FQ responded by a user.)
    2. Open RFQs (Status "Open")
    3. RFQs awaiting responses (number of approved quotes is 0; when vendor: not responded)
    4. RFQs with no quotes (Number of received quotes is 0\) (not visible for vendor)
    5. Awarded RFQs (status approved; when vendor: approved for a vendor)
    6. Closed RFQs (status closed)
16. The user can save custom table views, including selected columns, sorting, and filters, and set
    a default view.
17. The user can open an RFQ details page by selecting an RFQ from the list.
18. RFQ details page displays all information entered during RFQ creation, including
    1. all vendor quote responses linked to the RFQ. (not visible for vendor)
    2. one or more purchase orders or bulk orders created from this RFQ
19. The user can open individual quote details or access the quote comparison view. (not visible for
    vendor)
20. User can open a related document.
21. User can export single RFQ document in PDF.
22. User can export the full table view list to CSV or Excel.
23. Exported data reflects the currently applied filters, sorting, and visible columns.

**Functional requirements:**

1. RFQ data fields template:

[https://docs.google.com/document/d/11w3tVTmQx5n9WOYBaZimutP5delHg0F_Sjlb2yB_uzY/edit?usp=sharing](https://docs.google.com/document/d/11w3tVTmQx5n9WOYBaZimutP5delHg0F_Sjlb2yB_uzY/edit?usp=sharing)

## **User Story 2.07 – PO dashboard** {#user-story-2.07-–-po-dashboard}

\*As a **Procurement Officer, Company Admin, Vendor\***  
_I want to view all POs related to my projects in a structured table view,_  
_so that I can efficiently track commitments and obligations._

**Acceptance criteria:**

24. User can view a structured table listing all purchase orders for projects they have access to.
25. Each PO row displays the following core attributes:
    1. PO number
    2. Project name
    3. Project ID
    4. Vendor name (when vendor: contractor name)
    5. PO status
    6. Active Revision (yes/no)
    7. PO type (Standard, Bulk, Hold-for-release)
    8. Delivery location
    9. Payment terms
    10. Pick up (yes/no)
    11. Total amount
    12. Linked RFQ average price (when vendor: not visible)
    13. Expected ("Need by") delivery date
    14. Is a Hold for release
    15. Is a Bulk order
    16. Earliest delivery date
    17. Planned delivery date
    18. Number of line items
    19. Line items delivered
    20. Total quantity
    21. Quantity delivered
    22. Created date
    23. Created by (when vendor: not visible)
    24. Last modified by (when vendor: not visible)
    25. Last updated (date)
    26. Aging (days since last update or since issue)
    27. _Approval status (not visible for vendor)_
    28. _Approved by (when vendor: not visible) → optional, depends on
        [User story 1.06](#user-story-1.06---approval-scenarios-configuration-optional) Approval
        scenarios_
    29. Attachments indicator
    30. Message indicator
26. User can:
    1.  Sort the list by any column.
    2.  Filter by PO status, PO type, vendor, project, delivery date, amount.
    3.  Search by PO number, project name, vendor name.
27. The table supports configurable columns:
    1.  User can hide/show columns.
    2.  User can reorder columns.
    3.  User can change column widths.
28. The table supports saving custom views:
    1.  The user can save custom table views, including selected columns, filters, and sorting.
    2.  The user can update or delete saved views.
29. User can open any PO row to view PO details.
30. PO details view includes:
    1.  PO header information (project, status, vendor, etc.).
    2.  PO material list with quantities and any notes.
    3.  PO attachments (if any).
    4.  A list of related documents such as:
        1. RFQ(s) used for PO creation;
        2. invoices.
31. From the PO details view user can open related documents used for PO creation such as:
    1.  approved RFQ quotes;
    2.  bulk orders.
    3.  Invoices.
32. From the PO details view, user can navigate to any related document.
33. User can export single document in PDF.

**Functional requirements:**

1. PO data fields template

[https://docs.google.com/document/d/1SAqAVoj3jGW9g4qCx-mq-xp6vqBu2HmaSNC0cdsxjT0/edit?usp=sharing](https://docs.google.com/document/d/1SAqAVoj3jGW9g4qCx-mq-xp6vqBu2HmaSNC0cdsxjT0/edit?usp=sharing)

## **User Story 2.11 – Bulk order view** {#user-story-2.11-–-bulk-order-view}

\*As a **Company Admin , Procurement Officer, Vendor\***  
_I want to view active bulk orders and their details,_  
_so that I can get information and quickly create drawdown orders when needed._

**Acceptance criteria:**

1. user can view a list of active bulk orders.
2. Each bulk order entry displays:
   1. Bulk order ID
   2. Associated project
   3. Material name
   4. Total quantity ordered
   5. Remaining quantity
   6. Price
3. User can open a bulk order to view detailed information.
4. User can track consumption of materials from the bulk order.

## **User Story 8.07 – Manage invoice states** {#user-story-8.07-–-manage-invoice-states}

\*As a **Procurement Officer, Finance Officer, Company Admin\***  
_I want to view and manage the list of invoices,_  
_so that I can understand their current status and take action when needed._

**Acceptance criteria:**

1. User can view the invoice list of all invoices the user has access to.
2. Each invoice entry displays the following information:
   1. invoice number
   2. vendor name
   3. related project
   4. related PO
   5. invoice amount
   6. due date
   7. current status
3. The user can:
   1. Sort the list by any column,
   2. Filter by status, vendor, project, due date, amount,
   3. Search by invoice number or vendor name.
4. The user can open any invoice from the list to view details and take action.
5. The list supports bulk actions, such as approving or exporting invoices.
6. User can download the list in Excel or CSV.

## **User Story X (not a part of the general scope) \- Main page** {#user-story-x-(not-a-part-of-the-general-scope)---main-page}

\*As a **Platform User\***  
_I want to see a role-appropriate main page after logging into the platform,_  
_so that I can immediately understand what requires my attention and quickly perform my daily tasks_

**Acceptance criteria:**

1. Upon login, the system displays a main dashboard page based on the user’s role
2. Procurement Officers and Company Admins can see
   1. Quick actions:

- Create RFQ with source suggestions
- Create PO with source suggestions
- Upload invoice **(visible for Financial officer)**
- Submit delivery report (Optional)  
  2. A list of incoming RFQ quotes  
  3. A list of invoices without approval **(visible for Financial officer)**  
  4. A list of recently created documents (PO, RFQ)

3. Vendor main page includes:
   1. RFQs waiting for quote
   2. Active POs
   3. Submitted invoices with their current statuses
4. The Super Admin can see
   1. Recent platform-level changes
   2. Platform state indicators
   3. Administrative shortcuts

# **Epic 3 Vendor & Supplier Management**

Scope

| User Story | Name                                                                                            | Role                                       |
| :--------- | :---------------------------------------------------------------------------------------------- | :----------------------------------------- |
| 3.01       | [Vendor invitation](#user-story-3.01---vendor-invitation)                                       | Company Admin Procurement Officer          |
| 3.03       | [In-app communication](#user-story-3.03-–-in-app-communication)                                 | Procurement Officer, Company Admin, Vendor |
| 3.06       | [RFQ manual response](#user-story-3.06-–-rfq-response)                                          | Vendor                                     |
| 3.07       | [Vendor profile management](#user-story-3.07-–-vendor-profile-management)                       | Procurement Officer, Company Admin, Vendor |
| 3.08       | [PO receiving & reply](#user-story-3.08-–-po-receiving-&-reply)                                 | Vendor                                     |
| 3.10       | [Invite new users to the vendor company](#user-story-3.10-–-invite-new-users-to-vendor-company) | Vendor                                     |
| 5.20       | [Change the bulk order](#user-story-5.20---change-the-bulk-order)                               | Procurement Officer, Company Admin, Vendor |
| 3.12       | [Display a sales rep](#user-story-3.12---display-a-sales-rep)                                   | Procurement Officer, Company Admin,        |

## **User story 3.01 \- Vendor invitation** {#user-story-3.01---vendor-invitation}

\*As a **Company Admin, Procurement Officer\***  
_I want to invite a vendor to join the platform,_  
_so that I can collaborate with my supply partners within the system_

**Acceptance criteria:**

1. User can invite a new vendor to the platform with a "vendor" access role.
2. User must create a vendor company and a user for the vendor company by providing the following
   mandatory information:
   1. company name,
   2. company email,
   3. user name,
   4. user email.
3. When a vendor is invited, an invitation link is sent to the vendor and user's email address
   (both), and the vendor is added to the contractor’s vendor list with the status “Invited.”
4. The user is notified that the vendor invitation has been sent successfully.
5. If the invited vendor already exists on the platform, the vendor is added directly to the
   contractor’s vendor list, and the user is notified.
6. Invited vendors are visible only to the contractor who invited them.
7. Once vendor activates their account, the vendor status in the contractor's vendor list changes to
   **"Active"**

## **User Story 3.03 – In-app communication** {#user-story-3.03-–-in-app-communication}

\*As a **Procurement Officer, Company Admin, Vendor\***  
_I want to communicate with vendors and contractor representatives within the platform,_  
_so that all procurement-related discussions are clear, traceable, and linked to the correct
requests and orders._

**Acceptance criteria:**

1. The platform allows procurement officers, foremen and vendors to exchange messages related to a
   specific RFQ, purchase order, material request and warehouse release request.
2. All messages are timestamped, stored and linked to relevant document.
3. File attachments up to 10 MB are supported in the communication thread.
4. Users are notified when a new message is received.
5. Only authorised participants (the relevant contractor representative and the vendor) can view the
   thread.
6. Message history remains accessible after the RFQ or purchase order is completed in a read-only
   view. The system prevents users from sending new messages after the document has been closed.
7. The user can access a centralized view that lists all message threads across all vendors and
   documents. (optional\*)
8. From the centralized messages view, the user can open any message thread and navigate to the
   related RFQ or purchase order. (optional\*)

## **User Story 3.06 – RFQ response** {#user-story-3.06-–-rfq-response}

_As a Vendor_  
_I want to view pending RFQs and submit response,_  
_so that I can quickly provide offers to contractors._

**Acceptance criteria:**

1. Vendor must be notified by email when a new RFQ is received with an invitation link to reply.
2. The invitation link allows the vendor to reply even if their account wasn't activated.
3. Vendor can open an RFQ and initiate a response from the platform.
4. System auto-populates the response form with RFQ line items and requested quantities and
   requested delivery dates.
   1. Vendor can respond to all RFQ line items or only selected line items.
   2. For non-responded items, the system marks them as "No quote provided".
   3. The vendor can suggest a substitute for a requested item by selecting an alternative from the
      material catalogue.
   4. Vendor can click on any line item and open a material catalogue item details page.
5. Vendor must be able to enter the following information:

**5.1. Bulk-level fields (applied to all line items):**

1. Bulk delivery time (optional, applied to all line items)
2. Bulk availability (optional, applied to all line items)
3. Bulk discount (optional, applied to all line items)
4. Bulk general sales tax (optional, %)
5. Bulk shipment or handling (optional, number)
6. Warehouse location (single select from a dropdown, add a new warehouse)

**5.2. Per line item:**

1. Available quantity for immediate delivery (number more or equal to zero) – mandatory
2. Unit price (number, zero allowed) – mandatory
3. Delivery time (date) – mandatory
4. Discount (% or number; price after discount must be greater than or equal to zero) – optional
5. line-level notes – optional
6. general sales tax (optional, %)
7. tax included (checkbox, optional)

**5.3. Vendor can optionally specify back-order (available later) details per line item, where:**

1. Immediate availability represents the quantity the vendor can deliver within the standard
   delivery time.
2. Back-order availability represents an additional quantity, supplied later and does not reduce or
   replace the immediate availability.
3. For back-ordered quantities, the vendor must specify the expected delivery date

5.4. When bulk values are set and a line item value is also entered, line-level value overrides
bulk.  
5.5. The system calculates the total quote cost and total line cost when the user has entered the
required data.

**6\. Optional fields for response:**

4. validity period of the offer
5. add a message
6. attach file (up to 10 MB, PDF, XLSX, DOCX, JPG, CSV; upload failure shows error message.)

7\. Upon submission, the vendor receives confirmation that the response was sent successfully.

8\. If the submission fails, the system displays a clear error message explaining the reason.

9\. Vendor can edit the RFQ response details at any time until the RFQ is closed. If a change
occurs, the contractor is notified.

## **User Story 3.07 – Vendor profile management** {#user-story-3.07-–-vendor-profile-management}

\*As a **Vendor, Company Admin, Procurement Officer\***  
_I want to manage vendor profile information and representatives,_  
_so that business data is accurate and up to date._

**Acceptance criteria:**

1. Vendor can view and edit their own company profile and representative details.
2. Procurement Officer and Company Admin of a contractor can view vendor profiles that are part of
   their vendor list and edit vendor details.
3. Editable company information includes:
   1. Company name, logo and email.
   2. Legal information: legal name, ABN, tax code, legal address
   3. Warehouse locations (multiple allowed, with city, postcode, and address)
   4. Representatives’ details: name, email, contact number, position, department
   5. Specialisation, selected from a predefined multi-select list
   6. Company contact number and website
4. Mandatory fields, including company email, legal name, ABN, tax code, and legal address must be
   completed before saving changes.
5. Profile updates are saved immediately and applied to all active documents.

## **User Story 3.08 – PO receiving & reply** {#user-story-3.08-–-po-receiving-&-reply}

\*As a **Vendor\***  
_I want to receive and acknowledge purchase orders promptly,_  
_so that I can confirm the deal._

**Acceptance criteria:**

1. Vendor is notified by email when a new purchase order is received with PDF attached.
2. Vendor can view all incoming purchase orders from their account.
3. Vendor can open and download the purchase order document.
4. When a purchase order is opened, its status updates to “Acknowledged” – on a second thought I
   think we should have a manual "order acknowledege".
5. Vendor can approve or decline the purchase order.
6. The vendor can send messages to the contractor related to the purchase order.
7. The vendor can make a change request.
8. Before approving, the user can edit the payment terms and warehouse location.

## **User Story 3.10 – Invite new users to vendor company** {#user-story-3.10-–-invite-new-users-to-vendor-company}

_As a Vendor_  
_I want to add more users to my company,_  
_so that my team can collaborate on RFQs, purchase orders, and deliveries._

**Acceptance criteria:**

1. The vendor can invite new users to their vendor company using invitation flow.
2. When inviting a new user, system must assign the user to vendor's own company with a default
   vendor access role.
3. Mandatory fields for inviting a vendor user include:
   1. representative name
   2. email address
   3. position
4. Upon creation, the invitation link is sent to the user’s email address and the user is stored
   with the status "Invited".
5. Vendor must be able to track the statuses of the users (e.g. Invited, Active, Deactivated).
6. Vendor must be able to cancel or resend the invitation.
7. If the user’s email already exists in the system, an error message is displayed to prevent
   duplicate user creation.
8. The invitation link is valid for 30 days.
9. The vendor is notified that the invitation has been sent successfully.

## **User story 5.20 \- Change the bulk order** {#user-story-5.20---change-the-bulk-order}

_As a Procurement Officer, Company Admin, Vendor_  
_I want to manage bulk agreements,_  
_so that all data reflects my commercial needs._

**Acceptance criteria:**

1. A user can propose changes to an active bulk agreement before it expires.
2. The user can propose changes to the following attributes:
   1. Prices
   2. Expiration date
   3. Line items (add, remove, or adjust quantity or unit of measure)
3. The contractor user can change the project assignment internally without notifying the vendor.
4. When a change is proposed:
   1. change is saved as a pending change request,
   2. other party is notified,
   3. current active version of the bulk agreement remains unchanged.
5. Receiving party can:
   1. Review the proposed changes,
   2. Approve the changes,
   3. Reject the changes and optionally provide a reason.
6. When the proposed changes are approved:
   1. changes are saved as a new version of the bulk agreement,
   2. bulk agreement version is updated,
   3. both parties are notified.
7. When the proposed changes are rejected:
   1. proposed changes are discarded,
   2. current version of the bulk agreement remains active,
   3. both parties are notified.
8. Either party can cancel a bulk agreement at any time.
9. When canceled:
   1. status is set to “Canceled”,
   2. further drawdowns from the agreement are prevented,
   3. both parties are notified.
10. All proposals, approvals, rejections, cancellations, and version changes are recorded in the
    bulk agreement history.

## **User story 3.12 \- Display a sales rep** {#user-story-3.12---display-a-sales-rep}

\*As a **Procurement Officer, Company Admin\***  
_I want to quickly see the sales representatives associated with a vendor from the vendor list,_  
_so that I can understand who I will be communicating with before selecting the vendor_

**Acceptance criteria:**  
1\. When a user views a vendor list, user can optionally view a list of sales representatives for
that vendor  
2\. For each sales representative, the following information is shown:  
\- name,  
\- email address,  
\- phone number (if available),  
\- role or position (if available).  
3\. This functionality is available wherever a vendor list is used, including:  
\- vendor selection during RFQ creation,  
\- vendor selection during PO creation,  
\- any other workflow where vendors are selected from a list.  
4\. Viewing sales representatives does not automatically select or deselect the vendor.

# **Epic 4 \- Material Catalogue**

**Scope**

| User Story | Name                                                                                    | Role                              |
| :--------- | :-------------------------------------------------------------------------------------- | :-------------------------------- |
| 4.01       | [Managing the material catalogue](#user-story-4.01---managing-the-material-catalogue)   | Super Admin                       |
| 4.02       | [Contribute to material catalogue](#user-story-4.02-–-contribute-to-material-catalogue) | Procurement Officer Company Admin |
| 4.03       | [Add lists and favourites](#user-story-4.03-–-add-lists-and-favourites)                 | Procurement Officer Company Admin |
| 4.04       | [Search in material catalogue](#user-story-4.04-–-search-in-material-catalogue)         | Procurement Officer Company Admin |
| 5.01       | [Create a BOM](#user-story-5.01-–-create-a-bom)                                         | Procurement Officer Company Admin |
| 5.02       | [Edit BOM](#user-story-5.02-–-edit-bom)                                                 | Procurement Officer Company Admin |

## **User story 4.01 \- Managing the material catalogue** {#user-story-4.01---managing-the-material-catalogue}

\*As a **Super Admin\***  
_I want to manage the public material catalogue,_  
_so that it remains accurate, consistent, and reliable for all platform users._

**Acceptance criteria:**

1. The public material catalogue is accessible to all platform users.
2. The super admin can create new material items either by uploading a file or by a single input.
3. The super admin can edit, archive, or delete any material in the public catalogue.
4. Platform users can suggest new materials or changes to existing materials.
5. Suggested additions or changes are not published until they are reviewed and approved by a super
   admin.
6. The super admin can approve or reject suggested changes.
7. Approved changes are published immediately and become visible to all users.
8. The system prevents duplicate materials in the public catalogue.

**Functional requirements:**

1. Data fields for material catalogue:

[https://docs.google.com/document/d/1DGkza1evWOcic4J8gvLHfZ8dvITc2z80A_4Iu1pxGa0/edit?usp=sharing](https://docs.google.com/document/d/1DGkza1evWOcic4J8gvLHfZ8dvITc2z80A_4Iu1pxGa0/edit?usp=sharing)

## **User Story 4.02 – Contribute to material catalogue** {#user-story-4.02-–-contribute-to-material-catalogue}

\*As a **Procurement Officer, Company Admin\***  
_I want to add materials to the material catalogue,_  
_so that it contains the materials used in my projects._

**Acceptance criteria:**

1. User can edit and create new material items either by uploading a file in XLS, XLSX, or CSV
   format or by a single input.
2. When a file is uploaded, the system attempts to extract material data automatically.
3. Before processing, the system opens a column-mapping step where:
   1. Detected columns are displayed.
   2. The system suggests a data type for each column (e.g. material name, manufacturer, UoM,
      category).
   3. The user can confirm or adjust the column mappings.
4. If the file contains unstructured data (e.g. one description column), the system attempts to
   interpret the content automatically.
5. The user must confirm the column mapping step before continuing.
6. Extracted materials are displayed in a structured table including:
   1. Material name (mandatory)
   2. UPC (Optional)
   3. Manufacturer (optional)
   4. Category (mandatory)
   5. Unit of measure (mandatory)
   6. Description (optional)
   7. Duplicate status (unique / duplicate)
   8. Actions (edit, resolve duplicate, remove row)
7. The table supports sorting and row-level editing.
8. The user can open a detailed material card in a pop-up view to review and edit the material
   information.
9. The user can enter or update additional optional material details, limited to the fields defined
   in the material catalogue data structure.
10. The system prevents saving the duplicated materials, showing an error message if a try occurs.
11. Added materials become available for use within a company in linked workflows as private-only
    material catalogue items.
12. Added materials or made changes must be verified before adding to the public material catalogue
    (relates to **US 4.01**).

## **User Story 4.03 – Add lists and favourites** {#user-story-4.03-–-add-lists-and-favourites}

\*As a **Procurement Officer, Company Admin\***  
_I want to mark preferred materials and organise them into lists,_  
_so that I can quickly access commonly used items._

Acceptance criteria:

1. User can mark materials as preferred.
2. User can create one or more personal lists and add materials to lists.
3. User can view all preferred materials and lists.
4. Preferred materials and lists are visible for all users only within a company.

## **User Story 4.04 – Search in material catalogue** {#user-story-4.04-–-search-in-material-catalogue}

\*As a **Procurement Officer, Company Admin\***  
_I want to receive smart suggestions while searching the material catalogue,_  
_so that I can find the required materials faster._

**Acceptance criteria:**

1. User can search in the public material catalogue.
2. As the user types in the search field, the system suggests matching materials names in real time.
3. The search view provides recommendations such as frequently used materials, recently used
   materials, and materials from project BOMs.
4. User can select a suggested material directly from the recommendations.
5. If no matching materials are found, the system clearly indicates this and suggests adjusting the
   search or filters.
6. User can filter the material catalogue by category, manufacturer, material type, unit of
   measurement, material type, country of origin, and colour.
7. The user can sort the material catalogue by alphabetical order (A–Z / Z–A), by recent usage or by
   usage frequency.

## **User Story 5.01 – Create a BOM** {#user-story-5.01-–-create-a-bom}

_As a Procurement Officer, Company Admin_  
_I want to create a project BOM from an uploaded document,_  
_so that I can use it to manage procurement for that project faster._

**Acceptance criteria:**

1. The user can upload a BOM document in XLS, XLSX, CSV, or PDF.
2. When upload, the system processes the document and attempts to automatically extract material
   descriptions, quantities, units of measure.
3. The system attempts to match each extracted BOM line item to an existing material catalogue item.
4. The extracted BOM is displayed in a structured, editable table view for review, showing at
   minimum:
   1. Original item description (editable)
   2. Quantity (editable, manual input)
   3. Unit of measure (editable, single select)
   4. Matched material catalogue item (editable, single select)
   5. Material category (not-editable, based on matched material)
   6. Material type (not-editable, based on matched material)
   7. Matching confidence score (not-editable, system-generated)
5. Each BOM line item must be matched to a material catalogue item before the BOM can be saved.
6. For items with low confidence or no match, the system suggests possible best matches.
7. The user can manually select the correct catalogue item from the suggested list or search the
   catalogue.
8. The user can manually add a new line item from a material catalogue and edit the line details.
9. The user can create a new private material catalogue item directly from an unmatched BOM item if
   no suitable catalogue item exists.
10. The user must assign the BOM to an existing project or create a new project before saving.
11. The user must confirm and save the extracted BOM.
12. Once saved, the BOM is linked to the project and can be used to automatically populate data in
    related workflows.
13. If the system cannot extract data reliably, the error message is displayed.

## **User Story 5.02 – Edit BOM** {#user-story-5.02-–-edit-bom}

_As a Company Admin, Procurement Officer_  
_I want to edit an existing BOM,_  
_so that it stays accurate when project requirements change._

**Acceptance criteria:**

1. User can view all BOMs associated with projects.
2. User can add, edit, or remove items from a BOM.
3. Changes to the BOM are saved and immediately reflected in related workflows.
4. Changes to the BOM doesn't impact existing RFQs, POs, invoices or material requests.
5. The updated BOM remains linked to the project and is used as the latest version going forward.

# **Epic 4 \- Procurement**

Scope

| User story | Name                                                                                                                             | Role                                                   |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------- |
| 5.03       | [Create a Project](#user-story-5.03---create-a-project)                                                                          | Company Admin Procurement Officer                      |
| 5.04       | [View & edit all projects](#user-story-5.04---view-all-projects)                                                                 | _Company Admin, Procurement Officer, Finance Officer,_ |
| 5.05       | [Create RFQ](#user-story-5.05-–-create-rfq)                                                                                      | _Procurement Officer Company Admin_                    |
| 5.06       | [Review quotes](#user-story-5.06-–-review-quotes)                                                                                | _Procurement Officer Company Admin_                    |
| 5.07       | [Create a PO](#user-story-5.07-–-create-a-po)                                                                                    | _Procurement Officer Company Admin_                    |
| XX         | [Enter the delivery responsible person](<#user-story-xx---enter-the-delivery-responsible-person--optional-(dependency:-epic-5)>) | _Procurement Officer Company Admin_                    |
| 5.08       | [Create a bulk order](#user-story-5.08-–-create-a-bulk-order)                                                                    | _Procurement Officer, Company Admin_                   |
| 5.09       | [Drawdown from bulk order](#user-story-5.09-–-drawdown-from-bulk-order)                                                          | _Procurement Officer, Company Admin_                   |
| 5.23       | [PO & Bulk](#user-story-5.23-–-po-&-bulk)                                                                                        | _Procurement Officer, Company Admin_                   |
| 5.12       | [Change request management](#user-story-5.12-–-change-request-management)                                                        | _Vendor, Company Admin Procurement Officer,_           |
| 5.15       | [Pick up PO](#user-story-5.15-–-pick-up-po)                                                                                      | _Procurement Officer Company Admin_                    |
| 5.24       | [Pick up RFQ](#user-story-5.18-–-pick-up-rfq-items)                                                                              | _Procurement Officer, Company Admin_                   |
| 5.18       | [Edit RFQ](#user-story-5.18-–-edit-rfq)                                                                                          | _Procurement Officer, Company Admin_                   |
| 5.19       | [Approve line items RFQ quotes](#user-story-5.19-–-approve-line-items-rfq-quotes)                                                | _Procurement Officer, Company Admin_                   |

## **User story 5.03 \- Create a Project** {#user-story-5.03---create-a-project}

\*As a **Company Admin, Procurement Officer\***  
_I want to create and manage projects, assigning users to them_  
_so that they can access project-related information and workflows._

**Acceptance criteria:**

1. User can create a new project.
2. Mandatory project information includes: project name, location (multiple locations are allowed,
   one location must be marked as the default), project status (planned, ongoing, finished), storage
   location (multiple locations are allowed, one location must be marked as the default) and
   assigned users.
3. Optional fields are:
   1. planned budget (numeric value ≥ 0);
   2. responsible point of contact (single select, active user);
   3. start date (cannot be later than expected end date)
   4. expected end date (cannot be earlier than start date)
   5. description (long text)
   6. project type (Single-select from predefined list) (Residential, Commercial, Infrastructure,
      Maintenance, \+ add new project type)
   7. upload a document;
4. When a Procurement Officer creates a project system automatically assigns them to the
   project.System prevents the procurement officer from assigning or removing other users.
5. System prevents duplication of the project names.
6. User can edit project details and change project status at any time.
7. Company admin can assign users to a project or remove users from a project at any time.
8. Only users assigned to a project can access its data and documents
9. All changes are saved and applied immediately.

## **User story 5.04 \- View all projects** {#user-story-5.04---view-all-projects}

\*As a **Company Admin, Procurement Officer, Finance Officer,\***  
_I want to view all projects and access their details,_  
_so that I can easily find project-related information and documentation._

**Acceptance criteria:**

1. User can view a structured table of all projects they have access to.
2. Each project in the list displays key information such as name, status, ID (system-generated),
   default location.
3. The user can open a project detail page.
4. The project detail page displays the following related information, grouped into logical
   sections:

4.1 Project overview

1. Project name, ID, status, type
2. Default and additional locations
3. Assigned users and roles
4. Planned vs used budget
5. Start and expected end dates

4.2 Documents & BOM

6. Active project BOM
7. Historical BOM versions
8. Uploaded project documents (drawings, specs, contracts, etc.)

4.3 Procurement & materials

9. RFQs created for the project
10. Purchase Orders (standard, bulk, hold-for-release)
11. Drawdowns from bulk orders

4.4 Vendors & contracts

12. Vendors involved in the project
13. Linked bulk agreements

4.5 Financials

14. Invoices linked to the project

5\. The user can navigate to any related document by clicking on it.

## **User Story 5.05 – Create RFQ** {#user-story-5.05-–-create-rfq}

\*As a **Procurement Officer, Company Admin\***  
_I want to create RFQs and send them to vendors,_  
_so that I can receive competitive quotes._

**Acceptance criteria:**

1. The user can create an RFQ by:
   1. Converting a project BOM
   2. Creating an RFQ manually using the material catalogue
   3. copying the existing RFQ.
   4. from a saved list in the material catalogue
2. The user can review, edit, add, or remove line items before proceeding.
   1. Only items from the material catalogue can be added to RFQ line items.
   2. **User can manually enter the material item name, and when not found in the material
      catalogue, user can add the item to the material catalogue.**
3. When user has added all line items and confirmed it (proceed with the next step of the flow), the
   system checks item availability in **Active bulk orders**
4. When items are available in the bulk orders, system clearly notifies the user for each item.
5. The system suggests draw down from an existing bulk order
6. User can ignore/reject the suggestion.
7. When the user confirms bulk drawdown for selected items, THAN both actions are performed:
   1. Those items are removed from the RFQ automatically AND
   2. The corresponding bulk drawdown workflow is initiated.
8. When some items remain in the RFQ after bulk drawdown, THAN the RFQ creation flow continues only
   for the remaining items.
9. When all RFQ items are fully covered by bulk orders AND the user confirms the suggested actions,
   THAN the RFQ creation flow is closed AND user is clearly informed that no RFQ is required.
10. The user can select vendors to whom send the RFQ by:
    1. Selecting individual vendors from a company vendor's list, OR
    2. Selecting all vendors in the company vendor list
11. Vendors with status Invited can receive and respond to RFQs.
12. User can change the RFQ at any time before the vendor submits the response.
13. User can attach a file to the RFQ (up to 10 MB, PDF, XLSX, DOCX, JPG, CSV; upload failure shows
    error message.)
14. User can add a message to the RFQ.
15. The system confirms successful RFQ sending
16. If sending fails, a clear error message is displayed with the reason.

**Functional requirements:**

1. **RFQ Data Structure**
1. RFQ ID (system-generated)
1. Contractor company name (system-generated)
1. Project (mandatory, auto-populated if applicable, multi-select)
1. RFQ issue date (system-generated)
1. RFQ response deadline (mandatory)
1. Delivery location (mandatory, dropdown from the project locations list)
1. "Need by" delivery date (optional)
1. Hold for release (optional, checkbox, when enabled, than the user must specify the earliest
   delivery date when the vendor is allowed to deliver the materials)
1. Currency (mandatory, system-generated)
1. RFQ status (Draft, Open, Closed, Cancelled, system-generated)
1. Attached documents (optional)
1. **RFQ Line Items**
1. Material name (mandatory)
1. Quantity (mandatory)
1. Unit of measure (mandatory)
1. Cost code (pulled from ERP integration)
1. Notes per line (optional)

## **User Story 5.06 – Review quotes** {#user-story-5.06-–-review-quotes}

\*As a **Procurement Officer, Company Admin\***  
_I want to review vendor quotes and receive system suggestions,_  
_so that I can select the best offer._

**Acceptance criteria:**

1. The system displays RFQ responses in two interchangeable views:
   1. a comparison table view with vendor quotes shown side by side, and
   2. a list view showing each vendor response as a separate entry.
   3. The user can toggle between the two views at any time.
2. RFQ responses are displayed in the same order in both views and are sorted by default by system
   relevance ranking.
3. The user can change the sorting to:
   1. total quoted price, or
   2. delivery date.
4. The user can open the full quote detail page from either view.
5. When viewing the full quote details, the user can send messages to the vendor within the context
   of the RFQ.
6. When viewing the full quote details, the user can see the name of the user, who replied to the
   RFQ.
7. The user can approve or decline a quote from either view.
8. Declined quotes are moved to a hidden or collapsed section of the list or table.

**Comparison table view**

8. In the comparison table each vendor occupies a separate column and RFQ line items are displayed
   as rows.
   1. The table supports horizontal scrolling to review all vendor responses, while the RFQ line
      items column remains fixed to maintain context.
   2. For each vendor and line item, the table clearly displays:
      1. price per unir,
      2. quoted quantity and availability,
      3. line total price (indicating if taxes are included)
      4. delivery date,
      5. discount (if provided),
      6. shipment and handling price total,
      7. total quote price with taxes,
      8. substitution indicator (if applicable).
9. The system visually highlights:
   1. the lowest price per line item (when applicable), and
   2. missing or unquoted items.
10. From the comparison table, the user can
    1. hide one or more vendor columns,
    2. reject a vendor quote directly,
    3. open the full quote details.
11. If a vendor included a message or an attachment, this is clearly indicated by an icon visible in
    the table header or vendor column.

**List view**

12. In the list view, each vendor response is displayed as a separate list item.
13. Each list item shows key information at a glance:
    1. vendor name,
    2. total quoted price,
    3. overall discount (if any),
    4. earliest delivery date,
    5. number of quoted RFQ items versus total RFQ items,
    6. presence of messages or attachments (clearly indicated).
14. From the list view, the user can:
    1. open the full quote details,
    2. approve or reject the quote.
15. User can approve several quotes.
16. Once a quote is approved, the user can initiate conversion into:
    1. standard purchase order;
    2. bulk order;
    3. hold-for-release order.
17. Once approved, the quote gets a status "Closed", and all applied vendors are notified.
18. Awarded vendor(s) are notified that their quote has been approved.

## **User Story 5.07 – Create a PO** {#user-story-5.07-–-create-a-po}

_As a Procurement Officer, Company Admin_  
_I want to create purchase orders,_  
_so that I can formally notify vendors of my intent to purchase materials._

**Acceptance criteria:**

1. The user can create a purchase order by:
   1. converting one or several approved RFQ quotes or lines, or/and
   2. drawing down from an existing bulk order, or/and
   3. creating a PO manually, or
   4. copying the existing PO.
2. A purchase order must include the following mandatory information:
   1. Project (single selection from the list of projects the user has access to)
   2. Vendor (single select from the company’s vendor list)
   3. Delivery location (single select from the locations of the chosen project)
   4. Expected delivery date,
   5. At least one line item with material, quantity, unit of measure, unit price.
3. Once a vendor is selected, the system automatically populates the vendor’s details, including
   company name, legal information, and address.
4. Optional PO information includes:
   1. hold-for-release flag (checkbox),
   2. cost codes per line item (system-generated),
   3. material codes per line item (system-generated),
   4. line-level notes,
   5. line-level expected delivery date,
   6. material code for line items,
   7. payment terms (number entry)
   8. pick up (checkbox)
   9. PO-level message,
   10. Attachments.
5. For hold-for-release orders, the user must specify the earliest delivery date.
6. When a PO is created from an existing source (RFQ, bulk order, or material request), the system
   automatically populates all available data.
7. The user can review and adjust values before submission.
8. The user can set or override item prices manually.
9. When a user creates a PO manually and completes the list of required items, the system
   automatically checks each line item against:
   1. existing bulk orders,
   2. approved RFQs.
10. Based on the results, the system clearly informs the user if any items are:
    1. available for drawdown from a bulk order,
    2. covered by an approved RFQ with agreed pricing.
11. For each applicable case, the system suggests relevant actions:
    1. **Bulk order drawdown:** When the user confirms a bulk order drawdown, the system adds the
       bulk order vendor and the corresponding reserved items to the current purchase order with
       agreed bulk quantities and pricing.
    2. **Approved RFQ:** When the user confirms converting from approved RFQ, the system adds the
       vendor and items from approved RFQ to the current PO with quantities and pricing.
12. The user can choose to follow the suggested actions or proceed with PO creation as entered.
13. System validates that all mandatory fields are completed and displays clear error messages if
    any required information is missing or invalid.
14. System must assign a unique number to the PO.

## **User story XX \- Enter the delivery responsible person-** Optional (dependency: Epic 5\) {#user-story-xx---enter-the-delivery-responsible-person--optional-(dependency:-epic-5)}

\*As a **Procurement Officer, Company Admin\***  
_I want to specify the name and email of the person responsible for delivery when creating a
purchase order,_  
_so that they receive the purchase order and can submit the delivery report using a secure link_

**Acceptance criteria:**

1. When creating or editing a purchase order, the user must enter:
   1. name of the person responsible for delivery,
   2. email address of the person responsible for delivery.
2. After the purchase order is issued:
3. the responsible person receives an email notification with:
   1. the purchase order PDF attached,
   2. a tokenized link to submit the delivery report.
4. The tokenized link provides access only to the delivery report flow for that purchase order.
5. The user can update the delivery responsible person’s name and email before the purchase order is
   issued.

## **User Story 5.08 – Create a bulk order** {#user-story-5.08-–-create-a-bulk-order}

\*As a **Procurement Officer, Company Admin\***  
_I want to create and manage bulk orders,_  
_so that I can secure pricing and plan material supply in advance._

**Acceptance criteria:**

1. Bulk order can be created only from an approved RFQ response.
2. Bulk order data is automatically populated from the approved RFQ.
3. User must define an end date that determines how long the bulk order is valid.
4. The system tracks available quantities reserved under the bulk order and uses them for
   auto-suggestion in requests for materials, RFQ and PO workflows.
5. When the bulk order end date is reached, the user can propose an extension.
6. The vendor must approve the proposed extension before it becomes effective.
7. The user can view a list of all active and expired bulk orders with their details.
8. All the users of the contractor have access to all bulk orders within a company.
9. Company admin can limit access to the bulk order by assigning it to one or several projects.
10. When a bulk order is assigned, only the users assigned to that project can access the bulk
    order.

## **User Story 5.09 – Drawdown from bulk order** {#user-story-5.09-–-drawdown-from-bulk-order}

\*As a **Procurement Officer, Company Admin,\***  
_I want to draw down from an existing bulk order,_  
_so that I can quickly issue a purchase order for pre-committed items._

**Acceptance criteria:**

1. User can select an active bulk order and initiate a drawdown.
2. When the drawdown is initiated, the system creates a new purchase order with data automatically
   populated from the bulk order, including vendor, items, prices, and quantities. The standard PO
   creation workflow requirements are applied.
3. The user can adjust the drawdown by changing item quantities or removing items.
4. The system validates that requested quantities do not exceed the remaining available quantity in
   the bulk order.
5. All standard purchase order rules apply
6. Once issued, the PO reduces the available quantity in the bulk order accordingly.
7. The user is notified if the bulk order does not have sufficient remaining quantity for the
   requested drawdown.

## **User Story 5.23 – PO & Bulk** {#user-story-5.23-–-po-&-bulk}

_I want items that are covered by an active bulk agreement to be automatically applied when I create
a purchase order for a vendor,_  
_so that I can use pre-committed pricing and quantities while still ordering additional non-bulk
items in the same order_

**Acceptance criteria:**

_1\. WHEN user creates a purchase order and selects a vendor that has an active bulk agreement, THEN
user can see that the bulk agreement is available._  
*2\. WHEN user adds line items to t*he purchase order, AND when a material exists in the active bulk
agreement with that vendor, THEN bulk pricing and bulk terms are applied automatically to that line
item AND user can see how much bulk quantity is still available for that material.  
3\. User can include in the same purchase order:  
\- items that are covered by the bulk agreement, and  
\- items that are not covered by the bulk agreement.  
4\. For a bulk-covered item, user can enter a quantity that is:  
\- fully covered by the available bulk quantity, or  
\- partially covered by the available bulk quantity.  
5\. WHEN user enters a quantity that exceeds the remaining bulk quantity, THEN only the available
bulk quantity is applied using bulk pricing AND the remaining quantity is treated as a standard
(non-bulk) order within the same purchase order.  
6\. WHEN user submits the purchase order, THEN the quantities applied from the bulk agreement are
automatically deducted from the bulk agreement.  
7\. WHEN the purchase order is issued, THEN user can see the updated remaining quantities in the
bulk agreement.

## **User Story 5.12 – Change request management** {#user-story-5.12-–-change-request-management}

_As a Vendor, Company Admin , Procurement Officer,_  
_I want to create and manage change orders for existing purchase orders so that I can adjust
quantities, items or terms with the correct approvals and a full audit trail._

**Acceptance criteria:**

1. User can initiate either a Commercial change (requires approval by the other party) or an
   Internal change (does not require approval by the other party). change for any existing PO at any
   lifecycle stage.
2. For closed POs only internal changes are possible.
3. Commercial change includes any changes impacting PO value or delivery terms:
   1. line item quantities
   2. unit price or total price of any line item
   3. delivery dates (earliest delivery date or need to be delivery by date)
   4. adding or removing the line item
   5. delivery location
   6. discounts
   7. taxes
   8. shipment price
4. Upon submission, the commercial change request is sent to the other party and receives the status
   “Pending change.”
5. The system presents the proposed changes alongside the current values for review
6. The receiving party can review the change request and either approve or reject it, with an
   optional comment.
7. When a commercial change is approved, the purchase order is updated
8. Both parties are notified of the approval or rejection outcome.
9. Internal change includes administrative or accounting details of the PO:
   1. Cost codes
   2. Material codes, internal item references
   3. Project name, project code
   4. other internal legal or accounting identifiers
10. Internal changes are applied immediately after saving.
11. The other party is notified that the purchase order has been updated.
12. All changes are logged and visible for a user in a PO version history.
13. Each history entry includes:
    1. user who made a change
    2. user who approved a change (if apply)
    3. the changed fields,
    4. previous and updated values,
    5. change type (commercial or internal),
    6. user who made the change,
    7. timestamp.

## **User Story 5.15 – Pick up PO** {#user-story-5.15-–-pick-up-po}

_As a Procurement Officer, Company Admin_  
_I want to mark a purchase order as a pick-up order,_  
_so that materials are collected directly from the vendor instead of being delivered._

**Acceptance criteria:**

1. When creating a PO or creating a PO change request, the user can mark PO as a pick-up order.
2. When a PO is marked as a pick-up order:
   1. delivery information fields are disabled for the vendor.
   2. PO is labeled as “Pick-up” in all views.
   3. User can set a pick up time expectation (asap \- default, tomorrow, date)
   4. user can enter contact details (name, phone number) of the pick-up person.
3. The standard PO requirements apply to pick-up POs.
4. For pick-up POs, delivery reports are replaced with pick-up reports.

## **User Story 5.18 – Pick up RFQ items** {#user-story-5.18-–-pick-up-rfq-items}

_As a Procurement Officer, Company Admin_  
_I want to mark RFQ line items as pick-up items,_  
_so that vendors can quote without shipment and handling costs_

**Acceptance criteria:**

1. When creating or editing an RFQ, user can mark one or more RFQ line items as Pick-up.
2. For RFQ line items marked as Pick-up shipment and handling costs are not required in vendor
   responses.
3. Pick-up status is visible to vendors when they review and respond to the RFQ.
4. Pick-up status is preserved when the RFQ is approved and converted into a purchase order.
5. When a pick-up RFQ line item is converted into a purchase order, the corresponding PO line item
   is marked as Pick-up.

## **User Story 5.18 – Edit RFQ** {#user-story-5.18-–-edit-rfq}

_As a Procurement Officer, Company Admin_  
_I want to edit an RFQ before the vendor responds,_  
_so that I can correct mistakes or update information._

**Acceptance criteria:**

1. User can edit an RFQ before the vendor submits a response.
2. Edited RFQs do not require approval.
3. When an RFQ is edited, the system notifies all invited vendors about the update.
4. Once a vendor submits a response, the RFQ becomes read-only.

## **User Story 5.19 – Approve line items RFQ quotes** {#user-story-5.19-–-approve-line-items-rfq-quotes}

_As a Procurement Officer, Company Admin_  
_I want to approve individual RFQ line items from different vendor quotes,_  
_so that I can award each item to the most suitable supplier._

**Acceptance criteria:**

1. For each RFQ item, the user can approve line items on a line level and adjust quantity.
   1. The user can ignore the line item.
   2. The user can reject the line item.
2. For each RFQ item, the user can approve quantities from one or many vendors.
3. The user can allocate approved quantities across multiple vendor quotes for the same RFQ item.
4. The total approved quantity for an RFQ item cannot exceed the quantity requested in the RFQ.
5. The user must specify an approved quantity per vendor line item.
6. Approved quantity must be greater than zero. Approving a vendor with a quantity of zero is not
   allowed.
7. Approved quantity for a vendor cannot exceed the quantity quoted or available from that vendor
8. When viewing the RFQ request, user can see when an individual line item is approved, with the
   approved vendor(s) shown and approved quantities per vendor.
9. The user can change approvals and rejections until the RFQ is Closed.
10. Only RFQ items marked as “Approved” can be converted into purchase orders, bulk orders, or
    hold-for-release orders.
11. Only approved line items quantities can be converted into purchase orders, bulk orders, or
    hold-for-release orders.
12. Vendors are notified about RFQ items and quantities that have been approved for them.

# **Epic 5 \- Delivery \- Optional** {#epic-5---delivery---optional}

Scope

| User story              | Name                                                                                                                                                                                                | Role                              |
| :---------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------- |
| 6.08,6.09               | [Delivery report](#user-story-6.08,-6.09---delivery-report---optional) OPTIONAL                                                                                                                     | Company admin Procurement officer |
| XX (not in the backlog) | [Public delivery report submission](<#user-story-x.xx-–-submit-delivery-report-via-qr-code-(tokenized-access)-(out-of-the-initial-scope,-applicable-for-the-1st-release-only)---optional>) OPTIONAL | External                          |
| XX (not in the backlog) | [Convert public report](#user-story-xx---review-and-approve-external-delivery-report---optional) OPTIONAL                                                                                           | Company admin                     |

---

Original user stories are: 6.18, 6.08, 6.09  
Original user stories were adjusted to match 1st release limitations.

---

## **User story 6.08, 6.09 \- Delivery report \- OPTIONAL** {#user-story-6.08,-6.09---delivery-report---optional}

\*As a **Company admin, Procurement officer\***  
_I want to submit the delivery report_  
_So that I can user the delivery information for the invoice reconciliation process._

**Acceptance criteria**

1. The user can initiate a delivery report:
   1. from the purchase order details page
   2. from the delivery details page
   3. from a dashboard quick action
2. When a delivery report is initiated, the system generates a delivery report form pre-populated
   with line items from the purchase order
3. For each line item, the user must specify:
   1. Delivered quantity
   2. Delivery outcome (Delivered / Partially delivered / Not delivered / Rejected)
4. user can optionally add comments:
   1. report level
   2. per line item
5. User can optionally attach photos
6. When submitting a delivery report, the user can mark a line item as damaged or not delivered.
7. The user can specify whether:
   1. The entire line item is affected, or
   2. Only part of the quantity is affected
8. The system captures the user name, date and time of the delivery report.
9. User can override the date of delivery report by manual entry.
10. The system saves the delivery report.
11. The system notifies all users assigned to the PO about the delivery outcome.
12. The system updates the delivery status of the purchase order based on the delivery report

## **User Story X.XX – Submit delivery report via QR code (tokenized access) (out of the initial scope, applicable for the 1st release only) \- OPTIONAL** {#user-story-x.xx-–-submit-delivery-report-via-qr-code-(tokenized-access)-(out-of-the-initial-scope,-applicable-for-the-1st-release-only)---optional}

\*As an **non registred visitor\***  
_I want to submit a delivery report by scanning a QR code on the purchase order and confirming my
email,_  
_so that delivery information for that purchase order is captured accurately_

**Acceptance criteria**

1. The delivery responsible person can scan a QR code provided on the purchase order.
2. The delivery responsible person can use the tokenized link from the email notification.
3. After scanning the QR code, the user is taken to a delivery report page via a tokenized link.
4. To access the delivery report form, the user must:
   1. enter their name, and
   2. enter their email address.
5. An OTP code is sent to the entered email address.
6. The user must enter the OTP code to confirm access.
7. The OTP code is valid for 15 minutes.
8. After successful OTP verification, the user can access a delivery report form that is:
   1. linked to a specific purchase order,
   2. pre-populated with purchase order details and line items.
9. For each line item, the user must specify:
   1. delivered quantity,
   2. delivery outcome (Delivered / Partially delivered / Not delivered / Rejected).
10. The user can optionally:
    1. add comments at report level,
    2. add comments per line item,
    3. attach photos.
11. When submitting the delivery report, the user can mark a line item as damaged or not delivered.
12. For damaged items, the user can specify whether:
    1. the entire line item is affected, or
    2. only part of the quantity is affected.
13. Upon submission, the delivery report is saved with a status “Pending approval”.

## **User story XX \- Review and approve external delivery report \- OPTIONAL** {#user-story-xx---review-and-approve-external-delivery-report---optional}

\*As a **Company admin,\***  
_I want to review and approve submitted delivery reports,_  
_so that only verified delivery information affects purchase orders and invoice reconciliation_

**Acceptance criteria:**

1. Company Admin and Procurement Officer can view a list of submitted delivery reports with status
   **“Pending approval”**.
2. Each delivery report displays:

- purchase order reference,
- delivery date,
- submitted line items with delivered quantities and outcomes,
- damage information (if any),
- submitter name and email,
- attached photos (if any),
- comments (if any).

3. The user can review the delivery report details before approval.
4. The user can:

- approve the delivery report, or
- reject the delivery report with a comment.

5. If approved:

- the delivery report is linked to the purchase order,
- the purchase order delivery status is updated based on the report,
- the delivery data becomes available for invoice reconciliation.

6. If rejected:

- the delivery report is not applied to the purchase order,
- The PO status remains unchanged,
- the rejection reason is stored.

# **Epic 6 \- Invoice Reconciliation**

Scope

| User Story | Name                                                                                       | Role                                                        |
| :--------- | :----------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| 8.01       | [Upload the invoice](#user-story-8.01---upload-the-invoice)                                | Procurement Officer, Finance Officer, Vendor, Company Admin |
| 8.04       | [Matching invoice with PO](#user-story-8.04---matching-invoice-with-po)                    | Company Admin Procurement Officer Finance Officer           |
| 8.05       | [Reconcile the invoice](#user-story-8.05---reconcile-the-invoice)                          | Company Admin Procurement Officer Finance Officer           |
| 8.06       | [Resolve invoice disputes](#user-story-8.06---resolve-invoice-disputes)                    | Procurement Officer, Finance Officer, Vendor, Company Admin |
| 8.08       | [Invoice history](#user-story-8.08---invoice-history)                                      | Company Admin Procurement Officer Finance Officer           |
| 8.09       | [Get payment notifications](#user-story-8.09---get-payment-notifications)                  | Company Admin Procurement Officer Finance Officer           |
| 8.10       | [Link one invoice to multiple POs](#user-story-8.10---link-one-invoice-to-multiple-pos)    | Procurement Officer, Finance Officer, Vendor, Company Admin |
| 8.11       | [View financial reports](#user-story-8.11---view-financial-reports---optional) \- Optional | Company Admin Procurement Officer Finance Officer           |

## **User story 8.01 \- Upload the invoice** {#user-story-8.01---upload-the-invoice}

_As a Procurement Officer, Finance Officer, Vendor, Company Admin_  
_I want to upload an invoice,_  
_so that it is linked to the relevant purchase order and delivery._

**Acceptance criteria**

1. The user can upload an invoice from:
   1. dashboard quick actions
   2. PO details page
2. When uploading from the dashboard, the user must select the related PO (multiple selection
   allowed).
3. Supported file formats: PDF, PNG, JPG, JPEG, XLS/XLSX, DOC/DOCX, CSV. Maximum file size is 10 MB.
4. The user can upload files via drag-and-drop or file picker.
5. The system validates file format and size and shows an error if invalid.
6. The user can preview the file before submitting.
7. On submission, the system
   1. creates an invoice record,
   2. links it to the selected PO and delivery
   3. records the uploading user and timestamp.
8. The system notifies the user when the upload succeeds or fails.
9. The system allows multiple invoices per PO and multiple PO for invoice .

## **User story 8.04 \- Matching invoice with PO** {#user-story-8.04---matching-invoice-with-po}

\*As a **Company Admin , Procurement Officer, Finance Officer\***  
_I want invoice line items to be matched to purchase order,_  
_so that I can unify the data in both documents_

**Acceptance criteria**

1. System extracts structured data from the invoice file, including:
   1. Invoice header data (vendor, invoice number, date, totals, payment terms, taxes, additional
      costs),
   2. Invoice line items (description, quantity, unit price, line total).
2. System attempts to align extracted invoice line items with purchase order line items based on
   material identity and description.
3. System presents a review screen that shows:
   1. original invoice document in a preview pane, and
   2. \- extracted invoice data in editable form.
4. For each invoice line item, the system displays the aligned purchase order line item as reference
   information.
5. User can:
   1. review and edit extracted invoice data,
   2. change or remove the alignment to a purchase order line item,
   3. add missing invoice line items manually.
6. Invoice-level fields such as totals, taxes, payment terms, cost codes, and additional charges are
   displayed for review and are editable.
7. The user can save the reviewed invoice data.
8. Saving the invoice confirms the extracted data as the invoice’s captured content.

## **User story 8.05 \- Reconcile the invoice** {#user-story-8.05---reconcile-the-invoice}

_As a Company Admin , Procurement Officer, Finance Officer_  
_I want to verify that the invoice is issued for delivered items and with correct cost terms,_  
_so that I can decide whether the invoice can be approved for payment._

**Acceptance criteria**

1. Once invoice data is reviewed and saved, the user can initiate invoice reconciliation.
2. System aggregates all relevant data for reconciliation, including:
3. purchase order,
4. delivery reports linked to the PO, (optional: dependency)
5. captured invoice data.
6. System combines all delivery data across the PO to calculate total delivered quantities per line
   item. \- (optional: dependency)
7. System displays a reconciliation table with:
   1. Rows: material line items
   2. Columns:
      1. Ordered (from PO)
      2. Delivered (aggregated from delivery reports) \- (optional: dependency)
      3. Invoiced (from invoice)

**data displayed with material name, quantity and price.**

5. The system displays additional delivery details (e.g. damaged, not delivered quantities) when the
   user expands a line item. (optional: dependency)
6. The user can review each line item and:
7. Approve it, or
8. Reject it.
9. The user can also approve or reject the entire invoice at document level.
10. If any line item is rejected, the system prevents approving the full document.
11. After line items are reviewed, the system verifies other invoice data against PO and vendor
    records, including:
12. Cost, taxes, discount totals
13. Payment terms
14. Cost codes
15. Vendor details
16. Contractor details
17. The system clearly flags any discrepancies during the reconciliation process.
18. The user can approve or reject each discrepancy.
19. All approvals and rejections are recorded with user and timestamp
20. If any part of the invoice is rejected, the vendor is notified with:
    1. discrepency highlighting,
    2. supporting references (**delivery reports, photos \-** (optional: dependency)**,**
       documents),
    3. prompt to respond or propose changes.
21. Once the invoice is approved, it is marked as verified for payment.

**(\!) Dependency:**  
[If Epic 5 \- Delivery](#epic-5---delivery---optional) isn’t implemented, the invoice reconciliation
process is completed without delivery reports linked to the PO.

## **User story 8.06 \- Resolve invoice disputes** {#user-story-8.06---resolve-invoice-disputes}

\*As a **Company Admin , Procurement Officer, Finance Officer, Vendor\***  
_I want to resolve invoice disputes through communication and controlled changes,_  
_so that all parties can agree on the final invoice._

**Acceptance criteria**

1. When an invoice or any part of it is rejected, a dispute is created and linked to the invoice.
2. The vendor and contractor users can communicate in an invoice-specific discussion thread.
3. Both vendor and contractor can propose changes to the invoice data.
4. Each proposed change:
   1. Is visible to the other party,
   2. Requires explicit approval or rejection.
5. If a proposed change is pending, no further changes to that field can be made until it is
   resolved.
6. The contractor user can approve the invoice at any time, even if discrepancies or disputes are
   still open.
7. All messages, changes, approvals, and rejections are recorded in the invoice history.

## **User story 8.08 \- Invoice history** {#user-story-8.08---invoice-history}

\*As **Finance Officer, Company Admin , Procurement Officer\***  
_I want to see the full history of invoice handling,_  
_so that all decisions and changes are traceable._

**Acceptance criteria**

1. Each invoice details page includes a history section.
2. The history shows all relevant events, including:
   1. Upload
   2. data edits
   3. reconciliation actions
   4. approvals and rejections
   5. dispute creation and resolution
   6. status changes
3. Each history entry displays:
   1. Action type
   2. User who performed the action
   3. Timestamp
   4. Optional comment or reason
4. History entries are read-only and cannot be modified.

## **User story 8.09 \- Get payment notifications** {#user-story-8.09---get-payment-notifications}

\*As a **Finance Officer, Company Admin\***  
_I want to be notified when an invoice due date is approaching or has passed,_  
_so that payments are made on time._

**Acceptance criteria**

1.  User can configure how many days before the due date they want to receive a notification.
2.  System sends a notification when:
    1.  due date is approaching (based on the configured lead time), and the invoice is still in
        Approved status.
    2.  due date has passed and the invoice is still in Approved status.
3.  Notification is cleared automatically when:
    1.  invoice status changes to Paid.
4.  Overdue notifications remain visible until the invoice is resolved.
5.  Notifications are delivered through
    1.  In-app notifications
    2.  Dashboard alerts
    3.  Email
6.  Each notification links directly to the related invoice.

## **User story 8.10 \- Link one invoice to multiple POs** {#user-story-8.10---link-one-invoice-to-multiple-pos}

\*As a **Company Admin , Procurement Officer, Finance Officer, Vendor\***  
_I want to link one invoice to multiple POs (split or standalone POs)_  
_So that the reconciliation process aggregates all necessary order and delivery details across those
POs._

**Acceptance criteria:**

1. When uploading an invoice, the user can link the invoice to one or more POs using multi-select.
2. When multiple POs are linked to one invoice, the system aggregates all delivery reports
   (Optional) from all linked POs, and uses the aggregated data set as the input for the standard
   reconciliation process.
3. The existing invoice reconciliation flow applies unchanged, but operates on the union of all
   linked POs and the aggregated delivery data (Optional).

## **User story 8.11 \- View financial reports \- Optional** {#user-story-8.11---view-financial-reports---optional}

_As a Company Admin , Procurement Officer, Finance Officer_  
_I want to view financial reports related to procurement activities,_  
_so that I can understand spending, commitments, and pricing trends_

**Acceptance criteria:**

1\. Contractor user can access a reporting section from the platform.  
2\. Contractor user can view the following financial reports:  
\- price report per item (based on statistical data available in the platform),  
\- total spend,  
\- spend vs committed amount,  
\- spend by selected date range.  
3\. Contractor user can select a date range to limit the data shown in the reports.  
4\. Contractor user can filter reports by:  
\- project,  
\- vendor,  
\- material code  
\- cost code  
5\. Price report per item shows aggregated historical data for the selected material, including
prices from RFQs, POs, and invoices.  
6\. Total spend report shows aggregated actual spend based on invoices.  
7\. Spend vs committed report compares:  
\- committed amounts (approved POs and bulk orders),  
\- actual spend (invoices).  
8\. Reports reflect only project data the user has access to  
9\. User can export the generated report.

# Other

1. **Notifications**
   1. The system generates notifications for relevant events.
   2. Notifications are delivered in-app and by email
   3. Notifications are linked to the relevant document or action.
   4. Notifications are grouped by type and priority.
   5. Notifications are marked as read when opened.
   6. The user can configure which notifications they receive and through which channel.
   7. Notification events:
      [https://docs.google.com/document/d/1JIAS-V6ZGrdYT3j34DLh0H1GvDVaMoyqsLHcsG4WlFo/edit?usp=sharing](https://docs.google.com/document/d/1JIAS-V6ZGrdYT3j34DLh0H1GvDVaMoyqsLHcsG4WlFo/edit?usp=sharing)
2. **System Logs**
   1. User can view the system logs of all significant actions on business documents.
   2. Logs include who performed the action, what changed, and when.
   3. Logs cannot be edited or deleted.
   4. Logs are visible in the context of each document.
3. **Admin panel**
   1. Super admin can access an administration panel
   2. Panel displays the status of:
      1. External integrations (ERP, accounting, inventory, email ingestion, etc.)
      2. Background jobs (OCR processing, email ingestion, synchronization tasks)
      3. Notification delivery (email service, in-app delivery)
   3. For each integration or system component, the panel shows:
      1. Current status (healthy / warning / error)
      2. Last successful run or sync time
      3. Last error message (if any)
   4. The Super Admin can:
      1. View detailed error logs for failed jobs or integrations,
      2. Retry failed jobs or syncs,
      3. Disable or enable integrations.
   5. The system generates system alerts for:
      1. Integration failures,
      2. Repeated processing errors,
      3. Backlogs in queues (e.g., invoices not processed, messages not delivered).
   6. Super Admin receives notifications for critical system issues.
   7. All system-level actions (retries, disables, configuration changes) are logged with user and
      timestamp.
4. **Currency**
   1. The system uses AUD as the default currency for all price fields, including:
      1. RFQs,
      2. Quotes,
      3. Purchase Orders,
      4. Bulk Agreements,
      5. Invoices.
   2. All price entry fields display the current currency clearly.
   3. User can manually select a different currency from a predefined dropdown list.
   4. The selected currency is stored per document.
   5. Users viewing the document see the currency used for that document.

**Reconciliation process system requirements (if optional scope is implemented):**

1. Delivery reports can be submitted under a Closed purchase order
2. Invoices can be submitted under a Closed purchase order
3. Closed status does not block additional delivery reports and additional invoices.
4. One purchase order can be linked to multiple invoices.
5. One invoice can be linked to multiple purchase orders.
6. Reconciliation logic must operate on:

- all linked POs,
- all related delivery reports,
- aggregated quantities and values.

7. One purchase order can be linked to multiple delivery reports.
8. Delivery status of a PO is derived from all linked delivery reports

**Bulk quantity consumption rules:**

1. During PO flow, if the material exists in an active bulk agreement with the selected vendor, bulk
   pricing and bulk terms must be automatically applied to that line item and the ordered quantity
   is automatically deduced from the bulk agreement.

**Diagrams**

1. [Procurement Flow](https://www.mermaidchart.com/d/a1cab62a-059d-445e-a6e7-87ce65c85db4)
2. [Invoice reconciliation](https://www.mermaidchart.com/d/c0d747d2-358d-40e9-9f9d-58d46aa44f9b)
3. [Change order](https://www.mermaidchart.com/d/acaf850d-6861-4fc5-ad14-3e0c2d13530a)
4. [Bulk orders](https://www.mermaidchart.com/d/0cc3a52e-e5d7-453b-aabb-355188ebdf3a)
5. [Field request](https://www.mermaidchart.com/app/projects/deb412ee-1286-4aca-88ef-f90225cbe10a/diagrams/b6e2d178-d753-496f-a12f-b30a1b168c85/version/v0.1/edit):
6. [Defect report sequence diagram](https://www.mermaidchart.com/d/6390bef6-3dee-4648-9d9c-55dba77c6b2d)
7. [Delivery confirmation](https://www.mermaidchart.com/d/49e59b23-2661-47d1-8e0d-560137c64b84)
8. [Material request flow](https://www.mermaidchart.com/d/970320d2-0eb5-4717-84f0-935e64ccd5f1)
9. [ERD](https://www.mermaidchart.com/d/498bca09-a332-4a81-8db6-474694d5502b)
10. [Server](https://www.mermaidchart.com/d/9db18d73-8a63-453b-b966-44fa4f9585b9)
11. [States](https://viewer.diagrams.net/?tags=%7B%7D&lightbox=1&highlight=0000ff&edit=_blank&layers=1&nav=1&title=States%3A%20Procurement%20platform&dark=auto#Uhttps%3A%2F%2Fdrive.google.com%2Fuc%3Fid%3D1V9wHE3uKxbe2YzbC0QLAIM1FNR4lyg-O%26export%3Ddownload)
