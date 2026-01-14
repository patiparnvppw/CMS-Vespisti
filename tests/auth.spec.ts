import { test, expect } from '@playwright/test';

// Auth tests should not use saved authentication state
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
    test('should show login page', async ({ page }) => {
        await page.goto('/signin');

        await expect(page).toHaveURL(/\/signin/);
        await expect(
            page.getByRole('button', { name: 'Sign in' })
        ).toBeVisible();
    });

    test('redirect to vespiario', async ({ page }) => {
        await page.goto('/signin');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page).toHaveURL(/vespiario\.net\/adfs\/ls/);
    });

    test('validate field blank', async ({ page }) => {
        await page.goto('/signin');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.locator('#submitButton').click();
        await expect(page.locator('#errorText')).toBeVisible();
    });

    test('validate email', async ({ page }) => {
        await page.goto('/signin');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.locator('#userNameInput').fill('test@test.com');
        await page.locator('#submitButton').click();
        await expect(page.locator('#errorText')).toBeVisible();
    });

    test('validate password', async ({ page }) => {
        await page.goto('/signin');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.locator('#passwordInput').fill('Test1234');
        await page.locator('#submitButton').click();
        await expect(page.locator('#errorText')).toBeVisible();
    });

    test('sign in success', async ({ page }) => {
        await page.goto('/signin');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.locator('#userNameInput').fill('test@vespiario.net');
        await page.locator('#passwordInput').fill('T12345678');
        await page.locator('#submitButton').click();
        await expect(page).toHaveURL(/vespistiid-backend-dev\.vespiario\.net/);
    });

    test('sign out success', async ({ page }) => {
        await page.goto('/signin');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.locator('#userNameInput').fill('test@vespiario.net');
        await page.locator('#passwordInput').fill('T12345678');
        await page.locator('#submitButton').click();
        await page.getByRole('button', {
            name: 'Test-FirstName Test-lastName'
        }).click();
        await page.getByRole('button', { name: 'Sign Out' }).click();

        // Wait for sign out to complete
        await page.waitForURL(/signin/, { timeout: 5000 });

        await expect(page).toHaveURL(/signin/);
    });

    test('sign in with inactive credentials', async ({ page }) => {
        await page.goto('/signin');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.locator('#userNameInput').fill('test2@vespiario.net');
        await page.locator('#passwordInput').fill('T12345678');
        await page.locator('#submitButton').click();

        await expect(page).toHaveURL(/vespistiid-backend-dev\.vespiario\.net/); //stay on sign in page
    });

    test('sign in with invalid credentials', async ({ page }) => {
        await page.goto('/signin');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.locator('#userNameInput').fill('test3@vespiario.net');
        await page.locator('#passwordInput').fill('T12345678');
        await page.locator('#submitButton').click();

        const modal = page.locator('div:has-text("Access limit by permission!")');
        await expect(
            modal.getByRole('heading', { name: 'Access limit by permission!' })
        ).toBeVisible();
    });

    test('should redirect to signin after sign out and go back', async ({ page }) => {
        await page.goto('/signin');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.locator('#userNameInput').fill('test@vespiario.net');
        await page.locator('#passwordInput').fill('T12345678');
        await page.locator('#submitButton').click();

        await expect(page).toHaveURL(/vespistiid-backend-dev\.vespiario\.net/);

        await page.getByRole('button', {
            name: 'Test-FirstName Test-lastName'
        }).click();
        await page.getByRole('button', { name: 'Sign Out' }).click();

        // Wait for sign out to complete
        await page.waitForURL(/signin/, { timeout: 5000 });
        await expect(page).toHaveURL(/signin/);

        await page.goBack();
        await page.waitForURL(/signin/, { timeout: 1000 });

        await expect(page).toHaveURL(/signin/);
    });
});
