// Page Object for the login of the AirTM Android app (com.airtm.android 23.3.x).
//
// Actual app flow (verified on the emulator):
//   Welcome  -> "Log in" (top right)
//   Step 1   -> "Email" field + "Continue" button
//   Step 2   -> "Password" field (EditText with password=true) + "Log in" button
//
// The app is built with Jetpack Compose and does not expose resource-id or
// accessibility id on these elements, so they are located by text.

const byText = (text) => $(`android=new UiSelector().text("${text}")`);

class LoginPage {
    // --- Welcome ---
    get btnGoToLogin() { return byText('Log in'); }
    get welcomeCreateAccount() { return byText('Create an account'); }

    // --- Step 1: email ---
    get titleWelcomeBack() { return byText('WELCOME BACK'); }
    get inputEmail() { return $('android=new UiSelector().className("android.widget.EditText").instance(0)'); }
    get btnContinue() { return byText('Continue'); }

    // --- Step 2: password ---
    get inputPassword() { return $('//android.widget.EditText[@password="true"]'); }
    get btnLogin() { return byText('Log in'); }
    get linkForgotPassword() { return byText('Forgot your password?'); }

    // System permission dialogs (location, notifications) the app asks for on
    // launch. Appium usually grants them, but just in case they show up.
    get btnAllowPermission() {
        return $('android=new UiSelector().resourceIdMatches("com.android.permissioncontroller:id/permission_allow.*button")');
    }

    async acceptPermissionDialogs() {
        for (let i = 0; i < 3; i++) {
            if (!(await this.btnAllowPermission.isExisting())) return;
            await this.btnAllowPermission.click();
            await driver.pause(500);
        }
    }

    async openLogin() {
        // The first screen can take a while (splash) and show permission dialogs.
        await driver.waitUntil(async () => {
            await this.acceptPermissionDialogs();
            return (await this.welcomeCreateAccount.isExisting()) || (await this.titleWelcomeBack.isExisting());
        }, { timeout: 30000, timeoutMsg: 'Neither the welcome screen nor the login screen appeared' });

        if (!(await this.titleWelcomeBack.isExisting())) {
            await this.btnGoToLogin.click();
        }
        await this.inputEmail.waitForDisplayed();
    }

    async login(email, password) {
        await this.openLogin();

        await this.inputEmail.setValue(email);
        await driver.hideKeyboard().catch(() => {});
        await this.btnContinue.click();

        await this.inputPassword.waitForDisplayed({ timeout: 20000 });
        await this.inputPassword.setValue(password);
        await driver.hideKeyboard().catch(() => {});
        await this.btnLogin.click();
    }

    // Message (snackbar) the app shows when it rejects the login. Also matches
    // Spanish wording in case the device language is Spanish.
    get loginError() {
        return $('android=new UiSelector().textMatches("(?i).*(incorrect|invalid|incorrect[ao]s?|try again|intenta).*")');
    }

    // --- Home (logged in) ---
    get homeBalanceLabel() { return $('android=new UiSelector().textMatches(".* Balance")'); }
    get homeTab() { return byText('Home'); }

    // Optional screens the app offers right after login (e.g. "Smart login,
    // trusted security" to enable passkeys). They are declined.
    get btnDeclinePrompt() {
        return $('android=new UiSelector().textMatches("(?i)no, thanks|not now|maybe later|skip|later")');
    }

    // Confirmation "Do you want to cancel secure login setup?" -> "Yes".
    get cancelSecureLoginTitle() { return $('android=new UiSelector().textStartsWith("Do you want to cancel")'); }
    get btnConfirmYes() { return byText('Yes'); }

    // "ORGANIZE YOUR HOMESCREEN" card that covers the Home (while it is shown,
    // the rest of the screen is not accessible). Its "X" is a Button with no
    // text or content-desc, so the Button sibling of the title is used.
    get organizeHomeTitle() { return byText('ORGANIZE YOUR HOMESCREEN'); }
    get btnCloseOverlay() { return $('//*[@text="ORGANIZE YOUR HOMESCREEN"]/preceding-sibling::android.widget.Button'); }

    // Dismisses the post-login prompts until the Home is reached.
    async goToHome(timeout = 45000) {
        await driver.waitUntil(async () => {
            if (await this.homeBalanceLabel.isExisting()) return true;
            await this.acceptPermissionDialogs();
            if (await this.organizeHomeTitle.isExisting()) {
                await this.btnCloseOverlay.click();
            } else if (await this.cancelSecureLoginTitle.isExisting()) {
                await this.btnConfirmYes.click();
            } else if (await this.btnDeclinePrompt.isExisting()) {
                await this.btnDeclinePrompt.click();
            }
            return false;
        }, { timeout, interval: 1500, timeoutMsg: 'The Home screen was not reached after login' });
    }

    // "VERIFY YOUR DEVICE" sheet: AirTM shows it when logging in from an
    // unknown device/IP and emails a 6-digit code.
    get verifyDeviceTitle() { return byText('VERIFY YOUR DEVICE'); }

    // Screens that belong to the login flow. While any of them is visible, the
    // user is not logged in yet.
    async isOnLoginFlow() {
        for (const el of [this.inputPassword, this.titleWelcomeBack, this.welcomeCreateAccount, this.verifyDeviceTitle]) {
            if (await el.isExisting()) return true;
        }
        return false;
    }

    // Waits for the login result:
    //  - error message        -> fails with that message
    //  - device verification  -> waits for someone to type the code on the
    //    emulator (up to DEVICE_VERIFY_WAIT seconds; 0 = fail right away)
    //  - no login screen for `stableMs` -> login succeeded
    async waitUntilLoggedIn(timeout = 30000, stableMs = 5000) {
        const verifyWait = Number(process.env.DEVICE_VERIFY_WAIT ?? 180) * 1000;
        let end = Date.now() + timeout;
        let verifyNotified = false;
        let goneSince = null;
        while (Date.now() < end) {
            if (await this.loginError.isExisting()) {
                throw new Error(`The app rejected the login: "${await this.loginError.getText()}"`);
            }
            if (await this.verifyDeviceTitle.isExisting() && !verifyNotified) {
                if (!verifyWait) {
                    throw new Error('AirTM asked to verify the device (code sent by email). Type it on the emulator or set DEVICE_VERIFY_WAIT.');
                }
                verifyNotified = true;
                end = Date.now() + verifyWait;
                console.log(`\n>>> AirTM asked to verify the device. Type the code from your email on the emulator (waiting ${verifyWait / 1000}s)...\n`);
            }
            if (await this.isOnLoginFlow()) {
                goneSince = null;
            } else {
                goneSince ??= Date.now();
                if (Date.now() - goneSince >= stableMs) return;
            }
            await driver.pause(1000);
        }
        if (await this.verifyDeviceTitle.isExisting()) {
            throw new Error('The device verification code was not entered in time.');
        }
        throw new Error('Login did not finish: still on a login flow screen (CAPTCHA or no response?).');
    }
}

module.exports = new LoginPage();
