// Creates, starts and stops the Android emulator for the mobile tests.
//
//   node scripts/emulator.js create   creates the AVD (only once)
//   node scripts/emulator.js start    starts it and waits for Android to finish booting
//   node scripts/emulator.js stop     shuts it down
//
// Uses ANDROID_HOME/JAVA_HOME detected in wdio.conf.js and the AVD from AVD_NAME (.env).
const { spawn, spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

require('../wdio.conf.js'); // loads .env and fills in ANDROID_HOME / JAVA_HOME / PATH

const SDK = process.env.ANDROID_HOME;
if (!SDK || !existsSync(SDK)) {
    console.error('Android SDK not found. Set ANDROID_HOME in .env.');
    process.exit(1);
}

const AVD = process.env.AVD_NAME || 'airtm_api34';
const IMAGE = process.env.AVD_IMAGE
    || (/playstore/i.test(AVD)
        ? 'system-images;android-34;google_apis_playstore;x86_64'
        : 'system-images;android-34;google_apis;x86_64');
const exe = (rel) => path.join(SDK, rel + (process.platform === 'win32' ? '.exe' : ''));
const EMULATOR = exe('emulator/emulator');
const ADB = exe('platform-tools/adb');
const AVDMANAGER = path.join(SDK, 'cmdline-tools', 'latest', 'bin',
    process.platform === 'win32' ? 'avdmanager.bat' : 'avdmanager');

const run = (cmd, args, opts = {}) =>
    spawnSync(cmd, args, { encoding: 'utf8', shell: cmd.endsWith('.bat'), ...opts });
const avdExists = () => run(EMULATOR, ['-list-avds']).stdout.split(/\r?\n/).includes(AVD);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function create() {
    if (avdExists()) return console.log(`Emulator "${AVD}" already exists.`);
    const r = run(AVDMANAGER, ['create', 'avd', '-n', AVD, '-k', `"${IMAGE}"`, '-d', 'pixel_6', '--force'],
        { input: 'no\n', stdio: ['pipe', 'inherit', 'inherit'] });
    if (r.status !== 0 || !avdExists()) {
        console.error(`Could not create "${AVD}". Is the image ${IMAGE} installed?`);
        process.exit(1);
    }
    tuneConfig();
    console.log(`Emulator "${AVD}" created.`);
}

// avdmanager creates the AVD with no GPU and 2 GB of RAM; with that, web views
// (e.g. the Google sign-in in Play Store) stay blank.
function tuneConfig() {
    const { readFileSync, writeFileSync } = require('node:fs');
    const avdHome = process.env.ANDROID_AVD_HOME
        || path.join(process.env.ANDROID_USER_HOME || path.join(require('node:os').homedir(), '.android'), 'avd');
    const file = path.join(avdHome, `${AVD}.avd`, 'config.ini');
    const wanted = {
        'hw.gpu.enabled': 'yes',
        'hw.gpu.mode': 'swiftshader_indirect',
        'hw.ramSize': '4096',
        'vm.heapSize': '512',
        'disk.dataPartition.size': '8G',
        'hw.keyboard': 'yes',
    };
    let ini = readFileSync(file, 'utf8');
    for (const [key, value] of Object.entries(wanted)) {
        const re = new RegExp(`^${key.replace(/\./g, '\\.')}=.*$`, 'm');
        ini = re.test(ini) ? ini.replace(re, `${key}=${value}`) : `${ini.trimEnd()}\n${key}=${value}\n`;
    }
    writeFileSync(file, ini);
}

async function start() {
    if (!avdExists()) await create();
    const child = spawn(EMULATOR, ['-avd', AVD, '-gpu', process.env.EMULATOR_GPU || 'swiftshader_indirect', '-no-boot-anim', '-no-audio'],
        { detached: true, stdio: 'ignore' });
    child.unref();
    console.log(`Starting "${AVD}"... (the first boot can take a few minutes)`);

    run(ADB, ['wait-for-device'], { timeout: 180000 });
    for (let i = 0; i < 120; i++) {
        if (run(ADB, ['shell', 'getprop', 'sys.boot_completed']).stdout.trim() === '1') {
            console.log('Emulator ready:');
            console.log(run(ADB, ['devices']).stdout.trim());
            return;
        }
        await sleep(3000);
    }
    console.error('The emulator did not finish booting within 6 minutes.');
    process.exit(1);
}

function stop() {
    run(ADB, ['emu', 'kill'], { stdio: 'inherit' });
}

const actions = { create, start, stop };
const action = actions[process.argv[2]];
if (!action) {
    console.error('Usage: node scripts/emulator.js <create|start|stop>');
    process.exit(1);
}
action();
