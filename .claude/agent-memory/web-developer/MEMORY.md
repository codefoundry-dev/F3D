# Web Developer Agent Memory

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

## Figma Access

- No Figma MCP tools are configured in the .claude directory
- No FIGMA_API_KEY or tokens in environment variables
- Must request user to configure Figma MCP or provide screenshots for visual comparison
