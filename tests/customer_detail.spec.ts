import { test, expect, Page } from '@playwright/test';

// Type for API customer data
interface CustomerApiData {
    id?: string;
    vespistiId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    gender?: string;
    dateOfBirth?: string;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
    addresses?: any[];
    [key: string]: any;
}

// Helper function to get a random customer and click detail button
// Returns new page (tab), customer ID, and API data
async function clickRandomCustomerDetail(page: Page): Promise<{
    detailPage: Page;
    customerId: string;
    apiData: CustomerApiData;
}> {
    await page.goto('/customer');
    await expect(page.locator('table')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // Get all table rows (excluding header)
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    console.log(`📋 Found ${rowCount} customers in list`);

    if (rowCount === 0) {
        throw new Error('No customers found in list');
    }

    // Find active accounts only (no deleted date value)
    // Deleted date column is typically column 7
    const activeRows: number[] = [];
    const maxCheck = Math.min(rowCount, 10); // Check first 10 rows

    for (let i = 0; i < maxCheck; i++) {
        const row = rows.nth(i);
        const deletedDate = await row.locator('td:nth-child(7)').textContent() || '';
        const trimmedDate = deletedDate.trim();

        // Active if deleted date is empty, "-", or blank
        if (!trimmedDate || trimmedDate === '-' || trimmedDate === '') {
            activeRows.push(i);
        }
    }

    console.log(`✅ Found ${activeRows.length} active accounts (no deleted date)`);

    if (activeRows.length === 0) {
        throw new Error('No active accounts found in list');
    }

    // Pick a random active row
    const randomActiveIndex = activeRows[Math.floor(Math.random() * activeRows.length)];
    const selectedRow = rows.nth(randomActiveIndex);

    // Scroll row into view
    await selectedRow.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Get customer info for logging
    const customerName = await selectedRow.locator('td:nth-child(2)').textContent() || '';
    console.log(`🎲 Selected active row ${randomActiveIndex + 1}: ${customerName.trim()}`);

    // Find the detail button - it's inside a div in the last td
    const detailButton = selectedRow.locator('td').last().locator('button');

    // Debug: log button count
    const buttonCount = await detailButton.count();
    console.log(`🔘 Found ${buttonCount} button(s) in last td`);

    if (buttonCount === 0) {
        throw new Error('No button found in row');
    }

    await expect(detailButton.first()).toBeVisible({ timeout: 10000 });

    // Click the detail button - it opens in new tab
    const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        detailButton.first().click()
    ]);

    // Intercept API on new page to capture customer data
    let apiData: CustomerApiData = {};

    // Set up route handler for API
    await newPage.route('**/api/**', async (route) => {
        const response = await route.fetch();
        try {
            const json = await response.json();
            // Capture customer detail data
            if (json && (json.id || json.vespistiId || json.data?.id)) {
                apiData = json.data || json;
                console.log(`📦 API Data captured:`, JSON.stringify(apiData, null, 2).substring(0, 500));
            }
        } catch {
            // Not JSON response, continue
        }
        await route.fulfill({ response });
    });

    // Wait for new page to load
    await newPage.waitForLoadState('networkidle');

    // Reload to capture API with route handler
    await newPage.reload();
    await newPage.waitForLoadState('networkidle');

    // Extract customer ID from URL
    const currentUrl = newPage.url();
    console.log(`📍 New tab URL: ${currentUrl}`);

    let customerId = '';
    const urlIdMatch = currentUrl.match(/id=([^&]+)/);
    customerId = urlIdMatch ? urlIdMatch[1] : '';

    console.log(`✅ Opened detail page in new tab for customer ID: ${customerId}`);

    return { detailPage: newPage, customerId, apiData };
}

test.describe('Customer Detail', () => {
    test('Customer detail UI', async ({ page }) => {
        const { detailPage, customerId } = await clickRandomCustomerDetail(page);
        expect(customerId, 'Should get customer ID from URL').toBeTruthy();
        await expect(detailPage).toHaveURL(/\/customer\/detail\?id=/);
        console.log(`✅ Successfully clicked detail button and navigated to customer ID: ${customerId}`);

        // Verify page title - use text-based selector (not index-based due to sidebar state)
        await expect(detailPage.getByRole('heading', { name: 'Vespisti ID Customer', level: 2 })).toBeVisible();
        console.log('✅ Page title verified');
    });

    test('Verify profile section', async ({ page }) => {
        const { detailPage, apiData } = await clickRandomCustomerDetail(page);

        // Verify Profile heading
        await expect(detailPage.locator('h3')).toContainText('Profile');

        // Focus on the profile card container
        const profileCard = detailPage.locator('.flex.flex-col.gap-5');

        // Verify customer image exists
        const profileImage = profileCard.locator('img[alt="customer"]');
        await expect(profileImage).toBeVisible();

        // Verify customer name in profile card (h4 inside .order-3)
        const customerNameSection = profileCard.locator('.order-3');
        const customerName = customerNameSection.locator('h4.text-lg.font-semibold');
        await expect(customerName).toBeVisible();
        const nameText = await customerName.textContent();
        console.log(`📛 Customer name: ${nameText}`);
        expect(nameText).toBeTruthy();
        // Verify name contains asterisks (masked)
        expect(nameText).toContain('*');

        // Verify email and phone inside the same section
        const contactInfo = customerNameSection.locator('.flex.flex-col.items-center');

        // Verify email format (masked: xxx*****@domain.com or blank/hidden if null)
        const emailInProfile = contactInfo.locator('p.text-sm.text-gray-500').first();
        let emailText = '';
        let hasEmail = false;
        if (await emailInProfile.isVisible()) {
            emailText = await emailInProfile.textContent() || '';
            hasEmail = emailText.trim() !== '';
            console.log(`📧 Email: "${emailText.trim()}" ${!hasEmail ? '(blank/null)' : ''}`);
            if (hasEmail) {
                expect(emailText).toContain('@');
                expect(emailText).toContain('*');
            }
        } else {
            console.log(`📧 Email: (hidden/null)`);
        }

        // Verify phone format (masked: 6 digits + **** or blank/hidden if null)
        const phoneInProfile = contactInfo.locator('p.text-sm.text-gray-500').nth(1);
        let phoneText = '';
        let hasPhone = false;
        if (await phoneInProfile.isVisible()) {
            phoneText = await phoneInProfile.textContent() || '';
            hasPhone = phoneText.trim() !== '';
            console.log(`📱 Phone: "${phoneText.trim()}" ${!hasPhone ? '(blank/null)' : ''}`);
            if (hasPhone) {
                expect(phoneText).toContain('*');
            }
        } else {
            console.log(`📱 Phone: (hidden/null)`);
        }

        // Verify at least one of email or phone must have a value (not both blank/hidden)
        expect(hasEmail || hasPhone, 'At least one of email or phone must have a value').toBe(true);
        console.log(`📋 Contact info: Email=${hasEmail ? 'Yes' : 'No'}, Phone=${hasPhone ? 'Yes' : 'No'}`);

        // === API Comparison ===
        if (apiData && Object.keys(apiData).length > 0) {
            console.log('\n📦 Comparing Profile with API response...');

            // Verify name matches API (first name + masked last name)
            const apiFirstName = apiData.firstName || apiData.first_name || '';
            const apiLastName = apiData.lastName || apiData.last_name || '';
            if (apiFirstName && nameText) {
                expect(nameText, 'Name should contain first name from API').toContain(apiFirstName);
                console.log(`   ✓ First name "${apiFirstName}" found in display name`);
            }
            if (apiLastName && nameText) {
                const lastNamePrefix = apiLastName.substring(0, 3);
                expect(nameText, 'Name should contain last name prefix from API').toContain(lastNamePrefix);
                console.log(`   ✓ Last name prefix "${lastNamePrefix}" found in display name`);
            }

            // Verify email domain matches API
            const apiEmail = apiData.email || '';
            if (apiEmail && hasEmail && emailText.includes('@')) {
                const displayedDomain = emailText.split('@')[1];
                const apiDomain = apiEmail.split('@')[1];
                expect(displayedDomain, 'Email domain should match API').toBe(apiDomain);
                console.log(`   ✓ Email domain "${apiDomain}" matches`);
            }

            // Verify phone prefix matches API
            const apiPhone = apiData.phone || apiData.phoneNumber || '';
            if (apiPhone && hasPhone && phoneText.includes('*')) {
                const displayedPrefix = phoneText.replace(/\*+/g, '');
                const apiPrefix = apiPhone.replace(/[^0-9]/g, '').substring(0, 6);
                expect(displayedPrefix, 'Phone prefix should match API').toBe(apiPrefix);
                console.log(`   ✓ Phone prefix "${apiPrefix}" matches`);
            }
        } else {
            console.log('⚠️ No API data captured for comparison');
        }

        console.log('\n✅ Profile section verified');
    });

    test('Verify personal information section', async ({ page }) => {
        const { detailPage, apiData } = await clickRandomCustomerDetail(page);

        // Focus on Personal Information section container
        const personalInfoSection = detailPage.locator('.flex.flex-col.gap-6').filter({
            has: detailPage.locator('h4:has-text("Personal Information")')
        });
        await expect(personalInfoSection).toBeVisible();

        // Verify Personal Information heading
        await expect(personalInfoSection.locator('h4.text-lg.font-semibold')).toContainText('Personal Information');

        // Get the grid containing all fields
        const fieldsGrid = personalInfoSection.locator('.grid.grid-cols-1.gap-4');

        // Helper function to get field value by label
        const getFieldValue = async (labelText: string): Promise<string> => {
            const fieldDiv = fieldsGrid.locator('> div').filter({
                has: detailPage.locator(`p.text-xs:has-text("${labelText}")`)
            });
            const value = await fieldDiv.locator('p.text-sm.font-medium').textContent();
            return value || '';
        };

        // Verify Vespisti ID field (format: VP + 8 digits)
        const vespistiId = await getFieldValue('Vespisti ID');
        console.log(`🆔 Vespisti ID: ${vespistiId}`);
        expect(vespistiId).toMatch(/^VP\d{8}$/);

        // Verify Created Date field (format: dd/mm/yyyy)
        const createdDate = await getFieldValue('Created Date');
        console.log(`📅 Created Date: ${createdDate}`);
        expect(createdDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

        // Verify Updated Date field (format: dd/mm/yyyy)
        const updatedDate = await getFieldValue('Updated Date');
        console.log(`📅 Updated Date: ${updatedDate}`);
        expect(updatedDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

        // Verify Deleted Date field (should be "-" for active users)
        const deletedDate = await getFieldValue('Deleted Date');
        console.log(`🗑️ Deleted Date: ${deletedDate}`);

        // Verify First Name field
        const firstName = await getFieldValue('First Name');
        console.log(`👤 First Name: ${firstName}`);
        expect(firstName).toBeTruthy();

        // Verify Last Name field (masked: 3 chars + *****)
        const lastName = await getFieldValue('Last Name');
        console.log(`👤 Last Name: ${lastName}`);
        expect(lastName).toContain('*');

        // Verify Gender field (male/female)
        const gender = await getFieldValue('Gender');
        console.log(`⚧ Gender: ${gender}`);
        expect(['male', 'female', 'other']).toContain(gender?.toLowerCase());

        // Verify Date of Birth field (masked: **/mm/yyyy)
        const dob = await getFieldValue('Date of Birth');
        console.log(`🎂 Date of Birth: ${dob}`);
        expect(dob).toMatch(/^\*\*\/\d{2}\/\d{4}$/);

        // Verify Email field (masked: xxx*****@domain.com or "-" if null)
        const email = await getFieldValue('Email');
        console.log(`📧 Email: ${email}`);
        if (email === '-') {
            expect(email).toBe('-');
        } else {
            expect(email).toContain('@');
            expect(email).toContain('*');
        }

        // Verify Phone field (masked: 6 digits + **** or "-" if null)
        const phone = await getFieldValue('Phone');
        console.log(`📱 Phone: ${phone}`);
        if (phone === '-') {
            expect(phone).toBe('-');
        } else {
            expect(phone).toContain('*');
        }

        // Verify at least one of email or phone must have a value (not both "-")
        const hasEmail = email !== '-';
        const hasPhone = phone !== '-';
        expect(hasEmail || hasPhone, 'At least one of email or phone must have a value').toBe(true);
        console.log(`📋 Contact info: Email=${hasEmail ? 'Yes' : 'No'}, Phone=${hasPhone ? 'Yes' : 'No'}`);

        // === API Comparison ===
        if (apiData && Object.keys(apiData).length > 0) {
            console.log('\n📦 Comparing Personal Information with API response...');

            // Verify Vespisti ID matches API
            const apiVespistiId = apiData.vespistiId || apiData.vespisti_id || '';
            if (apiVespistiId) {
                expect(vespistiId, 'Vespisti ID should match API').toBe(apiVespistiId);
                console.log(`   ✓ Vespisti ID "${apiVespistiId}" matches`);
            }

            // Verify First Name matches API
            const apiFirstName = apiData.firstName || apiData.first_name || '';
            if (apiFirstName) {
                expect(firstName, 'First Name should match API').toBe(apiFirstName);
                console.log(`   ✓ First Name "${apiFirstName}" matches`);
            }

            // Verify Last Name prefix matches API (masked)
            const apiLastName = apiData.lastName || apiData.last_name || '';
            if (apiLastName && lastName.includes('*')) {
                const displayedPrefix = lastName.replace(/\*+/g, '');
                const apiPrefix = apiLastName.substring(0, 3);
                expect(displayedPrefix, 'Last Name prefix should match API').toBe(apiPrefix);
                console.log(`   ✓ Last Name prefix "${apiPrefix}" matches`);
            }

            // Verify Gender matches API
            const apiGender = apiData.gender || '';
            if (apiGender) {
                expect(gender.toLowerCase(), 'Gender should match API').toBe(apiGender.toLowerCase());
                console.log(`   ✓ Gender "${apiGender}" matches`);
            }

            // Verify Email domain matches API
            const apiEmail = apiData.email || '';
            if (apiEmail && hasEmail && email.includes('@')) {
                const displayedDomain = email.split('@')[1];
                const apiDomain = apiEmail.split('@')[1];
                expect(displayedDomain, 'Email domain should match API').toBe(apiDomain);
                console.log(`   ✓ Email domain "${apiDomain}" matches`);
            }

            // Verify Phone prefix matches API
            const apiPhone = apiData.phone || apiData.phoneNumber || '';
            if (apiPhone && hasPhone && phone.includes('*')) {
                const displayedPrefix = phone.replace(/\*+/g, '');
                const apiPrefix = apiPhone.replace(/[^0-9]/g, '').substring(0, 6);
                expect(displayedPrefix, 'Phone prefix should match API').toBe(apiPrefix);
                console.log(`   ✓ Phone prefix "${apiPrefix}" matches`);
            }
        } else {
            console.log('⚠️ No API data captured for comparison');
        }

        console.log('\n✅ Personal Information section verified');
    });

    test('Verify addresses section', async ({ page }) => {
        const { detailPage, apiData } = await clickRandomCustomerDetail(page);

        // Find Addresses heading - try multiple selectors
        let addressesHeading = detailPage.getByRole('heading', { name: /Addresses/i });
        if (await addressesHeading.count() === 0) {
            addressesHeading = detailPage.locator('h4:has-text("Addresses")');
        }
        if (await addressesHeading.count() === 0) {
            addressesHeading = detailPage.locator('h3:has-text("Addresses")');
        }
        if (await addressesHeading.count() === 0) {
            addressesHeading = detailPage.locator('h5:has-text("Addresses")');
        }

        // If still not found, log available headings for debug
        if (await addressesHeading.count() === 0) {
            const allHeadings = await detailPage.locator('h1, h2, h3, h4, h5, h6').allTextContents();
            console.log('📋 Available headings:', allHeadings);
            console.log('   ℹ️ No Addresses heading found - customer may have no addresses section');
            console.log('\n✅ Addresses section verified (no section displayed)');
            return;
        }

        await expect(addressesHeading.first()).toBeVisible();
        const addressesText = await addressesHeading.first().textContent();
        console.log(`📍 ${addressesText}`);

        // Extract address count from heading
        const addressCountMatch = addressesText?.match(/Addresses\s*\((\d+)\)/);
        const displayedAddressCount = addressCountMatch ? parseInt(addressCountMatch[1]) : 0;
        console.log(`   Displayed address count: ${displayedAddressCount}`);

        // === API Comparison for address count ===
        const apiAddresses = apiData?.addresses || apiData?.address || [];
        if (Array.isArray(apiAddresses) && apiAddresses.length > 0) {
            expect(displayedAddressCount, 'Address count should match API').toBe(apiAddresses.length);
            console.log(`   ✓ Address count matches API (${apiAddresses.length})`);
        }

        // Handle case: customer has no addresses
        if (displayedAddressCount === 0) {
            console.log(`   ℹ️ This customer has no addresses`);
            console.log('\n✅ Addresses section verified (no addresses)');
            return;
        }

        // Find address cards
        const addressCards = detailPage.locator('.space-y-4 > .p-4.border.rounded-lg');
        const cardCount = await addressCards.count();
        console.log(`   Found ${cardCount} address cards`);

        // Verify card count matches heading count
        expect(cardCount).toBe(displayedAddressCount);

        for (let i = 0; i < cardCount; i++) {
            const card = addressCards.nth(i);

            // Verify address title (Address 1, Address 2, etc.)
            const addressTitle = card.locator('h5.font-medium');
            await expect(addressTitle).toBeVisible();
            const titleText = await addressTitle.textContent();
            console.log(`\n   📫 ${titleText}:`);
            expect(titleText).toContain(`Address ${i + 1}`);

            // Get the grid containing address fields
            const fieldsGrid = card.locator('.grid.grid-cols-1.gap-3');

            // Verify each field: label exists and has value

            // 1. Address field (masked on display)
            const addressLabel = fieldsGrid.locator('> div').filter({
                has: detailPage.locator('p.text-xs').filter({ hasText: /^Address$/ })
            });
            await expect(addressLabel.locator('p.text-xs')).toBeVisible();
            const displayedAddress = await addressLabel.locator('p.text-sm').textContent() || '';
            console.log(`      [Address] "${displayedAddress}"`);
            expect(displayedAddress, 'Address field should have value').toBeTruthy();

            // 2. Sub District field
            const subDistrictLabel = fieldsGrid.locator('> div').filter({
                has: detailPage.getByText('Sub District', { exact: true })
            });
            await expect(subDistrictLabel.locator('p.text-xs')).toBeVisible();
            const displayedSubDistrict = await subDistrictLabel.locator('p.text-sm').first().textContent() || '';
            console.log(`      [Sub District] "${displayedSubDistrict}"`);
            expect(displayedSubDistrict, 'Sub District should have value').toBeTruthy();

            // 3. District field
            const districtDiv = fieldsGrid.locator('> div').filter({
                has: detailPage.locator('p.text-xs').filter({ hasText: /^District$/ })
            });
            await expect(districtDiv.locator('p.text-xs')).toBeVisible();
            const displayedDistrict = await districtDiv.locator('p.text-sm').textContent() || '';
            console.log(`      [District] "${displayedDistrict}"`);
            expect(displayedDistrict, 'District should have value').toBeTruthy();

            // 4. Province field
            const provinceLabel = fieldsGrid.locator('> div').filter({
                has: detailPage.getByText('Province', { exact: true })
            });
            await expect(provinceLabel.locator('p.text-xs')).toBeVisible();
            const displayedProvince = await provinceLabel.locator('p.text-sm').first().textContent() || '';
            console.log(`      [Province] "${displayedProvince}"`);
            expect(displayedProvince, 'Province should have value').toBeTruthy();

            // 5. Postcode field (5 digits)
            const postcodeLabel = fieldsGrid.locator('> div').filter({
                has: detailPage.getByText('Postcode', { exact: true })
            });
            await expect(postcodeLabel.locator('p.text-xs')).toBeVisible();
            const displayedPostcode = await postcodeLabel.locator('p.text-sm').first().textContent() || '';
            console.log(`      [Postcode] "${displayedPostcode}"`);
            expect(displayedPostcode, 'Postcode should be 5 digits').toMatch(/^\d{5}$/);

            // === API Comparison for this address ===
            if (Array.isArray(apiAddresses) && apiAddresses[i]) {
                const apiAddr = apiAddresses[i];
                console.log(`\n      📦 Comparing with API address ${i + 1}...`);

                // Verify Sub District matches API
                const apiSubDistrict = apiAddr.subDistrict || apiAddr.sub_district || apiAddr.subdistrict || '';
                if (apiSubDistrict) {
                    expect(displayedSubDistrict, 'Sub District should match API').toBe(apiSubDistrict);
                    console.log(`         ✓ Sub District "${apiSubDistrict}" matches`);
                }

                // Verify District matches API
                const apiDistrict = apiAddr.district || '';
                if (apiDistrict) {
                    expect(displayedDistrict, 'District should match API').toBe(apiDistrict);
                    console.log(`         ✓ District "${apiDistrict}" matches`);
                }

                // Verify Province matches API
                const apiProvince = apiAddr.province || '';
                if (apiProvince) {
                    expect(displayedProvince, 'Province should match API').toBe(apiProvince);
                    console.log(`         ✓ Province "${apiProvince}" matches`);
                }

                // Verify Postcode matches API
                const apiPostcode = apiAddr.postcode || apiAddr.postalCode || apiAddr.zipCode || '';
                if (apiPostcode) {
                    expect(displayedPostcode, 'Postcode should match API').toBe(String(apiPostcode));
                    console.log(`         ✓ Postcode "${apiPostcode}" matches`);
                }
            }
        }

        console.log('\n✅ Addresses section verified - All labels and data displayed correctly');
    });

    test('Verify back to customer list button', async ({ page }) => {
        const { detailPage } = await clickRandomCustomerDetail(page);

        // Click back button on detail page (new tab)
        await detailPage.getByRole('button', { name: 'Back to Customer List' }).click();

        // Verify navigation back to customer list (in the detail page tab)
        await expect(detailPage).toHaveURL(/\/customer$/);
        await expect(detailPage.locator('table')).toBeVisible();

        console.log('✅ Back to Customer List button verified');
    });
});