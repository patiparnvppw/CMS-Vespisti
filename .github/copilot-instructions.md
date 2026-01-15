# CMS Vespisti - AI Coding Instructions

## Project Overview
E2E testing suite for CMS Vespisti using Playwright with multi-environment (DEV/UAT/PROD) and cross-browser (Chrome/Firefox/Safari) support.

## Architecture

### Authentication Pattern (Critical)
- `tests/auth.setup.ts` - Runs FIRST, authenticates via ADFS, saves session to `playwright/.auth/user.json`
- `*.spec.ts` files - Use saved `storageState` automatically (no repeated logins)
- Auth tests MUST disable storageState: `test.use({ storageState: { cookies: [], origins: [] } })`

### File Naming
| Pattern | Purpose |
|---------|---------|
| `*.setup.ts` | Setup tasks (runs before tests) |
| `*.spec.ts` | Test specs (uses saved auth) |

## Commands
```bash
npm run test:ui          # UI mode (recommended for dev)
npm run test:headed      # See browser
npm run test:dev         # DEV environment
npx playwright test tests/customer_list.spec.ts --headed  # Single file
npx playwright test -g "test name" --headed               # Single test
```

## Project-Specific Patterns

### Data Masking Rules
- **Name**: Full first name + 3 chars last name + `*` (`John Smi***`)
- **Email**: 3 chars + `*` + full domain (`joh****@domain.com`)
- **Phone**: 6 digits + `*` (`081234****`)
- **DOB**: `**/mm/yyyy`

### Active Users Filter
Always exclude deleted users when testing filters:
```typescript
const deletedDate = await row.locator('td:nth-child(7)').textContent();
if (!deletedDate?.trim() || deletedDate.trim() === '-') {
    // Include this user
}
```

### Flatpickr Date Inputs
Use API directly (inputs are readonly):
```typescript
await dateInput.click();
await page.waitForSelector('.flatpickr-calendar.open');
await page.evaluate(() => {
    const fp = (document.querySelector('input.flatpickr-input') as any)?._flatpickr;
    if (fp?.isOpen) fp.setDate(['01/01/2024', '07/01/2024'], true, 'd/m/Y');
});
```

### Locator Patterns
```typescript
page.locator('tbody tr td:nth-child(N)')           // Table cells
page.getByRole('columnheader', { name: 'Name' })   // Headers
page.locator('select').nth(N)                      // Multiple dropdowns
```

## Key Files
- `playwright.config.ts` - Environment URLs, browser projects, setup dependencies
- `tests/auth.setup.ts` - ADFS authentication flow
- `tests/customer_list.spec.ts` - Data validation & filter test examples

## Environments
| ENV | URL |
|-----|-----|
| dev | `https://vespistiid-backend-dev.vespiario.net/` |
| uat | `https://uat.cms-vespisti.com` |
| prod | `https://cms-vespisti.com` |
