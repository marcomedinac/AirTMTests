# AirTM E2E Tests

Automated tests for AirTM:

- **Web** (staging, `app.stg.airtm.io`) with [Playwright](https://playwright.dev).
- **Android** with Appium (UiAutomator2) and WebdriverIO. Runs against the staging APK or the Play Store app (production).

## Test cases

### Web — [tests/airtm.spec.js](tests/airtm.spec.js)

The three tests run in order and share one session, so repeated logins don't trigger the CAPTCHA.

| ID | Case | Steps | Expected result |
|---|---|---|---|
| WEB-01 | Log in | Go to `/login`, enter email and password, click "Log in". | The URL reaches `/home`. |
| WEB-02 | Change profile picture | With the WEB-01 session, go to `/settings/profile` and upload `tests/fixtures/avatar.png`. | The avatar points to the uploaded image (S3). |
| WEB-03 | Sign up a new user | From `/login` → "Create an account" → country Bolivia, Personal account → "Sign up with my email" → fill in a unique email, password and name. | The "Create account" button is visible. The test stops there because of the CAPTCHA. |

### Android — [test/specs/login.e2e.js](test/specs/login.e2e.js)

| ID | Case | Steps | Expected result |
|---|---|---|---|
| APP-01 | Log in with email and password | Open the app (logged out), accept permissions → "Log in" → email → "Continue" → password → "Log in". Dismiss the passkey prompt and "Organize your homescreen". | The Home shows "USDC Balance" and the "Home" tab. Fails if the app shows a login error. |

If AirTM asks to "VERIFY YOUR DEVICE" (emailed code, the first time on a new device), the test waits up to `DEVICE_VERIFY_WAIT` seconds for someone to type the code on the emulator.

Selectors live in [test/pageobjects/login.page.js](test/pageobjects/login.page.js). The app uses Jetpack Compose without `resource-id`, so elements are located by text.

## Requirements

- Node.js 22 or newer.
- An AirTM staging account (web). For Android with the Play Store app, a production account.
- For Android: Java JDK 17 and the Android SDK (`platform-tools`, `build-tools`, `emulator`).

## Setup

```bash
npm install
npx playwright install chromium
npm run setup:mobile        # Appium UiAutomator2 driver
```

Copy `.env.example` to `.env` and fill it in. The minimum:

```
AIRTM_EMAIL=your-email@example.com        # web (staging)
AIRTM_PASSWORD=your-password
MOBILE_AIRTM_EMAIL=                       # optional: app, if it uses another environment
MOBILE_AIRTM_PASSWORD=
```

`.env` is not committed to the repository.

## Running

```bash
npm test               # web tests
npm run test:headed    # web, watching the browser
npm run test:ui        # web, interactive mode
npm run report         # HTML report of the last web run

npm run doctor:mobile  # checks that Appium has everything it needs
npm run test:mobile    # Android test (with the emulator running)
```

`wdio.conf.js` detects `JAVA_HOME` and `ANDROID_HOME` on its own if they are in the usual Windows paths; otherwise set them in `.env`. On every run, the Android test saves a screenshot and the XML of the final screen to `logs/`.

## Android: which app to use

| Mode | `.env` settings | Emulator |
|---|---|---|
| Staging APK | `APP_PATH=./apps/airtm-staging.apk`, `APP_PACKAGE` empty | `airtm_api34` (no Play Store) |
| Play Store app (production) | `APP_PACKAGE=com.airtm.android`, `APP_ACTIVITY=.presentation.ui.activity.SplashActivity` | `airtm_playstore_api34` (with Play Store) |

With the production app the account is real: do not automate money operations.

### Emulator

```bash
npm run emulator:create   # creates the AVD from AVD_NAME (only the first time)
npm run emulator:start    # starts it and waits for Android to boot
npm run emulator:stop     # shuts it down
```

It uses Android 14 (API 34). For the Play Store emulator, first install the `system-images;android-34;google_apis_playstore;x86_64` image and sign in to Play Store inside the emulator.

The GPU mode is set with `EMULATOR_GPU` (default `swiftshader_indirect`). On some Intel GPUs, `host` stops drawing after a while (blank screen or missing text); with no GPU, web views (like the Google sign-in) stay blank.

## Known limitations

- **CAPTCHA on web login:** many logins in a row make AirTM show a CAPTCHA (Geetest). If it shows up, wait a while.
- **CAPTCHA on sign-up:** sign-up always has a CAPTCHA, so WEB-03 does not create the account.
- **WEB-02 changes the real photo** of the account used.
- **APP-01 clears the app data** at start, so it launches logged out.
