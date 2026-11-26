const path = require('node:path');
const { test, expect } = require('@playwright/test');

const EMAIL = process.env.AIRTM_EMAIL;
const PASSWORD = process.env.AIRTM_PASSWORD;

// The tests run in order and share one logged-in page, so the account logs in
// only once per run. Many logins in a row make AirTM show a CAPTCHA that
// blocks automation.
test.describe.configure({ mode: 'serial' });

let page;

test.beforeAll(async ({ browser }) => {
    if (!EMAIL || !PASSWORD) {
        throw new Error('AIRTM_EMAIL / AIRTM_PASSWORD are missing. Copy .env.example to .env and fill it in.');
    }
    page = await browser.newPage();
});

test.afterAll(async () => {
    await page?.close();
});

test('WEB-01 Log in to AirTM', async () => {
    await page.goto('/login');
    await page.getByLabel('Your email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 20000 });
});

test('WEB-02 Change profile picture', async () => {
    // Reuses the session from the login test.
    await page.goto('/settings/profile');
    await expect(page).toHaveURL(/\/settings\/profile/);

    // The file input is hidden, so it is set directly. The photo uploads right
    // away (there is no Save button).
    await page.setInputFiles('input#photo', path.join(__dirname, 'fixtures/avatar.png'));

    // After the upload, the avatar points to the uploaded file instead of the default image.
    await expect(page.locator('img.thumb--md.rounded-circle')).toHaveAttribute('src', /amazonaws\.com.*avatar/);
});

// Uses its own new page (no session).
test('WEB-03 Sign up a new user', async ({ page }) => {
    // Unique email per run so it is not rejected as a duplicate account.
    const email = EMAIL.replace('@', `+${Date.now()}@`);

    await page.goto('/login');
    await page.getByText('Create an account').click();
    await expect(page).toHaveURL(/\/sign-up/);

    // Step 1: country (searchable list) + account type
    await page.getByRole('combobox').fill('Bolivia');
    await page.getByRole('option', { name: 'Bolivia' }).click();
    await page.getByText('Personal', { exact: true }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: sign up with email
    await expect(page).toHaveURL(/\/sign-up\/account-credentials/);
    await page.getByRole('button', { name: 'Sign up with my email' }).click();

    // Step 3: account details
    await expect(page).toHaveURL(/\/sign-up\/account-information/);
    await page.getByLabel('Enter your email').fill(email);
    await page.locator('#password').fill(PASSWORD);
    await page.locator('#passwordConfirmation').fill(PASSWORD);
    await page.getByLabel('First name').fill('Marco');
    await page.getByLabel('Last name', { exact: true }).fill('Medina');

    // The form has a CAPTCHA that automation cannot solve, so the test stops
    // here. To complete sign-up, staging needs the CAPTCHA disabled for tests.
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
});
