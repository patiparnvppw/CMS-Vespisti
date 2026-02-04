import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page, baseURL }) => {
    await page.goto('/signin');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/vespiario\.net\/adfs/, { timeout: 10000 });

    await page.locator('#userNameInput').fill('test@vespiario.net');
    await page.locator('#passwordInput').fill('T12345678');
    await page.locator('#submitButton').click();

    // Wait for redirect to current environment URL (dynamic based on baseURL)
    const urlPattern = new RegExp(baseURL?.replace(/https?:\/\//, '').replace(/\/$/, '') || 'vespiario');
    await page.waitForURL(urlPattern, { timeout: 15000 });

    await page.context().storageState({ path: authFile });

    console.log('✅ Authentication completed and saved to:', authFile);
});
