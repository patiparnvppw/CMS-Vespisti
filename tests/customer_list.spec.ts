import { test, expect } from '@playwright/test';

test.describe('Customer', () => {
    test('Display customer list', async ({ page }) => {
        // Navigate directly to customer page (already authenticated via storageState)
        await page.goto('/customer');

        await expect(page).toHaveURL(/vespiario\.net\/customer/);
        await expect(page.locator('table')).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Name / Vespisti ID' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Phone' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Gender' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Date of Birth' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Created Date' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Deleted Date' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Detail' })).toBeVisible();
    });

    test('Current user information display', async ({ page }) => {
        // Navigate directly to customer page (already authenticated via storageState)
        await page.goto('/customer');

        await expect(page.locator('table')).toBeVisible();
        const idElements = page.locator('tbody tr .text-theme-xs.text-gray-500');
        const count = await idElements.count();

        for (let i = 0; i < count; i++) {
            const id = await idElements.nth(i).textContent();

            if (id && id.startsWith('VP')) {
                // Verify format: VP + 8 digits = 10 characters total
                expect(id).toMatch(/^VP\d{8}$/);
                expect(id).toHaveLength(10);
            }
        }
    });
});