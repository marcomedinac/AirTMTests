const { existsSync } = require('node:fs');
const path = require('node:path');

// Loads the configuration from .env (see .env.example).
const envFile = path.join(__dirname, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Appium needs JAVA_HOME and ANDROID_HOME. If they are not set (neither in the
// system nor in .env), the usual Windows install paths are used.
const firstExisting = (...dirs) => dirs.find((d) => d && existsSync(d));
if (!process.env.ANDROID_HOME) {
    const sdk = firstExisting(
        process.env.ANDROID_SDK_ROOT,
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    );
    if (sdk) process.env.ANDROID_HOME = sdk;
}
if (!process.env.JAVA_HOME) {
    const adoptium = 'C:\\Program Files\\Eclipse Adoptium';
    const jdk = existsSync(adoptium)
        ? require('node:fs').readdirSync(adoptium).find((d) => d.startsWith('jdk-17'))
        : undefined;
    const java = firstExisting(
        jdk && path.join(adoptium, jdk),
        'C:\\Program Files\\Android\\Android Studio\\jbr',
    );
    if (java) process.env.JAVA_HOME = java;
}
if (process.env.ANDROID_HOME) {
    // So Appium can find adb.
    process.env.PATH = `${path.join(process.env.ANDROID_HOME, 'platform-tools')}${path.delimiter}${process.env.PATH}`;
}

exports.config = {
    runner: 'local',
    specs: ['./test/specs/**/*.e2e.js'],
    maxInstances: 1,

    // WebdriverIO starts Appium automatically (no need to launch it separately).
    services: [['appium', { command: 'appium', args: { log: './logs/appium.log' } }]],

    capabilities: [{
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:deviceName': process.env.DEVICE_NAME || 'emulator-5554',
        // Two modes:
        //  - APP_PACKAGE set: opens the app already installed on the device
        //    (e.g. the Play Store one). Its data is cleared at start so it
        //    launches logged out, but it is not uninstalled.
        //  - Otherwise: installs the APK from APP_PATH.
        ...(process.env.APP_PACKAGE
            ? {
                'appium:appPackage': process.env.APP_PACKAGE,
                ...(process.env.APP_ACTIVITY && { 'appium:appActivity': process.env.APP_ACTIVITY }),
            }
            : { 'appium:app': path.resolve(__dirname, process.env.APP_PATH || './apps/airtm-staging.apk') }),
        'appium:autoGrantPermissions': true,
        'appium:fullReset': false,
        'appium:noReset': false,
        'appium:newCommandTimeout': 240,
    }],

    logLevel: 'warn',
    waitforTimeout: 15000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 2,

    framework: 'mocha',
    reporters: ['spec'],
    mochaOpts: { ui: 'bdd', timeout: 300000 },
};
