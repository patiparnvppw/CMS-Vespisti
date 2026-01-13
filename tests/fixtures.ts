import { test as base, Page } from '@playwright/test';

// Extend basic test with custom fixtures
export const test = base.extend<{ authenticatedPage: Page }>({
    // Custom fixture for authenticated user
    authenticatedPage: async ({ page }, use) => {
        // Perform login via ADFS
        await page.goto('/signin');
        await page.getByRole('button', { name: 'Sign in' }).click();

        // Wait for ADFS redirect
        await page.waitForURL(/vespiario\.net\/adfs/);

        // Fill ADFS login form
        await page.locator('#userNameInput').fill('test@vespiario.net');
        await page.locator('#passwordInput').fill('T12345678');
        await page.locator('#submitButton').click();

        // Wait for successful login
        await page.waitForURL(/vespistiid-backend-dev\.vespiario\.net/);

        await use(page);
    },
});

export { expect } from '@playwright/test';
