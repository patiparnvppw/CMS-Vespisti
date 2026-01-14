import { test as base, Page } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

// Extend basic test with custom fixtures
export const test = base.extend<{ authenticatedPage: Page }>({
    // Custom fixture for authenticated user
    // Note: With auth.setup.ts, most tests will use storageState automatically
    // This fixture is for special cases where you need fresh authentication
    authenticatedPage: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: authFile,
        });
        const page = await context.newPage();

        await use(page);

        await context.close();
    },
});

export { expect } from '@playwright/test';
