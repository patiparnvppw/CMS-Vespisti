# Playwright Test Examples

This directory contains automated E2E tests for CMS Vespisti using Playwright.

## Test Files

- **example.spec.ts** - Basic smoke tests for homepage and navigation
- **auth.spec.ts** - Authentication flow tests (login, validation)
- **content.spec.ts** - CMS content management tests (CRUD operations, search, filtering)
- **fixtures.ts** - Custom test fixtures (authenticated sessions, etc.)

## Running Tests

```bash
# Run all tests
npm test

# Run tests in headed mode (see browser)
npm run test:headed

# Run tests with UI mode (interactive)
npm run test:ui

# Run tests in debug mode
npm run test:debug

# Show test report
npm run test:report

# DEV environment
ENV=dev npm run test:ui

# UAT environment
ENV=uat npm run test:ui

# PROD environment
ENV=prod npm run test:ui

# Run specific test file
npx playwright test tests/auth.spec.ts

# Run tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# DEV
ENV=dev npx playwright test --ui

# UAT
ENV=uat npx playwright test --ui

# PROD
ENV=prod npx playwright test --ui
```

## Test Structure

Tests follow the AAA pattern:

- **Arrange**: Set up test data and navigate to pages
- **Act**: Perform user actions
- **Assert**: Verify expected outcomes

## Writing New Tests

1. Create a new `.spec.ts` file in the `tests/` directory
2. Import test and expect from `@playwright/test`
3. Use `test.describe()` to group related tests
4. Write individual tests with `test('description', async ({ page }) => { ... })`

## Best Practices

- Use data-testid attributes for stable selectors
- Keep tests independent and isolated
- Use fixtures for common setup (authentication, etc.)
- Take advantage of auto-waiting - Playwright waits for elements automatically
- Use meaningful test descriptions

## Configuration

See `playwright.config.ts` in the root directory for:

- Browser configurations
- Test timeout settings
- Base URL configuration
- Reporter options
- Video and screenshot settings
