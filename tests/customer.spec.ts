import { test, expect } from '@playwright/test';

test.describe('Customer', () => {
    test('should show login page', async ({ page }) => {
        await page.goto('/signin');

        await expect(page).toHaveURL(/\/signin/);
        await expect(
            page.getByRole('button', { name: 'Sign in' })
        ).toBeVisible();
    });
});