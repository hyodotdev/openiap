#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

function parseArgs(argv) {
  const options = {
    packagePath: null,
    packageName: null,
    required: [],
    forbid: [],
    packIgnoreScripts: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--package') {
      options.packagePath = argv[++i];
    } else if (arg === '--package-name') {
      options.packageName = argv[++i];
    } else if (arg === '--required') {
      options.required.push(argv[++i]);
    } else if (arg === '--forbid') {
      options.forbid.push(argv[++i]);
    } else if (arg === '--pack-ignore-scripts') {
      options.packIgnoreScripts = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.packagePath) throw new Error('Missing --package');
  if (!options.packageName) throw new Error('Missing --package-name');
  return options;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const verbose = process.env.OPENIAP_VERBOSE_NPM_CONSUMER_SMOKE;
  if (verbose && result.stdout) process.stdout.write(result.stdout);
  if (verbose && result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    if (!verbose && result.stdout) process.stdout.write(result.stdout);
    if (!verbose && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
  return result.stdout;
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function parseNpmPackJson(stdout) {
  const clean = stripAnsi(stdout).trim();
  for (let index = clean.lastIndexOf('['); index >= 0; index = clean.lastIndexOf('[', index - 1)) {
    try {
      const parsed = JSON.parse(clean.slice(index));
      if (Array.isArray(parsed) && parsed[0]?.filename) return parsed[0];
    } catch {
      // Keep scanning; package lifecycle scripts can print arbitrary output.
    }
  }
  throw new Error('Unable to parse npm pack --json output');
}

function assertFile(filePath, label = filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}`);
  }
}

function packageInstallDir(consumerRoot, packageName) {
  if (packageName.startsWith('@')) {
    const [scope, name] = packageName.split('/');
    return path.join(consumerRoot, 'node_modules', scope, name);
  }
  return path.join(consumerRoot, 'node_modules', packageName);
}

function collectExportPaths(value, paths = []) {
  if (typeof value === 'string') {
    if (value.startsWith('./')) paths.push(value.slice(2));
    return paths;
  }
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) collectExportPaths(nested, paths);
  }
  return paths;
}

function listFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFiles(fullPath));
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result;
}

function prepareVersionFile(packageRoot) {
  const versionFile = path.join(packageRoot, 'openiap-versions.json');
  if (!fs.existsSync(versionFile)) return () => {};

  const stat = fs.lstatSync(versionFile);
  if (!stat.isSymbolicLink()) return () => {};

  const target = fs.readlinkSync(versionFile);
  const resolvedTarget = path.resolve(path.dirname(versionFile), target);
  fs.rmSync(versionFile);
  fs.copyFileSync(resolvedTarget, versionFile);

  return () => {
    fs.rmSync(versionFile, {force: true});
    fs.symlinkSync(target, versionFile);
  };
}

function validateInstalledPackage(installedRoot, options) {
  const packageJsonPath = path.join(installedRoot, 'package.json');
  assertFile(packageJsonPath, 'installed package.json');

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.name !== options.packageName) {
    throw new Error(`Installed package name ${packageJson.name} does not match ${options.packageName}`);
  }

  for (const field of ['main', 'types']) {
    if (packageJson[field]) {
      assertFile(path.join(installedRoot, packageJson[field]), `${field} target ${packageJson[field]}`);
    }
  }

  if (packageJson.exports) {
    const exportPaths = [...new Set(collectExportPaths(packageJson.exports))];
    for (const exportPath of exportPaths) {
      assertFile(path.join(installedRoot, exportPath), `export target ${exportPath}`);
    }
  }

  for (const requiredPath of options.required) {
    assertFile(path.join(installedRoot, requiredPath), requiredPath);
  }

  const versionFile = path.join(installedRoot, 'openiap-versions.json');
  if (fs.existsSync(versionFile)) {
    const stat = fs.lstatSync(versionFile);
    if (stat.isSymbolicLink()) {
      throw new Error('openiap-versions.json must be packed as a real file, not a symlink');
    }
    const versions = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    for (const key of ['spec', 'google', 'apple']) {
      if (typeof versions[key] !== 'string' || versions[key].length === 0) {
        throw new Error(`openiap-versions.json is missing ${key}`);
      }
    }
  }

  if (options.forbid.length > 0) {
    for (const filePath of listFiles(installedRoot)) {
      const buffer = fs.readFileSync(filePath);
      if (buffer.includes(0)) continue;
      const text = buffer.toString('utf8');
      for (const pattern of options.forbid) {
        if (text.includes(pattern)) {
          const relativePath = path.relative(installedRoot, filePath);
          throw new Error(`Packed package must not include ${JSON.stringify(pattern)} in ${relativePath}`);
        }
      }
    }
  }
}

const options = parseArgs(process.argv.slice(2));
const packageRoot = path.resolve(process.cwd(), options.packagePath);
const sourcePackageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
if (sourcePackageJson.name !== options.packageName) {
  throw new Error(`${packageRoot} package name ${sourcePackageJson.name} does not match ${options.packageName}`);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `${options.packageName.replaceAll('/', '-')}-consumer-`));
const restoreVersionFile = prepareVersionFile(packageRoot);

try {
  const packArgs = ['pack', '--json', '--pack-destination', tempRoot];
  if (options.packIgnoreScripts) packArgs.push('--ignore-scripts');
  const packOutput = run('npm', packArgs, packageRoot);
  const packInfo = parseNpmPackJson(packOutput);
  const tarballPath = path.isAbsolute(packInfo.filename)
    ? packInfo.filename
    : path.join(tempRoot, packInfo.filename);
  assertFile(tarballPath, 'packed npm tarball');

  const consumerRoot = path.join(tempRoot, 'consumer');
  fs.mkdirSync(consumerRoot);
  fs.writeFileSync(
    path.join(consumerRoot, 'package.json'),
    `${JSON.stringify({
      name: `${options.packageName.replaceAll('/', '-')}-consumer-smoke`,
      private: true,
      type: 'module',
      dependencies: {
        [options.packageName]: `file:${tarballPath}`,
      },
    }, null, 2)}\n`,
  );

  run('npm', [
    'install',
    '--ignore-scripts',
    '--legacy-peer-deps',
    '--no-audit',
    '--no-fund',
    '--no-package-lock',
  ], consumerRoot);

  const installedRoot = packageInstallDir(consumerRoot, options.packageName);
  validateInstalledPackage(installedRoot, options);
  console.log(`${options.packageName} consumer install smoke test passed.`);
} finally {
  restoreVersionFile();
  if (!process.env.OPENIAP_KEEP_NPM_CONSUMER_SMOKE_TMP) {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}
