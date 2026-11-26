const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { expect } = require('@wdio/globals');
const LoginPage = require('../pageobjects/login.page');

const ARTIFACTS = path.join(__dirname, '..', '..', 'logs');

// The app may point to a different environment than the web (e.g. the Play
// Store app is production), so it accepts its own credentials and falls back
// to the web ones.
const EMAIL = process.env.MOBILE_AIRTM_EMAIL || process.env.AIRTM_EMAIL;
const PASSWORD = process.env.MOBILE_AIRTM_PASSWORD || process.env.AIRTM_PASSWORD;

describe('AirTM app - Login', () => {
    before(() => {
        if (!EMAIL || !PASSWORD) {
            throw new Error('MOBILE_AIRTM_EMAIL/PASSWORD or AIRTM_EMAIL/PASSWORD are missing. Copy .env.example to .env and fill it in.');
        }
    });

    afterEach(async function () {
        // Saves a screenshot and the hierarchy of the final screen (useful for
        // debugging and for updating selectors).
        mkdirSync(ARTIFACTS, { recursive: true });
        const name = this.currentTest.state === 'passed' ? 'login-ok' : 'login-fail';
        await driver.saveScreenshot(path.join(ARTIFACTS, `${name}.png`)).catch(() => {});
        writeFileSync(path.join(ARTIFACTS, `${name}.xml`), await driver.getPageSource().catch(() => ''));
    });

    it('APP-01 Logs in with email and password', async () => {
        await LoginPage.login(EMAIL, PASSWORD);

        // If the app shows a CAPTCHA or rejects the credentials, it stays on
        // the password screen and this fails.
        await LoginPage.waitUntilLoggedIn(30000);
        // Positive check: the Home shows the balance and the Home tab.
        await LoginPage.goToHome();
        await expect(LoginPage.homeBalanceLabel).toBeDisplayed();
        await expect(LoginPage.homeTab).toBeDisplayed();
        expect(await driver.getCurrentPackage()).toBe('com.airtm.android');
    });
});
