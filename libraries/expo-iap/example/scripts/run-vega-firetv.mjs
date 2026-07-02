import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exampleRoot = path.resolve(__dirname, '..');
const packageFile = path.join(
  exampleRoot,
  'build/armv7-debug/expoiapvegaexample_armv7.vpkg',
);
const packageId = 'dev.hyo.openiap.expo.example';
const appId = 'dev.hyo.openiap.expo.example.main';
const appTesterPackageId = 'com.amazonappstore.iap.tester';
const appTesterUi = 'pkg://com.amazonappstore.iap.tester.ui';
const tcpDevicePattern = /^.+:\d+$/;
const shouldLaunchAppTesterUi = process.env.VEGA_LAUNCH_APP_TESTER_UI === '1';

const run = (args, options = {}) => {
  try {
    return execFileSync('vega', args, {
      cwd: exampleRoot,
      encoding: options.encoding,
      stdio: options.encoding ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      timeout: options.timeout,
    });
  } catch (error) {
    if (options.allowFailure) return '';
    throw error;
  }
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findFirstVegaDeviceId = (output) => {
  for (const line of output.split(/\r?\n/)) {
    const match = line.trim().match(/^(\S+)\s+:/);
    if (match) return match[1];
  }

  return undefined;
};

const resolveDeviceId = () => {
  if (process.env.VEGA_DEVICE_ID) return process.env.VEGA_DEVICE_ID;

  const deviceListOutput = run(['device', 'list'], {
    allowFailure: true,
    encoding: 'utf8',
  });
  const vegaDeviceId = findFirstVegaDeviceId(deviceListOutput);
  if (vegaDeviceId) return vegaDeviceId;

  const output = run(['exec', 'vda', 'devices'], {encoding: 'utf8'});
  const deviceLine = output
    .split(/\r?\n/)
    .find((line) => /\sdevice$/.test(line.trim()));
  const deviceId = deviceLine?.trim().split(/\s+/)[0];

  if (!deviceId) {
    throw new Error(
      'No Vega device found. Connect a Fire TV device or set VEGA_DEVICE_ID.',
    );
  }

  return deviceId;
};

const sleep = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const canReachTcpDevice = (deviceId) =>
  new Promise((resolve) => {
    if (!tcpDevicePattern.test(deviceId)) {
      resolve(true);
      return;
    }

    const [host, portText] = deviceId.split(/:(?=\d+$)/);
    const socket = new net.Socket();
    let resolved = false;
    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1500);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
    socket.connect(Number(portText), host);
  });

const isDeviceReady = (deviceId) => {
  const output = run(['exec', 'vda', 'devices'], {
    allowFailure: true,
    encoding: 'utf8',
  });

  return output
    .split(/\r?\n/)
    .some((line) => line.trim() === `${deviceId}\tdevice`);
};

const waitForDevice = async (deviceId) => {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    if (isDeviceReady(deviceId)) return;

    run(['exec', 'vda', 'reconnect', 'offline'], {allowFailure: true});
    if (
      tcpDevicePattern.test(deviceId) &&
      (await canReachTcpDevice(deviceId))
    ) {
      run(['exec', 'vda', 'disconnect', deviceId], {allowFailure: true});
      run(['exec', 'vda', 'connect', deviceId], {allowFailure: true});
    }
    await sleep(2000);
  }

  throw new Error(
    `Vega device ${deviceId} is not connected. Confirm the Fire TV is powered on, Developer Mode is enabled, and VDA is available.`,
  );
};

const shell = (deviceId, args, options = {}) => {
  run(['exec', 'vda', '-s', deviceId, 'shell', ...args], options);
};

const shellOutput = (deviceId, args) =>
  run(['exec', 'vda', '-s', deviceId, 'shell', ...args], {
    allowFailure: true,
    encoding: 'utf8',
  });

const pushToDevice = (deviceId, source, destination) => {
  run(['exec', 'vda', '-s', deviceId, 'push', source, destination]);
};

const copyToDevice = (deviceId, source, destinationDirectory, options = {}) => {
  run([
    'device',
    'copy-to',
    '-d',
    deviceId,
    '-s',
    source,
    '-o',
    destinationDirectory,
  ], options);
};

if (!fs.existsSync(packageFile)) {
  throw new Error(
    `Missing ${path.relative(exampleRoot, packageFile)}. Run bun run build:vega:debug first.`,
  );
}

const deviceId = resolveDeviceId();
await waitForDevice(deviceId);
const appTesterCatalog = path.join(exampleRoot, 'amazon.sdktester.json');
const appSandboxConfig = path.join(exampleRoot, 'amazon.config.json');
const launchApp = () => {
  run(['device', '-d', deviceId, 'launch-app', '--appName', appId], {
    allowFailure: true,
  });
};
const cancelQueuedInstalls = () => {
  const output = shellOutput(deviceId, ['vpm', 'query-installs']);
  const packageBaseName = path.basename(packageFile, '.vpkg');
  const tokenPattern = new RegExp(
    `InstallRequestStatus token: (\\S*${escapeRegExp(packageBaseName)}\\S*) status: REQUEST_ENQUEUED`,
    'g',
  );
  const tokens = new Set(
    [...output.matchAll(tokenPattern)].map((match) => match[1]),
  );

  for (const token of tokens) {
    shell(deviceId, ['vpm', 'cancel-download', token, '--timeout=5'], {
      allowFailure: true,
    });
  }
};
const installApp = () => {
  try {
    run(['device', '-d', deviceId, 'install-app', '--packagePath', packageFile], {
      timeout: 90000,
    });
    return;
  } catch (error) {
    console.warn(
      'vega device install-app failed; retrying with vpm install-async.',
    );
  }

  cancelQueuedInstalls();
  const remotePackageFile = `/tmp/${path.basename(packageFile)}`;
  const token = `${path.basename(packageFile, '.vpkg')}_${Date.now()}`;
  pushToDevice(deviceId, packageFile, remotePackageFile);
  shell(deviceId, [
    'vpm',
    'install-async',
    remotePackageFile,
    `--token=${token}`,
    '--timeout=60',
    '--high-priority',
    '--force',
    '--update-max-timeout=5',
    '--terminate-on-max-timeout',
  ]);
  shell(deviceId, ['vpm', 'query-installs', `--token=${token}`], {
    allowFailure: true,
  });
};
const submitParentalPin = () => {
  if (!process.env.VEGA_PARENTAL_PIN) return;

  for (const digit of process.env.VEGA_PARENTAL_PIN) {
    shell(deviceId, ['inputd-cli', 'button_press', `KEY_${digit}`], {
      allowFailure: true,
    });
  }
};

run(['device', '-d', deviceId, 'terminate-app', '--appName', appId], {
  allowFailure: true,
});
run(['device', '-d', deviceId, 'uninstall-app', '--appName', appId], {
  allowFailure: true,
});

shell(
  deviceId,
  [
    'mkdir',
    '-p',
    `/tmp/scratch/${appTesterPackageId}`,
    `/tmp/scratch/${packageId}`,
    `/tmp/scratch/${appId}`,
  ],
  {
    allowFailure: true,
    encoding: 'utf8',
  },
);
copyToDevice(deviceId, appTesterCatalog, `/tmp/scratch/${appTesterPackageId}`);
copyToDevice(deviceId, appSandboxConfig, `/tmp/scratch/${packageId}`, {
  allowFailure: true,
  encoding: 'utf8',
});
copyToDevice(deviceId, appSandboxConfig, `/tmp/scratch/${appId}`);

shell(
  deviceId,
  ['vlcm', 'terminate-app', '--pkg-id', appTesterPackageId, '--force'],
  {
    allowFailure: true,
  },
);
if (shouldLaunchAppTesterUi) {
  shell(deviceId, ['vlcm', 'launch-app', appTesterUi], {allowFailure: true});
}
installApp();
launchApp();
submitParentalPin();
