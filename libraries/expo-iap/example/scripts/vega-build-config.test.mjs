import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createVegaManifest,
  loadVegaBuildEnvironment,
} from './vega-build-config.mjs';

test('loads Expo public IAPKit values from the normal environment file chain', () => {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'openiap-vega-env-'),
  );

  try {
    fs.writeFileSync(
      path.join(projectRoot, '.env'),
      [
        'EXPO_PUBLIC_AMAZON_RVS_SANDBOX=false',
        'EXPO_PUBLIC_IAPKIT_API_KEY=env-key',
        'EXPO_PUBLIC_IAPKIT_BASE_URL=http://env.example',
        '',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(projectRoot, '.env.local'),
      [
        'EXPO_PUBLIC_AMAZON_RVS_SANDBOX=true',
        'EXPO_PUBLIC_IAPKIT_API_KEY=local-key',
        'EXPO_PUBLIC_IAPKIT_BASE_URL=http://local.example',
        '',
      ].join('\n'),
    );

    const systemEnv = {};
    const result = loadVegaBuildEnvironment({
      buildType: 'Debug',
      projectRoot,
      systemEnv,
    });

    assert.deepEqual(result, {
      amazonRvsSandbox: 'true',
      iapkitApiKey: 'local-key',
      iapkitBaseUrl: 'http://local.example',
    });
  } finally {
    fs.rmSync(projectRoot, {force: true, recursive: true});
  }
});

test('keeps explicitly exported values ahead of environment files', () => {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'openiap-vega-env-'),
  );

  try {
    fs.writeFileSync(
      path.join(projectRoot, '.env.local'),
      [
        'EXPO_PUBLIC_AMAZON_RVS_SANDBOX=false',
        'EXPO_PUBLIC_IAPKIT_API_KEY=file-key',
        'EXPO_PUBLIC_IAPKIT_BASE_URL=http://file.example',
        '',
      ].join('\n'),
    );

    const systemEnv = {
      EXPO_PUBLIC_AMAZON_RVS_SANDBOX: 'true',
      EXPO_PUBLIC_IAPKIT_API_KEY: 'exported-key',
      EXPO_PUBLIC_IAPKIT_BASE_URL: 'http://exported.example',
    };
    const result = loadVegaBuildEnvironment({
      buildType: 'Debug',
      projectRoot,
      systemEnv,
    });

    assert.deepEqual(result, {
      amazonRvsSandbox: 'true',
      iapkitApiKey: 'exported-key',
      iapkitBaseUrl: 'http://exported.example',
    });
  } finally {
    fs.rmSync(projectRoot, {force: true, recursive: true});
  }
});

test('declares the Vega UI sound service alongside the IAP services', () => {
  const manifest = createVegaManifest({
    componentId: 'dev.hyo.example.main',
    displayName: 'Example',
    packageId: 'dev.hyo.example',
  });

  assert.match(manifest, /id = "com\.amazon\.audio\.system"/);
  assert.match(manifest, /id = "com\.amazon\.audio\.control"/);
  assert.match(manifest, /id = "com\.amazon\.iap\.core\.service"/);
  assert.match(manifest, /id = "com\.amazon\.iap\.tester\.service"/);
});
