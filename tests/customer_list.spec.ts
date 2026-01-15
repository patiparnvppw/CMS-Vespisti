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

    test('Verify name format', async ({ page }) => {
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Get all name elements (should be in the first column, above the Vespisti ID)
        // HTML shows: text-gray-800 (not 900) and text-theme-sm font-medium
        const nameElements = page.locator('tbody tr .text-theme-sm.font-medium');
        const count = await nameElements.count();

        console.log(`Found ${count} customer names to verify`);

        // Verify we found at least some names
        expect(count).toBeGreaterThan(0);

        for (let i = 0; i < count; i++) {
            const fullName = await nameElements.nth(i).textContent();

            if (fullName && fullName.trim()) {
                console.log(`[${i}] Verifying name: ${fullName}`);

                // Name format should be: "FirstName Las****" (first 3 chars + asterisks for remaining)
                const nameParts = fullName.trim().split(' ');

                if (nameParts.length > 1) {
                    const firstName = nameParts[0];
                    const lastNameDisplay = nameParts[1];

                    // First name should be complete (no masking)
                    expect(firstName.length).toBeGreaterThan(0);
                    expect(firstName).not.toContain('*');

                    // Last name should show first 3 chars + asterisks
                    // Count asterisks and non-asterisk chars
                    const asteriskCount = (lastNameDisplay.match(/\*/g) || []).length;
                    const visibleChars = lastNameDisplay.replace(/\*/g, '');

                    console.log(`[${i}] First: "${firstName}", Last: "${lastNameDisplay}"`);
                    console.log(`[${i}] Visible: ${visibleChars.length} chars, Asterisks: ${asteriskCount}`);

                    // Must have asterisks (masked) and visible chars should be exactly 3
                    expect(asteriskCount, `Row ${i}: ${fullName} should have asterisks`).toBeGreaterThan(0);
                    expect(visibleChars.length, `Row ${i}: ${fullName} should show exactly 3 chars, but shows ${visibleChars.length}`).toEqual(3);
                    expect(visibleChars.length, `Row ${i}: ${fullName} should have visible chars`).toBeGreaterThan(0);
                } else {
                    console.log(`[${i}] Skipping (no last name): ${fullName}`);
                }
            }
        }
    });

    test('Verify email format', async ({ page }) => {
        await page.goto('/customer');

        await expect(page.locator('table')).toBeVisible();

        // Get all email elements (column 2: Email)
        const emailElements = page.locator('tbody tr td:nth-child(2)');
        const count = await emailElements.count();

        console.log(`Found ${count} emails to verify`);
        expect(count).toBeGreaterThan(0);

        for (let i = 0; i < count; i++) {
            const emailText = await emailElements.nth(i).textContent();

            if (emailText && emailText.trim() && emailText.includes('@')) {
                console.log(`[${i}] Verifying email: ${emailText.trim()}`);

                const email = emailText.trim();
                const [localPart, domain] = email.split('@');

                // Local part should have 3 visible chars + asterisks (e.g., "ema*****")
                const asteriskCount = (localPart.match(/\*/g) || []).length;
                const visibleChars = localPart.replace(/\*/g, '');

                console.log(`[${i}] Local: "${localPart}", Domain: "${domain}"`);
                console.log(`[${i}] Visible: ${visibleChars.length} chars, Asterisks: ${asteriskCount}`);

                // Verify local part format
                expect(asteriskCount, `Row ${i}: ${email} local part should have asterisks`).toBeGreaterThan(0);
                expect(visibleChars.length, `Row ${i}: ${email} should show exactly 3 chars, but shows ${visibleChars.length}`).toEqual(3);

                // Verify domain is visible and valid
                expect(domain, `Row ${i}: ${email} should have domain`).toBeTruthy();
                expect(domain.length, `Row ${i}: ${email} domain should be visible`).toBeGreaterThan(3);
                expect(domain, `Row ${i}: ${email} domain should not be masked`).not.toContain('*');

                console.log(`[${i}] ✓ Valid format: ${email}`);
            }
        }
    });

    test('Verify phone format', async ({ page }) => {
        await page.goto('/customer');

        await expect(page.locator('table')).toBeVisible();

        // Get all phone elements (column 3: Phone)
        const phoneElements = page.locator('tbody tr td:nth-child(3)');
        const count = await phoneElements.count();

        console.log(`Found ${count} phone numbers to verify`);
        expect(count).toBeGreaterThan(0);

        for (let i = 0; i < count; i++) {
            const phoneText = await phoneElements.nth(i).textContent();

            if (phoneText && phoneText.trim()) {
                const phone = phoneText.trim();
                console.log(`[${i}] Verifying phone: ${phone}`);

                // Phone should have 6 visible digits + asterisks (e.g., "081234****")
                const asteriskCount = (phone.match(/\*/g) || []).length;
                const visibleChars = phone.replace(/\*/g, '').replace(/[^0-9]/g, ''); // Remove asterisks and non-digits

                console.log(`[${i}] Visible digits: ${visibleChars.length}, Asterisks: ${asteriskCount}`);

                // Verify format
                expect(asteriskCount, `Row ${i}: ${phone} should have asterisks`).toBeGreaterThan(0);
                expect(visibleChars.length, `Row ${i}: ${phone} should show exactly 6 digits, but shows ${visibleChars.length}`).toEqual(6);

                console.log(`[${i}] ✓ Valid format: ${phone}`);
            }
        }
    });

    test('Verify gender', async ({ page }) => {
        await page.goto('/customer');

        await expect(page.locator('table')).toBeVisible();

        // Get all gender elements (column 4: Gender)
        const genderElements = page.locator('tbody tr td:nth-child(4)');
        const count = await genderElements.count();

        console.log(`Found ${count} gender fields to verify`);
        expect(count).toBeGreaterThan(0);

        for (let i = 0; i < count; i++) {
            const genderText = await genderElements.nth(i).textContent();
            const gender = genderText?.trim().toLowerCase();

            console.log(`[${i}] Verifying gender: "${genderText?.trim()}"`);

            // Gender can be empty, or must be "male" or "female" (case insensitive)
            if (gender && gender !== '') {
                expect(
                    ['male', 'female'],
                    `Row ${i}: Gender must be "Male" or "Female", but got "${genderText?.trim()}"`
                ).toContain(gender);
            }

            console.log(`[${i}] ✓ Valid gender: ${genderText?.trim() || '(empty)'}`);
        }
    });

    test('Verify date of birth format', async ({ page }) => {
        await page.goto('/customer');

        await expect(page.locator('table')).toBeVisible();

        // Get all date of birth elements (column 5: Date of Birth)
        const dobElements = page.locator('tbody tr td:nth-child(5)');
        const count = await dobElements.count();

        console.log(`Found ${count} date of birth fields to verify`);
        expect(count).toBeGreaterThan(0);

        for (let i = 0; i < count; i++) {
            const dobText = await dobElements.nth(i).textContent();

            if (dobText && dobText.trim() && dobText.trim() !== '-') {
                const dob = dobText.trim();
                console.log(`[${i}] Verifying DOB: ${dob}`);

                // Format should be **/mm/yyyy
                // Pattern: ** (2 asterisks) / 2 digits / 4 digits
                const dobPattern = /^\*{2}\/\d{2}\/\d{4}$/;

                expect(dob, `Row ${i}: DOB format must be **/mm/yyyy, but got "${dob}"`).toMatch(dobPattern);

                // Extract month and year
                const parts = dob.split('/');
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);

                // Verify month is valid (1-12)
                expect(month, `Row ${i}: Month must be 1-12, but got ${month}`).toBeGreaterThanOrEqual(1);
                expect(month, `Row ${i}: Month must be 1-12, but got ${month}`).toBeLessThanOrEqual(12);

                // Verify year is less than current year
                const currentYear = new Date().getFullYear();
                expect(year, `Row ${i}: Year should be less than or equal to current year (${currentYear}), but got ${year}`).toBeLessThanOrEqual(currentYear);

                console.log(`[${i}] ✓ Valid DOB format: ${dob} (Month: ${month}, Year: ${year} CE)`);
            } else {
                console.log(`[${i}] Skipping empty DOB`);
            }
        }
    });

    test('Verify created date format', async ({ page }) => {
        await page.goto('/customer');

        await expect(page.locator('table')).toBeVisible();

        // Get all created date elements (column 6: Created Date)
        const createdDateElements = page.locator('tbody tr td:nth-child(6)');
        const count = await createdDateElements.count();

        console.log(`Found ${count} created dates to verify`);
        expect(count).toBeGreaterThan(0);

        const currentYear = new Date().getFullYear();

        for (let i = 0; i < count; i++) {
            const createdDateText = await createdDateElements.nth(i).textContent();

            // Created Date is required - must not be empty
            expect(createdDateText, `Row ${i}: Created Date is required`).toBeTruthy();
            expect(createdDateText?.trim(), `Row ${i}: Created Date must not be empty or "-"`).not.toBe('');
            expect(createdDateText?.trim(), `Row ${i}: Created Date must not be "-"`).not.toBe('-');

            const createdDate = createdDateText!.trim();
            console.log(`[${i}] Verifying Created Date: ${createdDate}`);

            // Format should be dd/mm/yyyy
            const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
            expect(createdDate, `Row ${i}: Created Date format must be dd/mm/yyyy, but got "${createdDate}"`).toMatch(datePattern);

            const parts = createdDate.split('/');
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parseInt(parts[2]);

            // Verify day (1-31)
            expect(day, `Row ${i}: Day must be 1-31, but got ${day}`).toBeGreaterThanOrEqual(1);
            expect(day, `Row ${i}: Day must be 1-31, but got ${day}`).toBeLessThanOrEqual(31);

            // Verify month (1-12)
            expect(month, `Row ${i}: Month must be 1-12, but got ${month}`).toBeGreaterThanOrEqual(1);
            expect(month, `Row ${i}: Month must be 1-12, but got ${month}`).toBeLessThanOrEqual(12);

            // Verify year is in CE format and reasonable
            expect(year, `Row ${i}: Year should be less than or equal to current year (${currentYear}), but got ${year}`).toBeLessThanOrEqual(currentYear);

            console.log(`[${i}] ✓ Valid Created Date: ${createdDate} (CE)`);
        }
    });

    test('Verify deleted date format', async ({ page }) => {
        await page.goto('/customer');

        await expect(page.locator('table')).toBeVisible();

        // Get all deleted date elements (column 7: Deleted Date)
        const deletedDateElements = page.locator('tbody tr td:nth-child(7)');
        const count = await deletedDateElements.count();

        console.log(`Found ${count} deleted dates to verify`);
        expect(count).toBeGreaterThan(0);

        const currentYear = new Date().getFullYear();

        for (let i = 0; i < count; i++) {
            const deletedDateText = await deletedDateElements.nth(i).textContent();

            if (deletedDateText && deletedDateText.trim() && deletedDateText.trim() !== '-') {
                const deletedDate = deletedDateText.trim();
                console.log(`[${i}] Verifying Deleted Date: ${deletedDate}`);

                // Format should be dd/mm/yyyy
                const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
                expect(deletedDate, `Row ${i}: Deleted Date format must be dd/mm/yyyy, but got "${deletedDate}"`).toMatch(datePattern);

                const parts = deletedDate.split('/');
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);

                // Verify day (1-31)
                expect(day, `Row ${i}: Day must be 1-31, but got ${day}`).toBeGreaterThanOrEqual(1);
                expect(day, `Row ${i}: Day must be 1-31, but got ${day}`).toBeLessThanOrEqual(31);

                // Verify month (1-12)
                expect(month, `Row ${i}: Month must be 1-12, but got ${month}`).toBeGreaterThanOrEqual(1);
                expect(month, `Row ${i}: Month must be 1-12, but got ${month}`).toBeLessThanOrEqual(12);

                // Verify year is in CE format and reasonable
                expect(year, `Row ${i}: Year should be less than or equal to current year (${currentYear}), but got ${year}`).toBeLessThanOrEqual(currentYear);

                console.log(`[${i}] ✓ Valid Deleted Date: ${deletedDate} (CE)`);
            } else {
                console.log(`[${i}] Deleted Date is empty (valid)`);
            }
        }
    });

    test('Verify deleted user information display', async ({ page }) => {
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        const rows = page.locator('tbody tr');
        const count = await rows.count();

        for (let i = 0; i < count; i++) {
            const row = rows.nth(i);

            // Get deleted date (column 7)
            const deletedDateText = await row.locator('td:nth-child(7)').textContent();
            const deletedDate = deletedDateText?.trim();

            // If user is deleted (has deleted date)
            if (deletedDate && deletedDate !== '' && deletedDate !== '-') {
                console.log(`[${i}] Found deleted user with date: ${deletedDate}`);

                // Get Vespisti ID from first column
                const firstColumn = row.locator('td:nth-child(1)');
                const vespistiId = await firstColumn.locator('.text-theme-xs.text-gray-500').textContent();

                // Verify Vespisti ID exists
                expect(vespistiId?.trim()).toBeTruthy();
                expect(vespistiId?.trim()).toMatch(/^VP\d{8}$/);

                console.log(`[${i}] ✓ Deleted user: ID ${vespistiId?.trim()}, Deleted: ${deletedDate}`);
            }
        }
    });

    test('Verify filter dropdown options', async ({ page }) => {
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Find the filter dropdown (select element)
        const filterDropdown = page.getByRole('combobox');
        await expect(filterDropdown).toBeVisible();

        // Expected options based on HTML
        const expectedOptions = [
            'Name / Last Name',
            'Email',
            'Phone',
            'Vespisti ID',
            'Gender',
            'Date of Birth',
            'Created Date',
            'Deleted Date'
        ];

        console.log(`Verifying dropdown has ${expectedOptions.length} options`);

        // Get all options
        const options = filterDropdown.locator('option');
        const optionCount = await options.count();

        console.log(`Found ${optionCount} options in dropdown`);

        // Verify total count
        expect(optionCount, `Should have exactly ${expectedOptions.length} options`).toBe(expectedOptions.length);

        // Verify each option text exists
        for (let i = 0; i < optionCount; i++) {
            const optionText = await options.nth(i).textContent();
            console.log(`[${i}] Option: ${optionText}`);

            expect(
                expectedOptions,
                `Option "${optionText}" should be in expected list`
            ).toContain(optionText);
        }

        console.log(`✓ Dropdown verified with ${optionCount} options`);
    });

    test('Verify filter by Vespisti ID', async ({ page }) => {
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Select filter type
        const filterDropdown = page.getByRole('combobox');
        await filterDropdown.selectOption('vespisti_code');

        // Wait for placeholder to update
        await page.waitForTimeout(500);

        // Get random Vespisti ID from active users only (not deleted)
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();

        // Find active users (those with non-empty deleted date column or "-")
        const activeUserIds: string[] = [];
        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const deletedDate = await row.locator('td:nth-child(7)').textContent();
            const vespistiId = await row.locator('.text-theme-xs.text-gray-500').textContent();

            // Include only if deleted date is empty or "-"
            if (vespistiId && (!deletedDate?.trim() || deletedDate.trim() === '-')) {
                activeUserIds.push(vespistiId.trim());
            }
        }

        console.log(`Found ${activeUserIds.length} active users out of ${rowCount} total`);
        expect(activeUserIds.length).toBeGreaterThan(0);

        // Pick random active user ID
        const randomIndex = Math.floor(Math.random() * activeUserIds.length);
        const randomId = activeUserIds[randomIndex];

        console.log(`Searching for random active Vespisti ID (${randomIndex + 1}/${activeUserIds.length}): ${randomId}`);

        // Enter search term - use input type=text locator
        const searchInput = page.locator('input[type="text"][placeholder*="Search"]').or(page.locator('input[type="text"]').first());
        await searchInput.fill(randomId || '');

        // Wait for search button to be enabled and click
        const searchButton = page.getByRole('button', { name: /search/i });
        await expect(searchButton).toBeEnabled();
        await searchButton.click();

        // Wait for results
        await page.waitForTimeout(1000);

        // Verify filtered results contain the searched ID
        const visibleIds = page.locator('tbody tr .text-theme-xs.text-gray-500');
        const count = await visibleIds.count();

        console.log(`Found ${count} results`);
        expect(count).toBeGreaterThan(0);

        // Verify all visible IDs match the search
        for (let i = 0; i < count; i++) {
            const id = await visibleIds.nth(i).textContent();
            expect(id).toContain(randomId || '');
            console.log(`[${i}] ✓ Match: ${id}`);
        }
    });

    test('Verify filter by Email', async ({ page }) => {
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Select filter type
        const filterDropdown = page.getByRole('combobox');
        await filterDropdown.selectOption('email');

        // Wait for placeholder to update
        await page.waitForTimeout(500);

        // Get random email from active users only (not deleted)
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();

        const activeUserEmails: string[] = [];
        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const deletedDate = await row.locator('td:nth-child(7)').textContent();
            const email = await row.locator('td:nth-child(2)').textContent();

            // Include only if deleted date is empty or "-" and email exists
            if (email?.trim() && email.includes('@') && (!deletedDate?.trim() || deletedDate.trim() === '-')) {
                activeUserEmails.push(email.trim());
            }
        }

        console.log(`Found ${activeUserEmails.length} active users with email out of ${rowCount} total`);
        expect(activeUserEmails.length).toBeGreaterThan(0);

        // Pick random active user email
        const randomIndex = Math.floor(Math.random() * activeUserEmails.length);
        const randomEmail = activeUserEmails[randomIndex];

        // Extract first 3 visible characters (before asterisks)
        const emailLocal = randomEmail.split('@')[0];
        const visibleChars = emailLocal.replace(/\*/g, ''); // Remove asterisks to get visible part
        const searchTerm = visibleChars.substring(0, 3);

        console.log(`Random email (${randomIndex + 1}/${activeUserEmails.length}): ${randomEmail}`);
        console.log(`Searching for first 3 chars: "${searchTerm}"`);

        const searchInput = page.locator('input[type="text"][placeholder*="Search"]').or(page.locator('input[type="text"]').first());
        await searchInput.fill(searchTerm);

        // Wait for search button to be enabled and click
        const searchButton = page.getByRole('button', { name: /search/i });
        await expect(searchButton).toBeEnabled();
        await searchButton.click();

        await page.waitForTimeout(1000);

        // Verify results
        const emailElements = page.locator('tbody tr td:nth-child(2)');
        const count = await emailElements.count();

        console.log(`Found ${count} results for "${searchTerm}"`);

        if (count > 0) {
            for (let i = 0; i < count; i++) {
                const email = await emailElements.nth(i).textContent();
                const localPart = email?.split('@')[0] || '';
                const visible = localPart.replace(/\*/g, '');
                expect(visible).toContain(searchTerm);
                console.log(`[${i}] ✓ Match: ${email}`);
            }
        }
    });

    test('Verify filter by Phone', async ({ page }) => {
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Select filter type
        const filterDropdown = page.getByRole('combobox');
        await filterDropdown.selectOption('phone');

        // Wait for placeholder to update
        await page.waitForTimeout(500);

        // Get random phone from active users only (exclude deleted users)
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();
        const activeUserPhones: string[] = [];

        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const deletedDate = await row.locator('td:nth-child(7)').textContent();
            const phoneText = await row.locator('td:nth-child(3)').textContent();

            // Only include users where deleted date is empty or "-"
            if (phoneText && (!deletedDate?.trim() || deletedDate.trim() === '-')) {
                const phoneDigits = phoneText.replace(/\*/g, '').replace(/[^0-9]/g, '').substring(0, 6);
                if (phoneDigits.length === 6) {
                    activeUserPhones.push(phoneDigits);
                }
            }
        }

        expect(activeUserPhones.length).toBeGreaterThan(0);
        const randomPhone = activeUserPhones[Math.floor(Math.random() * activeUserPhones.length)];
        console.log(`Searching for phone starting with: ${randomPhone}`);

        const searchInput = page.locator('input[type="text"][placeholder*="Search"]').or(page.locator('input[type="text"]').first());
        await searchInput.fill(randomPhone);

        // Wait for search button to be enabled and click
        const searchButton = page.getByRole('button', { name: /search/i });
        await expect(searchButton).toBeEnabled();
        await searchButton.click();

        await page.waitForTimeout(1000);

        // Verify results
        const phoneElements = page.locator('tbody tr td:nth-child(3)');
        const count = await phoneElements.count();

        console.log(`Found ${count} results`);

        if (count > 0) {
            for (let i = 0; i < Math.min(count, 3); i++) {
                const phone = await phoneElements.nth(i).textContent();
                console.log(`[${i}] Result: ${phone}`);
            }
        }
    });

    test('Verify filter by Gender', async ({ page }) => {
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Test Male filter
        const filterDropdown = page.locator('select').first();
        await filterDropdown.selectOption('gender');

        await page.waitForTimeout(500);

        // Select Male from gender dropdown
        const genderDropdown = page.locator('select').nth(1);
        await genderDropdown.selectOption('male');

        // Click search button
        const searchButton = page.getByRole('button', { name: /search/i });
        await expect(searchButton).toBeEnabled();
        await searchButton.click();

        await page.waitForTimeout(1000);

        // Verify Male results
        const maleElements = page.locator('tbody tr td:nth-child(4)');
        const maleCount = await maleElements.count();

        console.log(`Found ${maleCount} Male results`);

        if (maleCount > 0) {
            for (let i = 0; i < Math.min(maleCount, 5); i++) {
                const gender = await maleElements.nth(i).textContent();
                expect(gender?.trim().toLowerCase()).toBe('male');
                console.log(`[${i}] ✓ Gender: ${gender}`);
            }
        }

        // Clear and test Female filter
        const clearButton = page.getByRole('button', { name: /clear/i });
        await clearButton.click();
        await page.waitForTimeout(500);

        await filterDropdown.selectOption('gender');
        await page.waitForTimeout(500);

        // Select Female from gender dropdown
        await genderDropdown.selectOption('female');

        await expect(searchButton).toBeEnabled();
        await searchButton.click();

        await page.waitForTimeout(1000);

        // Verify Female results
        const femaleElements = page.locator('tbody tr td:nth-child(4)');
        const femaleCount = await femaleElements.count();

        console.log(`Found ${femaleCount} Female results`);

        if (femaleCount > 0) {
            for (let i = 0; i < Math.min(femaleCount, 5); i++) {
                const gender = await femaleElements.nth(i).textContent();
                expect(gender?.trim().toLowerCase()).toBe('female');
                console.log(`[${i}] ✓ Gender: ${gender}`);
            }
        }
    });

    test('Verify filter by Date of Birth', async ({ page }) => {
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Collect birth years and months from active users
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();
        const birthDates: { year: number, month: number }[] = [];

        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const deletedDate = await row.locator('td:nth-child(7)').textContent();
            const dobText = await row.locator('td:nth-child(5)').textContent();

            // Only include active users with DOB
            if (dobText && (!deletedDate?.trim() || deletedDate.trim() === '-')) {
                // DOB format: **/mm/yyyy
                const match = dobText.match(/\*\*\/(\d{2})\/(\d{4})/);
                if (match) {
                    birthDates.push({
                        month: parseInt(match[1]),
                        year: parseInt(match[2])
                    });
                }
            }
        }

        expect(birthDates.length).toBeGreaterThan(0);

        // Select random birth date from available data
        const randomBirth = birthDates[Math.floor(Math.random() * birthDates.length)];

        // Create a year range that includes the selected birth date
        // Get year range from data (e.g., if year is 1990, use 1985-1995)
        const years = birthDates.map(d => d.year);
        const minAvailableYear = Math.min(...years);
        const maxAvailableYear = Math.max(...years);

        // Select From Year (1-5 years before the selected year, but not less than min)
        const fromYear = Math.max(minAvailableYear, randomBirth.year - Math.floor(Math.random() * 5) - 1);
        // Select To Year (1-5 years after the selected year, but not more than max)
        const toYear = Math.min(maxAvailableYear, randomBirth.year + Math.floor(Math.random() * 5) + 1);

        console.log(`Testing with Month: ${randomBirth.month}, Year Range: ${fromYear}-${toYear} (Target: ${randomBirth.year})`);

        // Select filter type
        const filterDropdown = page.locator('select').first();
        await filterDropdown.selectOption('birth_year_range');

        await page.waitForTimeout(500);

        // Select From Year
        const fromYearDropdown = page.locator('select').nth(1);
        await fromYearDropdown.selectOption(fromYear.toString());

        // Select To Year
        const toYearDropdown = page.locator('select').nth(2);
        await toYearDropdown.selectOption(toYear.toString());

        // Select Month
        const monthDropdown = page.locator('select').nth(3);
        await monthDropdown.selectOption(randomBirth.month.toString());

        // Click search
        const searchButton = page.getByRole('button', { name: /search/i });
        await searchButton.click();

        await page.waitForTimeout(1000);

        // Verify results match selected month and year range
        const dobElements = page.locator('tbody tr td:nth-child(5)');
        const resultCount = await dobElements.count();

        console.log(`Found ${resultCount} results for month ${randomBirth.month}, year range ${fromYear}-${toYear}`);

        if (resultCount > 0) {
            for (let i = 0; i < Math.min(resultCount, 10); i++) {
                const dobText = await dobElements.nth(i).textContent();
                const match = dobText?.match(/\*\*\/(\d{2})\/(\d{4})/);

                if (match) {
                    const resultMonth = parseInt(match[1]);
                    const resultYear = parseInt(match[2]);

                    expect(resultMonth).toBe(randomBirth.month);
                    expect(resultYear).toBeGreaterThanOrEqual(fromYear);
                    expect(resultYear).toBeLessThanOrEqual(toYear);
                    console.log(`[${i}] ✓ DOB: ${dobText} (Year: ${resultYear})`);
                }
            }
        }
    });

    test('Verify filter by Created Date', async ({ page }) => {
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

            // Only include active users with created date
            if (createdDateText && (!deletedDate?.trim() || deletedDate.trim() === '-')) {
                const date = createdDateText.trim();
                // Created date format: dd/mm/yyyy
                if (date.match(/\d{2}\/\d{2}\/\d{4}/)) {
                    createdDates.push(date);
                }
            }
        }

        expect(createdDates.length).toBeGreaterThan(0);

        // Sort dates and select random range
        const sortedDates = createdDates.map(d => {
            const [day, month, year] = d.split('/');
            return {
                dateStr: d,
                dateObj: new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            };
        }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

        // Select random start date
        const maxStartIndex = Math.max(0, sortedDates.length - 2);
        const startIndex = Math.floor(Math.random() * maxStartIndex);

        // Select end date (1-7 days after start date)
        const fromDateObj = sortedDates[startIndex].dateObj;
        const maxEndDate = new Date(fromDateObj.getTime() + (7 * 24 * 60 * 60 * 1000)); // +7 days

        // Filter dates that are within 1-7 days from start date
        const possibleEndDates = sortedDates.filter((d, idx) => {
            return idx > startIndex &&
                d.dateObj.getTime() > fromDateObj.getTime() &&
                d.dateObj.getTime() <= maxEndDate.getTime();
        });

        // If no dates within 7 days, use the next available date
        const endDate = possibleEndDates.length > 0
            ? possibleEndDates[Math.floor(Math.random() * possibleEndDates.length)]
            : sortedDates[startIndex + 1];

        const fromDate = sortedDates[startIndex].dateStr;
        const toDate = endDate.dateStr;

        const [fromDay, fromMonth, fromYear] = fromDate.split('/');
        const [toDay, toMonth, toYear] = toDate.split('/');

        console.log(`Testing with Created Date Range: ${fromDate} to ${toDate}`);

        // Select filter type
        const filterDropdown = page.locator('select').first();
        await filterDropdown.selectOption('created_at');

        await page.waitForTimeout(500);

        // Click date input to open flatpickr calendar
        const dateInput = page.locator('input#created-at-filter');
        await dateInput.click();

        await page.waitForTimeout(500);

        // Wait for flatpickr calendar to appear
        await page.waitForSelector('.flatpickr-calendar.open', { timeout: 3000 });

        // Select date range in flatpickr calendar
        await page.evaluate(({ fromDay, fromMonth, fromYear, toDay, toMonth, toYear }) => {
            const fp = (document.querySelector('input#created-at-filter') as any)?._flatpickr;
            if (fp) {
                // Set date range using flatpickr API
                const fromDateStr = `${fromDay}/${fromMonth}/${fromYear}`;
                const toDateStr = `${toDay}/${toMonth}/${toYear}`;
                fp.setDate([fromDateStr, toDateStr], true, 'd/m/Y');
            }
        }, { fromDay, fromMonth, fromYear, toDay, toMonth, toYear });

        await page.waitForTimeout(500);

        // Click search button
        const searchButton = page.getByRole('button', { name: /search/i });
        await expect(searchButton).toBeEnabled();
        await searchButton.click();

        await page.waitForTimeout(1000);

        // Verify results are within selected date range
        const createdDateElements = page.locator('tbody tr td:nth-child(6)');
        const resultCount = await createdDateElements.count();

        console.log(`Found ${resultCount} results for created date range ${fromDate} to ${toDate}`);

        // Use already created date objects for comparison
        const toDateObj = endDate.dateObj;

        if (resultCount > 0) {
            for (let i = 0; i < Math.min(resultCount, 10); i++) {
                const dateText = await createdDateElements.nth(i).textContent();
                const [d, m, y] = dateText?.trim().split('/') || [];

                if (d && m && y) {
                    const resultDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));

                    expect(resultDate.getTime()).toBeGreaterThanOrEqual(fromDateObj.getTime());
                    expect(resultDate.getTime()).toBeLessThanOrEqual(toDateObj.getTime());
                    console.log(`[${i}] ✓ Created Date: ${dateText}`);
                }
            }
        }
    });

    test('Verify filter by Deleted Date', async ({ page }) => {
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        // Collect deleted dates from users who have been deleted
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();
        const deletedDates: string[] = [];

        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const deletedDateText = await row.locator('td:nth-child(7)').textContent();

            // Only include users with deleted date (not empty or "-")
            if (deletedDateText && deletedDateText.trim() !== '' && deletedDateText.trim() !== '-') {
                const date = deletedDateText.trim();
                // Deleted date format: dd/mm/yyyy
                if (date.match(/\d{2}\/\d{2}\/\d{4}/)) {
                    deletedDates.push(date);
                }
            }
        }

        expect(deletedDates.length).toBeGreaterThan(0);

        // Sort dates and select random range
        const sortedDates = deletedDates.map(d => {
            const [day, month, year] = d.split('/');
            return {
                dateStr: d,
                dateObj: new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            };
        }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

        // Select random start date
        const maxStartIndex = Math.max(0, sortedDates.length - 2);
        const startIndex = Math.floor(Math.random() * maxStartIndex);

        // Select end date (1-7 days after start date)
        const fromDateObj = sortedDates[startIndex].dateObj;
        const maxEndDate = new Date(fromDateObj.getTime() + (7 * 24 * 60 * 60 * 1000)); // +7 days

        // Filter dates that are within 1-7 days from start date
        const possibleEndDates = sortedDates.filter((d, idx) => {
            return idx > startIndex &&
                d.dateObj.getTime() > fromDateObj.getTime() &&
                d.dateObj.getTime() <= maxEndDate.getTime();
        });

        // If no dates within 7 days, use the next available date
        const endDate = possibleEndDates.length > 0
            ? possibleEndDates[Math.floor(Math.random() * possibleEndDates.length)]
            : sortedDates[startIndex + 1];

        const fromDate = sortedDates[startIndex].dateStr;
        const toDate = endDate.dateStr;

        const [fromDay, fromMonth, fromYear] = fromDate.split('/');
        const [toDay, toMonth, toYear] = toDate.split('/');

        console.log(`Testing with Deleted Date Range: ${fromDate} to ${toDate}`);

        // Select filter type
        const filterDropdown = page.locator('select').first();
        await filterDropdown.selectOption('deleted_at');

        await page.waitForTimeout(500);

        // Click date input to open flatpickr calendar - find by placeholder
        const dateInput = page.locator('input[placeholder*="Deleted date"]').or(page.locator('input.flatpickr-input').last());
        await dateInput.click();

        await page.waitForTimeout(500);

        // Wait for flatpickr calendar to appear
        await page.waitForSelector('.flatpickr-calendar.open', { timeout: 3000 });

        // Select date range in flatpickr calendar - find by checking which flatpickr is visible
        await page.evaluate(({ fromDay, fromMonth, fromYear, toDay, toMonth, toYear }) => {
            // Find all flatpickr instances
            const inputs = document.querySelectorAll('input.flatpickr-input');
            for (const input of inputs) {
                const fp = (input as any)?._flatpickr;
                if (fp && fp.isOpen) {
                    // Set date range using flatpickr API
                    const fromDateStr = `${fromDay}/${fromMonth}/${fromYear}`;
                    const toDateStr = `${toDay}/${toMonth}/${toYear}`;
                    fp.setDate([fromDateStr, toDateStr], true, 'd/m/Y');
                    break;
                }
            }
        }, { fromDay, fromMonth, fromYear, toDay, toMonth, toYear });

        await page.waitForTimeout(500);

        // Click search button
        const searchButton = page.getByRole('button', { name: /search/i });
        await expect(searchButton).toBeEnabled();
        await searchButton.click();

        await page.waitForTimeout(1000);

        // Verify results are within selected date range
        const deletedDateElements = page.locator('tbody tr td:nth-child(7)');
        const resultCount = await deletedDateElements.count();

        console.log(`Found ${resultCount} results for deleted date range ${fromDate} to ${toDate}`);

        // Use already created date objects for comparison
        const toDateObj = endDate.dateObj;

        if (resultCount > 0) {
            for (let i = 0; i < Math.min(resultCount, 10); i++) {
                const dateText = await deletedDateElements.nth(i).textContent();
                const [d, m, y] = dateText?.trim().split('/') || [];

                if (d && m && y) {
                    const resultDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));

                    expect(resultDate.getTime()).toBeGreaterThanOrEqual(fromDateObj.getTime());
                    expect(resultDate.getTime()).toBeLessThanOrEqual(toDateObj.getTime());
                    console.log(`[${i}] ✓ Deleted Date: ${dateText}`);
                }
            }
        }
    });

    test('Verify detail button', async ({ page }) => {
        await page.goto('/customer');
        await expect(page.locator('table')).toBeVisible();

        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();

        let activeUsersWithButton = 0;
        let deletedUsersWithoutButton = 0;

        console.log(`Checking ${rowCount} rows for detail buttons`);

        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const deletedDate = await row.locator('td:nth-child(7)').textContent();
            const detailCell = row.locator('td:nth-child(8)'); // Last column (Detail)
            const detailButton = detailCell.locator('button, a').first();

            const isDeleted = deletedDate && deletedDate.trim() !== '' && deletedDate.trim() !== '-';
            const hasButton = await detailButton.count() > 0;

            if (isDeleted) {
                // Deleted user should NOT have button
                expect(hasButton, `Row ${i}: Deleted user should not have detail button`).toBe(false);
                deletedUsersWithoutButton++;
                console.log(`[${i}] ✓ Deleted user - No button (as expected)`);
            } else {
                // Active user should have button
                expect(hasButton, `Row ${i}: Active user should have detail button`).toBe(true);

                // Verify button is visible
                if (hasButton) {
                    await expect(detailButton).toBeVisible();
                }

                activeUsersWithButton++;
                console.log(`[${i}] ✓ Active user - Has button`);
            }
        }

        console.log(`\nSummary:`);
        console.log(`Active users with button: ${activeUsersWithButton}`);
        console.log(`Deleted users without button: ${deletedUsersWithoutButton}`);

        // Verify we found at least some of each type
        expect(activeUsersWithButton).toBeGreaterThan(0);
    });
});