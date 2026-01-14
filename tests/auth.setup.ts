import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
    // Navigate to sign in
    await page.goto('/signin');

    // Click sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Wait for ADFS redirect
    await page.waitForURL(/vespiario\.net\/adfs/, { timeout: 10000 });

    // Fill in ADFS login form
    await page.locator('#userNameInput').fill('test@vespiario.net');
    await page.locator('#passwordInput').fill('T12345678');
    await page.locator('#submitButton').click();

    // Wait for successful login and redirect back
    await page.waitForURL(/vespistiid-backend-dev\.vespiario\.net/, { timeout: 15000 });

    // Save signed-in state
    await page.context().storageState({ path: authFile });

    console.log('✅ Authentication completed and saved to:', authFile);
});
