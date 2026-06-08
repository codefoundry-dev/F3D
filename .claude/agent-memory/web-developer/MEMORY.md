# Web Developer Agent Memory

## Feature Notes

- [Material catalogue feature (FOR-228)](material-catalogue-feature.md) — catalogue list + import
  flow reusing doc-intelligence upload/poll hooks; api-client MaterialListItemDto drift gotcha.

## Project Auth UI Patterns (Confirmed)

- All auth form components use `space-y-6` for top-level section spacing
- Form fields within the same logical group use `space-y-4`
- Back/navigation links are placed INSIDE the form content wrapper (not outside with manual mt-4)
- Auth components: LoginForm, ForgotPasswordForm, CheckEmailCard, ResetPasswordForm, TwoFactorCard
- All live in `packages/ui-components/src/components/`
- All use AuthLayout + IconBadge as shared wrapper
- TwoFactorCard was the most recently added and reflects the latest Figma alignment

## Design Token System

- CSS custom properties defined in each app's `globals.css` (light + dark mode)
- Tailwind theme references these via `hsl(var(--token-name))` pattern
- Colors, typography, and spacing must use design tokens (Constitution Principle IX)
- Key files: `packages/config/tailwind/colors.ts`, `packages/config/tailwind/typography.ts`
- Semantic color tokens that exist: `success`, `warning`, `destructive`, `primary`, `muted`,
  `foreground`. Status pills should use `bg-<token>/10 text-<token>` (mirrors the `Alert`
  component). NOTE: some older Badges hardcode hex (`bg-[#e4e4e4]`) — do NOT copy that anti-pattern.

## RFQ / PO Detail Page Tab Architecture

- RFQ buyer detail tabs are split: `RfqDetailTabs` + `RfqTab` type live in
  `packages/rfq-shared/src/components/`, but the individual tab CONTENT components
  (`RfqQuoteAuditTab`, `RfqEmailLogTab`, etc.) live in
  `apps/web/src/features/rfqs/buyer/components/`. The page (`RfqDetailPage.tsx`) imports the type
  from rfq-shared and renders the apps/web tab components.
- PO detail tabs are fully in `packages/po-shared/src/components/` — both `PoDetailTabs`/`PoTab` AND
  the content tabs (`PoDocumentsTab`, `PoEmailLogTab`, `PoActionLogTab`).
  `PurchaseOrderDetailPage.tsx` imports all from `@forethread/po-shared`.
- GOTCHA: `PoDetailTabs` has an internal default `TABS` list. `PurchaseOrderDetailPage` must pass
  `tabs={validTabs}` explicitly or a newly-added tab key won't render in the tab bar (RFQ page
  already passes `tabs`).
- Tab labels are dynamic i18n: `t(\`tabs.${tab}\` as
  never)`. Add the key under `tabs.\*`in`packages/i18n/src/locales/en/{rfqs,purchaseOrders}.json`.
- Adding a tab = update the `*Tab` union type + page `validTabs` + render branch + i18n
  `tabs.<key>`.

## i18n

- Only `en` locale exists. Keys typed via `typeof resources` in `packages/i18n/src/types.ts` —
  adding keys to the en JSON auto-types them; NO codegen step. Static `t('x.y')` keys are
  type-checked; dynamic keys use `as never`.

## shared-types/client Boundary

- Frontend + api-client + rfq-shared + po-shared import shared DTOs/enums from
  `@forethread/shared-types/client` (NEVER root barrel — root drags in @nestjs/swagger, breaks
  Vite).
- The `/client` barrel re-exports real string `enum`s (e.g. `EmailDeliveryStatus`) usable as runtime
  values. po-shared/rfq-shared don't declare shared-types in package.json but resolve it via
  workspace hoist (existing `usePoWizardForm.ts` does the same) — typecheck/build pass.
- TanStack Query hooks live in `packages/{rfq,po}-shared/src/hooks/use{Rfqs,PurchaseOrders}.ts`;
  queryKey style `['rfqs', id, 'sub-resource']` / `['purchase-orders', id, 'sub-resource']`,
  `enabled: !!id`. Export from both the hooks `index.ts` and the package root `index.ts`.
- GOTCHA (RFQ lineItems): zod types `lineItems[].source` as a string union but the api-client DTO
  uses the `RfqLineItemSource` enum — nominally incompatible at `tsc`. Cast at the service boundary.
  See [rfq-line-item-source-enum-vs-zod.md](rfq-line-item-source-enum-vs-zod.md).

## Verification Commands (this monorepo, Windows)

- `pnpm --filter <pkg> run <script>` prints a harmless "No projects matched ... f3d in ... F3D"
  path-casing line — ignore, command still runs.
- Web app pkg = `@forethread/web` (scripts: typecheck, lint, build, test). api-client has
  typecheck+lint. po-shared has only `test`; rfq-shared & i18n have NO scripts — they get
  typechecked transitively by the web app's `build` (`tsc --noEmit`) since apps import their
  `./src`.
- Run a single test file: `pnpm --filter <pkg> exec vitest run <path>`.
- Test conventions: vitest, `globals: true`, hoisted mocks via `vi.hoisted`, mock `@forethread/i18n`
  (t returns key), mock `@forethread/ui-components`, mock `*.svg?react` icons, mock the hook module.
  Lint flags `${unknown}` in template literals — wrap mock interpolations in `String(...)`.

## Figma Access

- No Figma MCP tools are configured in the .claude directory
- No FIGMA_API_KEY or tokens in environment variables
- Must request user to configure Figma MCP or provide screenshots for visual comparison
