import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const XlsxPopulate = require('xlsx-populate');

const EXCEL_FILE_PASSWORD = 'TEST';
const DOWNLOAD_TIMEOUT = 60000; // 60 seconds for download attempt
const MAX_DOWNLOAD_RETRIES = 2; // Retry 2 times (total 3 attempts)

// Helper function to download with retry + refresh on timeout
import { Page, Download } from '@playwright/test';

async function downloadWithRetry(
    page: Page,
    maxRetries: number = MAX_DOWNLOAD_RETRIES,
    reapplyFilter?: () => Promise<void>
): Promise<Download> {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            console.log(`📥 Download attempt ${attempt}/${maxRetries + 1}...`);

            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: DOWNLOAD_TIMEOUT }),
                page.getByRole('button', { name: 'Yes' }).click()
            ]);

            console.log(`✅ Download successful on attempt ${attempt}`);
            return download;
        } catch (error) {
            console.log(`⚠️ Download attempt ${attempt} failed: ${(error as Error).message}`);

            if (attempt > maxRetries) {
                console.log(`❌ All ${maxRetries + 1} download attempts failed`);
                throw error;
            }

            // Refresh page and try again
            console.log(`🔄 Refreshing page and retrying...`);
            await page.reload();
            await page.waitForTimeout(2000);
            await page.waitForSelector('table', { state: 'visible' });

            // Re-apply filter if provided
            if (reapplyFilter) {
                console.log(`🔄 Re-applying filter...`);
                await reapplyFilter();
                await page.waitForTimeout(1000);
            }

            // Re-open export dialog
            await page.getByRole('button', { name: 'Export to Excel' }).click();
            await page.waitForSelector('text=Data Export Warning', { state: 'visible' });
        }
    }

    throw new Error('Download failed after all retries');
}

// Helper function to extract zip and read password-protected Excel
async function extractAndReadExcel(zipFilePath: string): Promise<{
    workbook: any;
    data: Record<string, any>[];
    headers: string[];
}> {
    // Create temp directory for extraction
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-test-'));

    try {
        // Extract zip (no password needed for zip)
        execSync(`unzip -o "${zipFilePath}" -d "${tempDir}"`, {
            stdio: 'pipe'
        });

        // Find Excel file in extracted contents
        const files = fs.readdirSync(tempDir);
        const excelFile = files.find(f => f.endsWith('.xlsx') || f.endsWith('.xls'));

        if (!excelFile) {
            throw new Error(`No Excel file found in zip. Files: ${files.join(', ')}`);
        }

        const excelPath = path.join(tempDir, excelFile);
        console.log(`📂 Extracted Excel: ${excelFile}`);

        // Read password-protected Excel file using xlsx-populate
        const workbook = await XlsxPopulate.fromFileAsync(excelPath, { password: EXCEL_FILE_PASSWORD });
        const sheet = workbook.sheet(0);

        // Get used range
        const usedRange = sheet.usedRange();
        if (!usedRange) {
            return { workbook, data: [], headers: [] };
        }

        const values = usedRange.value() as any[][];

        // Get headers (first row)
        const headers = (values[0] || []).map(h => h?.toString() || '');

        // Get data as objects
        const data: Record<string, any>[] = [];
        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const record: Record<string, any> = {};
            for (let j = 0; j < headers.length; j++) {
                record[headers[j]] = row[j];
            }
            data.push(record);
        }

        return { workbook, data, headers };
    } finally {
        // Cleanup temp directory
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    }
}

test.describe('Export', () => {

    test('Export button', async ({ page }) => {
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Click Export button
        await page.getByRole('button', { name: 'Export to Excel' }).click();

        await expect(page.getByText('Data Export Warning : Acknowledgment Required')).toBeVisible();
    });

    test('Export confirmation', async ({ page }) => {
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Click Export button
        await page.getByRole('button', { name: 'Export to Excel' }).click();

        // Cancel export
        await page.getByRole('button', { name: 'No' }).click();
        await expect(page.locator('table')).toBeVisible();
        console.log('✅ Export cancelled successfully');
    });

    test('Export button state', async ({ page }) => {
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        const exportButton = page.getByRole('button', { name: 'Export to Excel' });

        // Initially export button should be enabled (has data)
        await expect(exportButton).toBeEnabled();
        console.log('✅ Export button enabled with data');

        // Filter with non-existent data
        const filterDropdown = page.getByRole('combobox');
        await filterDropdown.selectOption('vespisti_code');
        await page.waitForTimeout(500);

        // Search for non-existent ID
        const searchInput = page.locator('input[type="text"]').first();
        await searchInput.fill('VPTEST');
        await page.getByRole('button', { name: /search/i }).click();
        await page.waitForTimeout(1000);

        // Verify "No Data Found" message
        await expect(page.getByText(/No Data Found|ไม่พบข้อมูล/i)).toBeVisible();
        console.log('✅ No Data Found message displayed');

        // Export button should be disabled when no results
        await expect(exportButton).toBeDisabled();
        console.log('✅ Export button disabled when no data');

        // Clear filter
        await page.getByRole('button', { name: /clear/i }).click();
        await page.waitForTimeout(1000);

        // Verify data is back and export button is enabled again
        await expect(page.locator('tbody tr').first()).toBeVisible();
        await expect(exportButton).toBeEnabled();
        console.log('✅ Export button enabled again after clearing filter');
    });

    test('Export filtered by Vespisti ID', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Download event not reliable on Firefox/WebKit');
        test.slow(); // Allow 90s for download
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Select filter type
        const filterDropdown = page.getByRole('combobox');
        await filterDropdown.selectOption('vespisti_code');
        await page.waitForTimeout(500);

        // Get random Vespisti ID from active users
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();

        const activeUserIds: string[] = [];
        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const deletedDate = await row.locator('td:nth-child(7)').textContent();
            const vespistiId = await row.locator('.text-theme-xs.text-gray-500').textContent();

            if (vespistiId && (!deletedDate?.trim() || deletedDate.trim() === '-')) {
                activeUserIds.push(vespistiId.trim());
            }
        }

        expect(activeUserIds.length).toBeGreaterThan(0);
        const randomId = activeUserIds[Math.floor(Math.random() * activeUserIds.length)];
        console.log(`🔍 Filtering by Vespisti ID: ${randomId}`);

        // Enter search term and search
        const searchInput = page.locator('input[type="text"]').first();
        await searchInput.fill(randomId);
        await page.getByRole('button', { name: /search/i }).click();
        await page.waitForTimeout(1000);

        // Verify filtered results
        const filteredCount = await page.locator('tbody tr').count();
        expect(filteredCount).toBeGreaterThan(0);
        console.log(`📋 Filtered results: ${filteredCount}`);

        // Verify UI data matches filter and collect for comparison
        const uiVespistiIds: string[] = [];
        const filteredRows = page.locator('tbody tr');
        for (let i = 0; i < filteredCount; i++) {
            const row = filteredRows.nth(i);
            const vespistiId = await row.locator('.text-theme-xs.text-gray-500').textContent();
            expect(vespistiId?.includes(randomId), `UI Vespisti ID should contain "${randomId}", got: "${vespistiId}"`).toBe(true);
            if (vespistiId) uiVespistiIds.push(vespistiId.trim());
        }
        console.log(`✅ UI verification passed: ${uiVespistiIds.length} rows match filter`);

        // Export filtered data with retry on timeout
        await page.getByRole('button', { name: 'Export to Excel' }).click();
        await expect(page.getByText('Data Export Warning')).toBeVisible();

        const download = await downloadWithRetry(page, MAX_DOWNLOAD_RETRIES, async () => {
            // Re-apply Vespisti ID filter
            const filterDropdown = page.getByRole('combobox');
            await filterDropdown.selectOption('vespisti_code');
            await page.waitForTimeout(500);
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill(randomId);
            await page.getByRole('button', { name: /search/i }).click();
        });

        const fileName = download.suggestedFilename();
        expect(fileName).toMatch(/^vespistiid-customer_export_\d{4}-\d{2}-\d{2}\.zip$/);

        // Verify Excel data matches filter
        const zipFilePath = await download.path();
        expect(zipFilePath).toBeTruthy();
        const { data } = await extractAndReadExcel(zipFilePath!);

        // Verify Excel has data
        expect(data.length).toBeGreaterThan(0);
        console.log(`📊 Excel rows: ${data.length}`);

        // Verify all Excel rows contain the filtered Vespisti ID
        for (const row of data) {
            const excelVespistiId = row['Vespisti ID']?.toString() || '';
            expect(excelVespistiId.includes(randomId), `Excel Vespisti ID should contain "${randomId}", got: "${excelVespistiId}"`).toBe(true);
        }

        // Verify UI data exists in Excel (first page comparison)
        for (const uiId of uiVespistiIds) {
            const foundInExcel = data.some(row => row['Vespisti ID']?.toString() === uiId);
            expect(foundInExcel, `UI Vespisti ID "${uiId}" should exist in Excel`).toBe(true);
        }
        console.log(`✅ All ${data.length} Excel rows match filter: ${randomId}`);
        console.log(`✅ All ${uiVespistiIds.length} UI rows found in Excel`);
    });

    test('Export filtered by Name / Last Name', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Download event not reliable on Firefox/WebKit');
        test.slow(); // Allow 90s for download
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Select filter type
        const filterDropdown = page.getByRole('combobox');
        await filterDropdown.selectOption('name');
        await page.waitForTimeout(500);

        // Get random name from active users
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();

        const activeUserNames: string[] = [];
        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const deletedDate = await row.locator('td:nth-child(7)').textContent();
            const nameElement = await row.locator('.text-theme-sm.font-medium').textContent();

            if (nameElement && (!deletedDate?.trim() || deletedDate.trim() === '-')) {
                // Get first name (before space)
                const firstName = nameElement.trim().split(' ')[0];
                if (firstName && firstName.length >= 3) {
                    activeUserNames.push(firstName.substring(0, 3));
                }
            }
        }

        expect(activeUserNames.length).toBeGreaterThan(0);
        const searchTerm = activeUserNames[Math.floor(Math.random() * activeUserNames.length)];
        console.log(`🔍 Filtering by Name: ${searchTerm}`);

        // Enter search term and search
        const searchInput = page.locator('input[type="text"]').first();
        await searchInput.fill(searchTerm);
        await page.getByRole('button', { name: /search/i }).click();
        await page.waitForTimeout(1000);

        // Verify filtered results
        const filteredCount = await page.locator('tbody tr').count();
        expect(filteredCount).toBeGreaterThan(0);
        console.log(`📋 Filtered results: ${filteredCount}`);

        // Verify UI data matches filter and collect for comparison
        const searchTermLower = searchTerm.toLowerCase();
        const uiNames: { vespistiId: string; name: string }[] = [];
        const filteredRows = page.locator('tbody tr');
        for (let i = 0; i < filteredCount; i++) {
            const row = filteredRows.nth(i);
            const nameText = await row.locator('.text-theme-sm.font-medium').textContent();
            const vespistiId = await row.locator('.text-theme-xs.text-gray-500').textContent();
            // Name is masked: First Name + 3 chars of Last Name + ***
            // Just verify the visible part contains the search term
            expect(nameText?.toLowerCase().includes(searchTermLower), `UI Name should contain "${searchTerm}", got: "${nameText}"`).toBe(true);
            if (vespistiId) uiNames.push({ vespistiId: vespistiId.trim(), name: nameText?.trim() || '' });
        }
        console.log(`✅ UI verification passed: ${uiNames.length} rows match filter`);

        // Export filtered data with retry on timeout
        await page.getByRole('button', { name: 'Export to Excel' }).click();
        await expect(page.getByText('Data Export Warning')).toBeVisible();

        const download = await downloadWithRetry(page, MAX_DOWNLOAD_RETRIES, async () => {
            // Re-apply Name filter
            const filterDropdown = page.getByRole('combobox');
            await filterDropdown.selectOption('name');
            await page.waitForTimeout(500);
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill(searchTerm);
            await page.getByRole('button', { name: /search/i }).click();
        });

        const fileName = download.suggestedFilename();
        expect(fileName).toMatch(/^vespistiid-customer_export_\d{4}-\d{2}-\d{2}\.zip$/);

        // Verify Excel data matches filter
        const zipFilePath = await download.path();
        expect(zipFilePath).toBeTruthy();
        const { data } = await extractAndReadExcel(zipFilePath!);

        // Verify Excel has data
        expect(data.length).toBeGreaterThan(0);
        console.log(`📊 Excel rows: ${data.length}`);

        // Verify all Excel rows contain the search term in First Name or Last Name
        for (const row of data) {
            const firstName = (row['First Name']?.toString() || '').toLowerCase();
            const lastName = (row['Last Name']?.toString() || '').toLowerCase();
            const matchesFilter = firstName.includes(searchTermLower) || lastName.includes(searchTermLower);
            expect(matchesFilter, `Excel Name should contain "${searchTerm}", got First: "${firstName}", Last: "${lastName}"`).toBe(true);
        }

        // Verify UI data exists in Excel (first page comparison)
        for (const uiRow of uiNames) {
            const foundInExcel = data.some(row => row['Vespisti ID']?.toString() === uiRow.vespistiId);
            expect(foundInExcel, `UI Vespisti ID "${uiRow.vespistiId}" should exist in Excel`).toBe(true);
        }
        console.log(`✅ All ${data.length} Excel rows match filter: ${searchTerm}`);
        console.log(`✅ All ${uiNames.length} UI rows found in Excel`);
    });

    test('Export filtered by Email', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Download event not reliable on Firefox/WebKit');
        test.slow(); // Allow 90s for download
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Select filter type
        const filterDropdown = page.getByRole('combobox');
        await filterDropdown.selectOption('email');
        await page.waitForTimeout(500);

        // Get random email from active users
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();

        const activeUserEmails: string[] = [];
        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const deletedDate = await row.locator('td:nth-child(7)').textContent();
            const email = await row.locator('td:nth-child(2)').textContent();

            if (email?.trim() && email.includes('@') && (!deletedDate?.trim() || deletedDate.trim() === '-')) {
                // Get visible part before asterisks
                const emailLocal = email.split('@')[0];
                const visibleChars = emailLocal.replace(/\*/g, '');
                if (visibleChars.length >= 3) {
                    activeUserEmails.push(visibleChars.substring(0, 3));
                }
            }
        }

        expect(activeUserEmails.length).toBeGreaterThan(0);
        const searchTerm = activeUserEmails[Math.floor(Math.random() * activeUserEmails.length)];
        console.log(`🔍 Filtering by Email: ${searchTerm}`);

        // Enter search term and search
        const searchInput = page.locator('input[type="text"]').first();
        await searchInput.fill(searchTerm);
        await page.getByRole('button', { name: /search/i }).click();
        await page.waitForTimeout(1000);

        // Verify filtered results
        const filteredCount = await page.locator('tbody tr').count();
        expect(filteredCount).toBeGreaterThan(0);
        console.log(`📋 Filtered results: ${filteredCount}`);

        // Verify UI data matches filter and collect for comparison
        const searchTermLower = searchTerm.toLowerCase();
        const uiEmails: { vespistiId: string; email: string }[] = [];
        const filteredRows = page.locator('tbody tr');
        for (let i = 0; i < filteredCount; i++) {
            const row = filteredRows.nth(i);
            const emailText = await row.locator('td:nth-child(2)').textContent();
            const vespistiId = await row.locator('.text-theme-xs.text-gray-500').textContent();
            // Email is masked but visible part should contain search term
            const emailLocal = emailText?.split('@')[0]?.replace(/\*/g, '').toLowerCase() || '';
            expect(emailLocal.includes(searchTermLower), `UI Email should contain "${searchTerm}", got: "${emailText}"`).toBe(true);
            if (vespistiId) uiEmails.push({ vespistiId: vespistiId.trim(), email: emailText?.trim() || '' });
        }
        console.log(`✅ UI verification passed: ${uiEmails.length} rows match filter`);

        // Export filtered data with retry on timeout
        await page.getByRole('button', { name: 'Export to Excel' }).click();
        await expect(page.getByText('Data Export Warning')).toBeVisible();

        const download = await downloadWithRetry(page, MAX_DOWNLOAD_RETRIES, async () => {
            // Re-apply Email filter
            const filterDropdown = page.getByRole('combobox');
            await filterDropdown.selectOption('email');
            await page.waitForTimeout(500);
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill(searchTerm);
            await page.getByRole('button', { name: /search/i }).click();
        });

        const fileName = download.suggestedFilename();
        expect(fileName).toMatch(/^vespistiid-customer_export_\d{4}-\d{2}-\d{2}\.zip$/);

        // Verify Excel data matches filter
        const zipFilePath = await download.path();
        expect(zipFilePath).toBeTruthy();
        const { data } = await extractAndReadExcel(zipFilePath!);

        // Verify Excel has data
        expect(data.length).toBeGreaterThan(0);
        console.log(`📊 Excel rows: ${data.length}`);

        // Verify all Excel rows contain the search term in Email
        for (const row of data) {
            const email = (row['Email']?.toString() || '').toLowerCase();
            expect(email.includes(searchTermLower), `Excel Email should contain "${searchTerm}", got: "${email}"`).toBe(true);
        }

        // Verify UI data exists in Excel (first page comparison)
        for (const uiRow of uiEmails) {
            const foundInExcel = data.some(row => row['Vespisti ID']?.toString() === uiRow.vespistiId);
            expect(foundInExcel, `UI Vespisti ID "${uiRow.vespistiId}" should exist in Excel`).toBe(true);
        }
        console.log(`✅ All ${data.length} Excel rows match filter: ${searchTerm}`);
        console.log(`✅ All ${uiEmails.length} UI rows found in Excel`);
    });

    test('Export filtered by Phone', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Download event not reliable on Firefox/WebKit');
        test.slow(); // Allow 90s for download
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Select filter type
        const filterDropdown = page.getByRole('combobox');
        await filterDropdown.selectOption('phone');
        await page.waitForTimeout(500);

        // Get random phone from active users
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();

        const activeUserPhones: string[] = [];
        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const deletedDate = await row.locator('td:nth-child(7)').textContent();
            const phoneText = await row.locator('td:nth-child(3)').textContent();

            if (phoneText && (!deletedDate?.trim() || deletedDate.trim() === '-')) {
                const phoneDigits = phoneText.replace(/\*/g, '').replace(/[^0-9]/g, '').substring(0, 6);
                if (phoneDigits.length === 6) {
                    activeUserPhones.push(phoneDigits);
                }
            }
        }

        expect(activeUserPhones.length).toBeGreaterThan(0);
        const searchTerm = activeUserPhones[Math.floor(Math.random() * activeUserPhones.length)];
        console.log(`🔍 Filtering by Phone: ${searchTerm}`);

        // Enter search term and search
        const searchInput = page.locator('input[type="text"]').first();
        await searchInput.fill(searchTerm);
        await page.getByRole('button', { name: /search/i }).click();
        await page.waitForTimeout(1000);

        // Verify filtered results
        const filteredCount = await page.locator('tbody tr').count();
        expect(filteredCount).toBeGreaterThan(0);
        console.log(`📋 Filtered results: ${filteredCount}`);

        // Verify UI data matches filter and collect for comparison
        const uiPhones: { vespistiId: string; phone: string }[] = [];
        const filteredRows = page.locator('tbody tr');
        for (let i = 0; i < filteredCount; i++) {
            const row = filteredRows.nth(i);
            const phoneText = await row.locator('td:nth-child(3)').textContent();
            const vespistiId = await row.locator('.text-theme-xs.text-gray-500').textContent();
            // Phone is masked: 6 digits + ****
            const phoneDigits = phoneText?.replace(/\*/g, '').replace(/[^0-9]/g, '') || '';
            expect(phoneDigits.includes(searchTerm), `UI Phone should contain "${searchTerm}", got: "${phoneText}"`).toBe(true);
            if (vespistiId) uiPhones.push({ vespistiId: vespistiId.trim(), phone: phoneText?.trim() || '' });
        }
        console.log(`✅ UI verification passed: ${uiPhones.length} rows match filter`);

        // Export filtered data with retry on timeout
        await page.getByRole('button', { name: 'Export to Excel' }).click();
        await expect(page.getByText('Data Export Warning')).toBeVisible();

        const download = await downloadWithRetry(page, MAX_DOWNLOAD_RETRIES, async () => {
            // Re-apply Phone filter
            const filterDropdown = page.getByRole('combobox');
            await filterDropdown.selectOption('phone');
            await page.waitForTimeout(500);
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill(searchTerm);
            await page.getByRole('button', { name: /search/i }).click();
        });

        const fileName = download.suggestedFilename();
        expect(fileName).toMatch(/^vespistiid-customer_export_\d{4}-\d{2}-\d{2}\.zip$/);

        // Verify Excel data matches filter
        const zipFilePath = await download.path();
        expect(zipFilePath).toBeTruthy();
        const { data } = await extractAndReadExcel(zipFilePath!);

        // Verify Excel has data
        expect(data.length).toBeGreaterThan(0);
        console.log(`📊 Excel rows: ${data.length}`);

        // Verify all Excel rows contain the search term in Phone
        for (const row of data) {
            const phone = (row['Phone']?.toString() || '').replace(/[^0-9]/g, '');
            expect(phone.includes(searchTerm), `Excel Phone should contain "${searchTerm}", got: "${phone}"`).toBe(true);
        }

        // Verify UI data exists in Excel (first page comparison)
        for (const uiRow of uiPhones) {
            const foundInExcel = data.some(row => row['Vespisti ID']?.toString() === uiRow.vespistiId);
            expect(foundInExcel, `UI Vespisti ID "${uiRow.vespistiId}" should exist in Excel`).toBe(true);
        }
        console.log(`✅ All ${data.length} Excel rows match filter: ${searchTerm}`);
        console.log(`✅ All ${uiPhones.length} UI rows found in Excel`);
    });

    test('Export filtered by Gender', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Download event not reliable on Firefox/WebKit');
        test.slow(); // Allow 90s for download
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Select filter type first to show gender dropdown
        const filterDropdown = page.locator('select').first();
        await filterDropdown.selectOption('gender');
        await page.waitForTimeout(500);

        // Get available options from gender dropdown (value and label)
        const genderDropdown = page.locator('select').nth(1);
        const optionElements = genderDropdown.locator('option');
        const optionCount = await optionElements.count();

        const genderOptions: { value: string; label: string }[] = [];
        for (let i = 0; i < optionCount; i++) {
            const option = optionElements.nth(i);
            const value = await option.getAttribute('value') || '';
            const label = await option.textContent() || '';
            if (value.toLowerCase() === 'male' || value.toLowerCase() === 'female') {
                genderOptions.push({ value, label: label.trim() });
            }
        }
        console.log(`📋 Available gender options: ${genderOptions.map(o => `${o.label}(${o.value})`).join(', ')}`);
        expect(genderOptions.length).toBeGreaterThan(0);

        const selectedOption = genderOptions[Math.floor(Math.random() * genderOptions.length)];
        console.log(`🔍 Filtering by Gender: ${selectedOption.label} (value: ${selectedOption.value})`);

        // Select gender using value attribute (lowercase: male/female)
        await genderDropdown.selectOption(selectedOption.value);

        // Search
        await page.getByRole('button', { name: /search/i }).click();
        await page.waitForTimeout(1000);

        // Verify filtered results
        const filteredCount = await page.locator('tbody tr').count();
        expect(filteredCount).toBeGreaterThan(0);
        console.log(`📋 Filtered ${selectedOption.label} results: ${filteredCount}`);

        // Verify UI data matches filter and collect for comparison
        const expectedGender = selectedOption.value.toLowerCase();
        const uiGenders: { vespistiId: string; gender: string }[] = [];
        const filteredRows = page.locator('tbody tr');
        for (let i = 0; i < filteredCount; i++) {
            const row = filteredRows.nth(i);
            const genderText = await row.locator('td:nth-child(4)').textContent();
            const vespistiId = await row.locator('.text-theme-xs.text-gray-500').textContent();
            expect(genderText?.toLowerCase().trim(), `UI Gender should be "${expectedGender}", got: "${genderText}"`).toBe(expectedGender);
            if (vespistiId) uiGenders.push({ vespistiId: vespistiId.trim(), gender: genderText?.trim() || '' });
        }
        console.log(`✅ UI verification passed: ${uiGenders.length} rows match filter`);

        // Export filtered data with retry on timeout
        await page.getByRole('button', { name: 'Export to Excel' }).click();
        await expect(page.getByText('Data Export Warning')).toBeVisible();

        const download = await downloadWithRetry(page, MAX_DOWNLOAD_RETRIES, async () => {
            // Re-apply Gender filter
            const filterDropdown = page.locator('select').first();
            await filterDropdown.selectOption('gender');
            await page.waitForTimeout(500);
            const genderDropdown = page.locator('select').nth(1);
            await genderDropdown.selectOption(selectedOption.value);
            await page.getByRole('button', { name: /search/i }).click();
        });

        const fileName = download.suggestedFilename();
        expect(fileName).toMatch(/^vespistiid-customer_export_\d{4}-\d{2}-\d{2}\.zip$/);

        // Verify Excel data matches filter
        const zipFilePath = await download.path();
        expect(zipFilePath).toBeTruthy();
        const { data } = await extractAndReadExcel(zipFilePath!);

        // Verify Excel has data
        expect(data.length).toBeGreaterThan(0);
        console.log(`📊 Excel rows: ${data.length}`);

        // Verify all Excel rows have matching Gender
        for (const row of data) {
            const gender = (row['Gender']?.toString() || '').toLowerCase();
            expect(gender, `Excel Gender should be "${expectedGender}", got: "${gender}"`).toBe(expectedGender);
        }

        // Verify UI data exists in Excel (first page comparison)
        for (const uiRow of uiGenders) {
            const foundInExcel = data.some(row => row['Vespisti ID']?.toString() === uiRow.vespistiId);
            expect(foundInExcel, `UI Vespisti ID "${uiRow.vespistiId}" should exist in Excel`).toBe(true);
        }
        console.log(`✅ All ${data.length} Excel rows match filter: ${selectedOption.label}`);
        console.log(`✅ All ${uiGenders.length} UI rows found in Excel`);
    });

    test('Export filtered by Date of Birth', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Download event not reliable on Firefox/WebKit');
        test.slow(); // Allow 90s for download
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Collect birth years from active users
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();
        const birthDates: { year: number, month: number }[] = [];

        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const deletedDate = await row.locator('td:nth-child(7)').textContent();
            const dobText = await row.locator('td:nth-child(5)').textContent();

            if (dobText && (!deletedDate?.trim() || deletedDate.trim() === '-')) {
                const match = dobText.match(/\*\*\/(\d{2})\/(\d{4})/);
                if (match) {
                    birthDates.push({ month: parseInt(match[1]), year: parseInt(match[2]) });
                }
            }
        }

        expect(birthDates.length).toBeGreaterThan(0);
        const randomBirth = birthDates[Math.floor(Math.random() * birthDates.length)];
        console.log(`🔍 Filtering by Birth Month: ${randomBirth.month}, Year: ${randomBirth.year}`);

        // Select filter type
        const filterDropdown = page.locator('select').first();
        await filterDropdown.selectOption('birth_year_range');
        await page.waitForTimeout(500);

        // Select year range
        const fromYearDropdown = page.locator('select').nth(1);
        await fromYearDropdown.selectOption(randomBirth.year.toString());

        const toYearDropdown = page.locator('select').nth(2);
        await toYearDropdown.selectOption(randomBirth.year.toString());

        const monthDropdown = page.locator('select').nth(3);
        await monthDropdown.selectOption(randomBirth.month.toString());

        // Search
        await page.getByRole('button', { name: /search/i }).click();
        await page.waitForTimeout(1000);

        // Verify filtered results
        const filteredCount = await page.locator('tbody tr').count();
        expect(filteredCount).toBeGreaterThan(0);
        console.log(`📋 Filtered DOB results: ${filteredCount}`);

        // Verify UI data matches filter and collect for comparison
        const uiDobs: { vespistiId: string; dob: string }[] = [];
        const filteredRows = page.locator('tbody tr');
        for (let i = 0; i < filteredCount; i++) {
            const row = filteredRows.nth(i);
            const dobText = await row.locator('td:nth-child(5)').textContent();
            const vespistiId = await row.locator('.text-theme-xs.text-gray-500').textContent();
            // DOB is masked: **/mm/yyyy
            const dobMatch = dobText?.match(/\*\*\/(\d{2})\/(\d{4})/);
            if (dobMatch) {
                const uiMonth = parseInt(dobMatch[1]);
                const uiYear = parseInt(dobMatch[2]);
                expect(uiMonth, `UI DOB month should be ${randomBirth.month}, got: ${uiMonth}`).toBe(randomBirth.month);
                expect(uiYear, `UI DOB year should be ${randomBirth.year}, got: ${uiYear}`).toBe(randomBirth.year);
            }
            if (vespistiId) uiDobs.push({ vespistiId: vespistiId.trim(), dob: dobText?.trim() || '' });
        }
        console.log(`✅ UI verification passed: ${uiDobs.length} rows match filter`);

        // Export filtered data with retry on timeout
        await page.getByRole('button', { name: 'Export to Excel' }).click();
        await expect(page.getByText('Data Export Warning')).toBeVisible();

        const download = await downloadWithRetry(page, MAX_DOWNLOAD_RETRIES, async () => {
            // Re-apply DOB filter
            const filterDropdown = page.locator('select').first();
            await filterDropdown.selectOption('birth_year_range');
            await page.waitForTimeout(500);
            const fromYearDropdown = page.locator('select').nth(1);
            await fromYearDropdown.selectOption(randomBirth.year.toString());
            const toYearDropdown = page.locator('select').nth(2);
            await toYearDropdown.selectOption(randomBirth.year.toString());
            const monthDropdown = page.locator('select').nth(3);
            await monthDropdown.selectOption(randomBirth.month.toString());
            await page.getByRole('button', { name: /search/i }).click();
        });

        const fileName = download.suggestedFilename();
        expect(fileName).toMatch(/^vespistiid-customer_export_\d{4}-\d{2}-\d{2}\.zip$/);

        // Verify Excel data matches filter
        const zipFilePath = await download.path();
        expect(zipFilePath).toBeTruthy();
        const { data } = await extractAndReadExcel(zipFilePath!);

        // Verify Excel has data
        expect(data.length).toBeGreaterThan(0);
        console.log(`📊 Excel rows: ${data.length}`);

        // Verify all Excel rows have matching Date of Birth
        for (const row of data) {
            const dob = row['Date of Birth']?.toString() || '';
            const dobMatch = dob.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            expect(dobMatch, `Excel Date of Birth should be in DD/MM/YYYY format, got: "${dob}"`).toBeTruthy();

            if (dobMatch) {
                const month = parseInt(dobMatch[2]);
                const year = parseInt(dobMatch[3]);
                expect(month, `Excel DOB month should be ${randomBirth.month}, got: ${month}`).toBe(randomBirth.month);
                expect(year, `Excel DOB year should be ${randomBirth.year}, got: ${year}`).toBe(randomBirth.year);
            }
        }

        // Verify UI data exists in Excel (first page comparison)
        for (const uiRow of uiDobs) {
            const foundInExcel = data.some(row => row['Vespisti ID']?.toString() === uiRow.vespistiId);
            expect(foundInExcel, `UI Vespisti ID "${uiRow.vespistiId}" should exist in Excel`).toBe(true);
        }
        console.log(`✅ All ${data.length} Excel rows match DOB filter: month=${randomBirth.month}, year=${randomBirth.year}`);
        console.log(`✅ All ${uiDobs.length} UI rows found in Excel`);
    });

    test('Export filtered by Created Date', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Download event not reliable on Firefox/WebKit');
        test.slow(); // Allow 90s for download
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Collect created dates from active users
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();
        const createdDates: string[] = [];

        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const deletedDate = await row.locator('td:nth-child(7)').textContent();
            const createdDateText = await row.locator('td:nth-child(6)').textContent();

            if (createdDateText && (!deletedDate?.trim() || deletedDate.trim() === '-')) {
                const date = createdDateText.trim();
                if (date.match(/\d{2}\/\d{2}\/\d{4}/)) {
                    createdDates.push(date);
                }
            }
        }

        expect(createdDates.length).toBeGreaterThan(0);

        // Sort and select random date range
        const sortedDates = createdDates.map(d => {
            const [day, month, year] = d.split('/');
            return { dateStr: d, dateObj: new Date(parseInt(year), parseInt(month) - 1, parseInt(day)) };
        }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

        const startIndex = Math.floor(Math.random() * Math.max(1, sortedDates.length - 1));
        const fromDate = sortedDates[startIndex].dateStr;
        const toDate = sortedDates[Math.min(startIndex + 1, sortedDates.length - 1)].dateStr;

        const [fromDay, fromMonth, fromYear] = fromDate.split('/');
        const [toDay, toMonth, toYear] = toDate.split('/');

        console.log(`🔍 Filtering by Created Date: ${fromDate} to ${toDate}`);

        // Select filter type
        const filterDropdown = page.locator('select').first();
        await filterDropdown.selectOption('created_at');
        await page.waitForTimeout(500);

        // Open date picker
        const dateInput = page.locator('input#created-at-filter');
        await dateInput.click();
        await page.waitForSelector('.flatpickr-calendar.open', { timeout: 3000 });

        // Set date range
        await page.evaluate(({ fromDay, fromMonth, fromYear, toDay, toMonth, toYear }) => {
            const fp = (document.querySelector('input#created-at-filter') as any)?._flatpickr;
            if (fp) {
                fp.setDate([`${fromDay}/${fromMonth}/${fromYear}`, `${toDay}/${toMonth}/${toYear}`], true, 'd/m/Y');
            }
        }, { fromDay, fromMonth, fromYear, toDay, toMonth, toYear });

        await page.waitForTimeout(500);

        // Search
        await page.getByRole('button', { name: /search/i }).click();
        await page.waitForTimeout(1000);

        // Verify filtered results
        const filteredCount = await page.locator('tbody tr').count();
        expect(filteredCount).toBeGreaterThan(0);
        console.log(`📋 Filtered Created Date results: ${filteredCount}`);

        // Verify UI data matches filter and collect for comparison
        const filterFromDate = new Date(parseInt(fromYear), parseInt(fromMonth) - 1, parseInt(fromDay));
        const filterToDate = new Date(parseInt(toYear), parseInt(toMonth) - 1, parseInt(toDay));
        const uiCreatedDates: { vespistiId: string; createdAt: string }[] = [];
        const filteredRows = page.locator('tbody tr');
        for (let i = 0; i < filteredCount; i++) {
            const row = filteredRows.nth(i);
            const createdAtText = await row.locator('td:nth-child(6)').textContent();
            const vespistiId = await row.locator('.text-theme-xs.text-gray-500').textContent();
            const dateMatch = createdAtText?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (dateMatch) {
                const rowDate = new Date(parseInt(dateMatch[3]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));
                expect(
                    rowDate >= filterFromDate && rowDate <= filterToDate,
                    `UI Created At "${createdAtText}" should be between ${fromDate} and ${toDate}`
                ).toBe(true);
            }
            if (vespistiId) uiCreatedDates.push({ vespistiId: vespistiId.trim(), createdAt: createdAtText?.trim() || '' });
        }
        console.log(`✅ UI verification passed: ${uiCreatedDates.length} rows match filter`);

        // Export filtered data with retry on timeout
        await page.getByRole('button', { name: 'Export to Excel' }).click();
        await expect(page.getByText('Data Export Warning')).toBeVisible();

        const download = await downloadWithRetry(page, MAX_DOWNLOAD_RETRIES, async () => {
            // Re-apply Created Date filter
            const filterDropdown = page.locator('select').first();
            await filterDropdown.selectOption('created_at');
            await page.waitForTimeout(500);
            const dateInput = page.locator('input#created-at-filter');
            await dateInput.click();
            await page.waitForSelector('.flatpickr-calendar.open', { timeout: 3000 });
            await page.evaluate(({ fromDay, fromMonth, fromYear, toDay, toMonth, toYear }) => {
                const fp = (document.querySelector('input#created-at-filter') as any)?._flatpickr;
                if (fp) {
                    fp.setDate([`${fromDay}/${fromMonth}/${fromYear}`, `${toDay}/${toMonth}/${toYear}`], true, 'd/m/Y');
                }
            }, { fromDay, fromMonth, fromYear, toDay, toMonth, toYear });
            await page.waitForTimeout(500);
            await page.getByRole('button', { name: /search/i }).click();
        });

        const fileName = download.suggestedFilename();
        expect(fileName).toMatch(/^vespistiid-customer_export_\d{4}-\d{2}-\d{2}\.zip$/);

        // Verify Excel data matches filter
        const zipFilePath = await download.path();
        expect(zipFilePath).toBeTruthy();
        const { data } = await extractAndReadExcel(zipFilePath!);

        // Verify Excel has data
        expect(data.length).toBeGreaterThan(0);
        console.log(`📊 Excel rows: ${data.length}`);

        // Verify all Excel rows have Created At within filter range
        for (const row of data) {
            const createdAt = row['Created At']?.toString() || '';
            const dateMatch = createdAt.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            expect(dateMatch, `Excel Created At should be in DD/MM/YYYY format, got: "${createdAt}"`).toBeTruthy();

            if (dateMatch) {
                const rowDate = new Date(parseInt(dateMatch[3]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));
                expect(
                    rowDate >= filterFromDate && rowDate <= filterToDate,
                    `Excel Created At "${createdAt}" should be between ${fromDate} and ${toDate}`
                ).toBe(true);
            }
        }

        // Verify UI data exists in Excel (first page comparison)
        for (const uiRow of uiCreatedDates) {
            const foundInExcel = data.some(row => row['Vespisti ID']?.toString() === uiRow.vespistiId);
            expect(foundInExcel, `UI Vespisti ID "${uiRow.vespistiId}" should exist in Excel`).toBe(true);
        }
        console.log(`✅ All ${data.length} Excel rows match Created Date filter: ${fromDate} to ${toDate}`);
        console.log(`✅ All ${uiCreatedDates.length} UI rows found in Excel`);
    });

    test('Export filtered by Deleted Date', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Download event not reliable on Firefox/WebKit');
        test.slow(); // Allow 90s for download
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Sort by Deleted Date to bring deleted accounts to top
        // Default is Created Date DESC, so one click will sort by Deleted Date DESC
        const deletedDateHeader = page.getByRole('columnheader', { name: /Deleted Date/i });
        await deletedDateHeader.click();
        await page.waitForTimeout(500);

        // Collect deleted dates from sorted results
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();
        const deletedDates: string[] = [];

        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const deletedDateText = await row.locator('td:nth-child(7)').textContent();

            if (deletedDateText && deletedDateText.trim() !== '' && deletedDateText.trim() !== '-') {
                const date = deletedDateText.trim();
                if (date.match(/\d{2}\/\d{2}\/\d{4}/)) {
                    deletedDates.push(date);
                }
            }
        }

        // Skip test if no deleted accounts exist
        if (deletedDates.length === 0) {
            console.log('⚠️ No deleted accounts found in system - skipping test');
            test.skip();
            return;
        }

        console.log(`📋 Found ${deletedDates.length} deleted accounts`);

        // Sort and select date range from found results
        const sortedDates = deletedDates.map(d => {
            const [day, month, year] = d.split('/');
            return { dateStr: d, dateObj: new Date(parseInt(year), parseInt(month) - 1, parseInt(day)) };
        }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

        // Use the first and last date from found results
        const fromDate = sortedDates[0].dateStr;
        const toDate = sortedDates[sortedDates.length - 1].dateStr;

        const [fromDay, fromMonth, fromYear] = fromDate.split('/');
        const [toDay, toMonth, toYear] = toDate.split('/');

        console.log(`🔍 Filtering by Deleted Date: ${fromDate} to ${toDate}`);

        // Apply deleted_at filter
        const filterDropdown = page.locator('select').first();
        await filterDropdown.selectOption('deleted_at');
        await page.waitForTimeout(500);

        // Open date picker
        const dateInput = page.locator('input.flatpickr-input').first();
        await dateInput.click();
        await page.waitForSelector('.flatpickr-calendar.open', { timeout: 3000 });

        // Set date range
        await page.evaluate(({ fromDay, fromMonth, fromYear, toDay, toMonth, toYear }) => {
            const inputs = document.querySelectorAll('input.flatpickr-input');
            for (const input of inputs) {
                const fp = (input as any)?._flatpickr;
                if (fp && fp.isOpen) {
                    fp.setDate([`${fromDay}/${fromMonth}/${fromYear}`, `${toDay}/${toMonth}/${toYear}`], true, 'd/m/Y');
                    break;
                }
            }
        }, { fromDay, fromMonth, fromYear, toDay, toMonth, toYear });

        await page.waitForTimeout(500);

        // Search
        await page.getByRole('button', { name: /search/i }).click();
        await page.waitForTimeout(1000);

        // Verify filtered results
        const filteredCount = await page.locator('tbody tr').count();
        expect(filteredCount).toBeGreaterThan(0);
        console.log(`📋 Filtered Deleted Date results: ${filteredCount}`);

        // Verify UI data matches filter and collect for comparison
        const filterFromDate = new Date(parseInt(fromYear), parseInt(fromMonth) - 1, parseInt(fromDay));
        const filterToDate = new Date(parseInt(toYear), parseInt(toMonth) - 1, parseInt(toDay));
        const uiDeletedDates: { vespistiId: string; deletedAt: string }[] = [];
        const filteredRows = page.locator('tbody tr');
        for (let i = 0; i < filteredCount; i++) {
            const row = filteredRows.nth(i);
            const deletedAtText = await row.locator('td:nth-child(7)').textContent();
            const vespistiId = await row.locator('.text-theme-xs.text-gray-500').textContent();
            const dateMatch = deletedAtText?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (dateMatch) {
                const rowDate = new Date(parseInt(dateMatch[3]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));
                expect(
                    rowDate >= filterFromDate && rowDate <= filterToDate,
                    `UI Deleted At "${deletedAtText}" should be between ${fromDate} and ${toDate}`
                ).toBe(true);
            }
            if (vespistiId) uiDeletedDates.push({ vespistiId: vespistiId.trim(), deletedAt: deletedAtText?.trim() || '' });
        }
        console.log(`✅ UI verification passed: ${uiDeletedDates.length} rows match filter`);

        // Export filtered data with retry on timeout
        await page.getByRole('button', { name: 'Export to Excel' }).click();
        await expect(page.getByText('Data Export Warning')).toBeVisible();

        const download = await downloadWithRetry(page, MAX_DOWNLOAD_RETRIES, async () => {
            // Re-apply Deleted Date filter
            const filterDropdown = page.locator('select').first();
            await filterDropdown.selectOption('deleted_at');
            await page.waitForTimeout(500);
            const dateInput = page.locator('input.flatpickr-input').first();
            await dateInput.click();
            await page.waitForSelector('.flatpickr-calendar.open', { timeout: 3000 });
            await page.evaluate(({ fromDay, fromMonth, fromYear, toDay, toMonth, toYear }) => {
                const inputs = document.querySelectorAll('input.flatpickr-input');
                for (const input of inputs) {
                    const fp = (input as any)?._flatpickr;
                    if (fp && fp.isOpen) {
                        fp.setDate([`${fromDay}/${fromMonth}/${fromYear}`, `${toDay}/${toMonth}/${toYear}`], true, 'd/m/Y');
                        break;
                    }
                }
            }, { fromDay, fromMonth, fromYear, toDay, toMonth, toYear });
            await page.waitForTimeout(500);
            await page.getByRole('button', { name: /search/i }).click();
        });

        const fileName = download.suggestedFilename();
        expect(fileName).toMatch(/^vespistiid-customer_export_\d{4}-\d{2}-\d{2}\.zip$/);

        // Verify Excel data matches filter
        const zipFilePath = await download.path();
        expect(zipFilePath).toBeTruthy();
        const { data } = await extractAndReadExcel(zipFilePath!);

        // Verify Excel has data
        expect(data.length).toBeGreaterThan(0);
        console.log(`📊 Excel rows: ${data.length}`);

        // Verify all Excel rows have Deleted At within filter range
        for (const row of data) {
            const deletedAt = row['Deleted At']?.toString() || '';
            const dateMatch = deletedAt.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            expect(dateMatch, `Excel Deleted At should be in DD/MM/YYYY format, got: "${deletedAt}"`).toBeTruthy();

            if (dateMatch) {
                const rowDate = new Date(parseInt(dateMatch[3]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));
                expect(
                    rowDate >= filterFromDate && rowDate <= filterToDate,
                    `Excel Deleted At "${deletedAt}" should be between ${fromDate} and ${toDate}`
                ).toBe(true);
            }
        }

        // Verify UI data exists in Excel (first page comparison)
        for (const uiRow of uiDeletedDates) {
            const foundInExcel = data.some(row => row['Vespisti ID']?.toString() === uiRow.vespistiId);
            expect(foundInExcel, `UI Vespisti ID "${uiRow.vespistiId}" should exist in Excel`).toBe(true);
        }
        console.log(`✅ All ${data.length} Excel rows match Deleted Date filter: ${fromDate} to ${toDate}`);
        console.log(`✅ All ${uiDeletedDates.length} UI rows found in Excel`);
    });

    test('Export to Excel download', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Download event not reliable on Firefox/WebKit');
        test.slow(); // Allow 90s for download
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Click Export button with retry on timeout
        await page.getByRole('button', { name: 'Export to Excel' }).click();
        await expect(page.getByText('Data Export Warning')).toBeVisible();

        const download = await downloadWithRetry(page);

        // Verify download
        const fileName = download.suggestedFilename();

        // Verify file name format: vespistiid-customer_export_YYYY-MM-DD.zip$
        expect(fileName).toMatch(/^vespistiid-customer_export_\d{4}-\d{2}-\d{2}\.zip$/);
        console.log('✅ Excel file exported successfully');
    });

    test('Verify Excel column headers', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Download event not reliable on Firefox/WebKit');
        test.slow(); // Allow 90s for download
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Export all data with retry on timeout
        await page.getByRole('button', { name: 'Export to Excel' }).click();
        await expect(page.getByText('Data Export Warning')).toBeVisible();

        const download = await downloadWithRetry(page);

        // Get zip file path and extract Excel
        const zipFilePath = await download.path();
        expect(zipFilePath).toBeTruthy();

        const { headers, data } = await extractAndReadExcel(zipFilePath!);
        console.log(`📊 Excel headers: ${headers.join(', ')}`);
        console.log(`📊 Excel rows: ${data.length}`);

        // Expected columns based on actual export format (35 total)
        const expectedColumns = [
            'Vespisti ID',
            'First Name',
            'Last Name',
            'Email',
            'Phone',
            'Gender',
            'Date of Birth',
            'Address 1',
            'Sub district 1',
            'District 1',
            'Province 1',
            'Postcode 1',
            'Address 2',
            'Sub district 2',
            'District 2',
            'Province 2',
            'Postcode 2',
            'Address 3',
            'Sub district 3',
            'District 3',
            'Province 3',
            'Postcode 3',
            'Address 4',
            'Sub district 4',
            'District 4',
            'Province 4',
            'Postcode 4',
            'Address 5',
            'Sub district 5',
            'District 5',
            'Province 5',
            'Postcode 5',
            'Created At',
            'Updated At',
            'Deleted At'
        ];

        // Verify all expected columns exist
        for (const column of expectedColumns) {
            const found = headers.includes(column);
            expect(found, `Column "${column}" should exist in Excel`).toBe(true);
        }
        console.log(`✅ All ${expectedColumns.length} expected columns found in Excel`);

        // Verify total column count
        expect(headers.length).toBe(expectedColumns.length);
        console.log(`✅ Total columns: ${headers.length}`);

        // Verify data matches expected format for each column
        expect(data.length).toBeGreaterThan(0);
        console.log(`\n📋 Verifying data format for each column...`);

        // Sample first 10 rows for verification
        const sampleData = data.slice(0, Math.min(10, data.length));

        for (const row of sampleData) {
            // Vespisti ID: Should start with VP
            const vespistiId = row['Vespisti ID']?.toString() || '';
            if (vespistiId) {
                expect(vespistiId, `Vespisti ID should start with VP: ${vespistiId}`).toMatch(/^VP/);
            }

            // Email: Should contain @ if present
            const email = row['Email']?.toString() || '';
            if (email && email.trim() !== '') {
                expect(email, `Email should contain @: ${email}`).toContain('@');
            }

            // Phone: Should be 10 digits
            const phone = row['Phone']?.toString() || '';
            if (phone && phone.trim() !== '') {
                const phoneDigits = phone.replace(/[^0-9]/g, '');
                expect(phoneDigits.length, `Phone should be 10 digits: ${phone}`).toBe(10);
            }

            // Gender: Should be male or female only
            const gender = row['Gender']?.toString().toLowerCase() || '';
            if (gender && gender.trim() !== '') {
                expect(['male', 'female'], `Gender should be male or female: ${gender}`).toContain(gender);
            }

            // Date of Birth: Should be DD/MM/YYYY format (Christian era)
            const dob = row['Date of Birth'];
            if (dob !== undefined && dob !== null && dob !== '') {
                const dobStr = dob.toString();
                // Must be DD/MM/YYYY format
                expect(dobStr, `Date of Birth should be DD/MM/YYYY format: ${dobStr}`).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

                // Verify year is in Christian era (between 1900-2100)
                const yearMatch = dobStr.match(/\/(\d{4})$/);
                if (yearMatch) {
                    const year = parseInt(yearMatch[1]);
                    expect(year >= 1900 && year <= 2100, `Date of Birth year should be CE (1900-2100): ${year}`).toBe(true);
                }
            }

            // Created At: Should be DD/MM/YYYY format (Christian era)
            const createdAt = row['Created At'];
            if (createdAt !== undefined && createdAt !== null && createdAt !== '') {
                const createdAtStr = createdAt.toString();
                // Must be DD/MM/YYYY format
                expect(createdAtStr, `Created At should be DD/MM/YYYY format: ${createdAtStr}`).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

                // Verify year is in Christian era (between 1900-2100)
                const yearMatch = createdAtStr.match(/\/(\d{4})$/);
                if (yearMatch) {
                    const year = parseInt(yearMatch[1]);
                    expect(year >= 1900 && year <= 2100, `Created At year should be CE (1900-2100): ${year}`).toBe(true);
                }
            }

            // Updated At: Should be DD/MM/YYYY format (Christian era)
            const updatedAt = row['Updated At'];
            if (updatedAt !== undefined && updatedAt !== null && updatedAt !== '') {
                const updatedAtStr = updatedAt.toString();
                // Must be DD/MM/YYYY format
                expect(updatedAtStr, `Updated At should be DD/MM/YYYY format: ${updatedAtStr}`).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

                // Verify year is in Christian era (between 1900-2100)
                const yearMatch = updatedAtStr.match(/\/(\d{4})$/);
                if (yearMatch) {
                    const year = parseInt(yearMatch[1]);
                    expect(year >= 1900 && year <= 2100, `Updated At year should be CE (1900-2100): ${year}`).toBe(true);
                }
            }

            // Deleted At: Should be DD/MM/YYYY format (Christian era) if present
            const deletedAt = row['Deleted At'];
            if (deletedAt !== undefined && deletedAt !== null && deletedAt !== '') {
                const deletedAtStr = deletedAt.toString();
                // Must be DD/MM/YYYY format
                expect(deletedAtStr, `Deleted At should be DD/MM/YYYY format: ${deletedAtStr}`).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

                // Verify year is in Christian era (between 1900-2100)
                const yearMatch = deletedAtStr.match(/\/(\d{4})$/);
                if (yearMatch) {
                    const year = parseInt(yearMatch[1]);
                    expect(year >= 1900 && year <= 2100, `Deleted At year should be CE (1900-2100): ${year}`).toBe(true);
                }
            }

            // Postcode: Should be 5 digits if present
            for (let i = 1; i <= 5; i++) {
                const postcode = row[`Postcode ${i}`]?.toString() || '';
                if (postcode && postcode.trim() !== '') {
                    expect(postcode, `Postcode ${i} should be 5 digits: ${postcode}`).toMatch(/^\d{5}$/);
                }
            }
        }

        console.log(`✅ Vespisti ID format verified (starts with VP)`);
        console.log(`✅ Email format verified (contains @)`);
        console.log(`✅ Phone format verified (10 digits)`);
        console.log(`✅ Gender values verified (male/female only)`);
        console.log(`✅ Date of Birth format verified (DD/MM/YYYY, CE year)`);
        console.log(`✅ Created At format verified (DD/MM/YYYY, CE year)`);
        console.log(`✅ Updated At format verified (DD/MM/YYYY, CE year)`);
        console.log(`✅ Deleted At format verified (DD/MM/YYYY, CE year)`);
        console.log(`✅ Postcode format verified (5 digits)`);
        console.log(`\n✅ All column data validation passed!`);
    });

    test('Verify deleted account export', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Download event not reliable on Firefox/WebKit');
        test.slow(); // Allow 90s for download
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Export all data with retry on timeout
        await page.getByRole('button', { name: 'Export to Excel' }).click();
        await expect(page.getByText('Data Export Warning')).toBeVisible();

        const download = await downloadWithRetry(page);

        // Get zip file path and extract Excel
        const zipFilePath = await download.path();
        expect(zipFilePath).toBeTruthy();

        const { data } = await extractAndReadExcel(zipFilePath!);
        console.log(`📊 Excel total rows: ${data.length}`);

        // Columns that should have data for deleted accounts
        const allowedColumns = ['Vespisti ID', 'Created At', 'Updated At', 'Deleted At'];

        // Columns that should be empty for deleted accounts
        const shouldBeEmptyColumns = [
            'First Name', 'Last Name', 'Email', 'Phone', 'Gender', 'Date of Birth',
            'Address 1', 'Sub district 1', 'District 1', 'Province 1', 'Postcode 1',
            'Address 2', 'Sub district 2', 'District 2', 'Province 2', 'Postcode 2',
            'Address 3', 'Sub district 3', 'District 3', 'Province 3', 'Postcode 3',
            'Address 4', 'Sub district 4', 'District 4', 'Province 4', 'Postcode 4',
            'Address 5', 'Sub district 5', 'District 5', 'Province 5', 'Postcode 5'
        ];

        // Find deleted accounts (rows with Deleted At value)
        const deletedAccounts = data.filter(row => {
            const deletedAt = row['Deleted At'];
            return deletedAt !== undefined && deletedAt !== null && deletedAt !== '' && deletedAt.toString().trim() !== '';
        });

        console.log(`📋 Found ${deletedAccounts.length} deleted accounts out of ${data.length} total`);
        expect(deletedAccounts.length).toBeGreaterThan(0);

        // Verify each deleted account
        for (let i = 0; i < deletedAccounts.length; i++) {
            const row = deletedAccounts[i];
            const vespistiId = row['Vespisti ID'];
            console.log(`\n🔍 Checking deleted account: ${vespistiId}`);

            // Verify allowed columns have data
            for (const col of allowedColumns) {
                const value = row[col];
                expect(value, `${vespistiId}: ${col} should have value`).toBeTruthy();
            }

            // Verify other columns are empty
            for (const col of shouldBeEmptyColumns) {
                const value = row[col];
                const isEmpty = value === undefined || value === null || value === '' || value.toString().trim() === '';
                expect(isEmpty, `${vespistiId}: ${col} should be empty for deleted account, got: "${value}"`).toBe(true);
            }
        }

        console.log(`\n✅ Verified ${deletedAccounts.length} deleted accounts`);
        console.log(`✅ Allowed columns verified: ${allowedColumns.join(', ')}`);
        console.log(`✅ All personal data columns are empty for deleted accounts`);
    });
});  