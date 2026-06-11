#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

function readArgValue(argv, index, flag) {
  const value = argv[index + 1];
  if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function readBooleanEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0) return false;
  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function consumerPackageName(packageName) {
  return `${packageName.replace(/^@/, '').replaceAll('/', '-')}-consumer-smoke`;
}

function readJsonObject(filePath, label) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is not a valid JSON object`);
  }
  return value;
}

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
      options.packagePath = readArgValue(argv, i, arg);
      i += 1;
    } else if (arg === '--package-name') {
      options.packageName = readArgValue(argv, i, arg);
      i += 1;
    } else if (arg === '--required') {
      options.required.push(readArgValue(argv, i, arg));
      i += 1;
    } else if (arg === '--forbid') {
      options.forbid.push(readArgValue(argv, i, arg));
      i += 1;
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
    shell: process.platform === 'win32',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`Failed to execute ${command} ${args.join(' ')}: ${result.error.message}`);
  }
  const verbose = readBooleanEnv('OPENIAP_VERBOSE_NPM_CONSUMER_SMOKE');
  if (verbose && result.stdout) process.stdout.write(result.stdout);
  if (verbose && result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0 || result.signal) {
    if (!verbose && result.stdout) process.stdout.write(result.stdout);
    if (!verbose && result.stderr) process.stderr.write(result.stderr);
    const reason = result.signal ? `signal ${result.signal}` : `exit code ${result.status}`;
    throw new Error(`${command} ${args.join(' ')} failed with ${reason}`);
  }
  return result.stdout;
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function isJsonArrayCandidate(value, index) {
  for (let i = index + 1; i < value.length; i += 1) {
    if (/\s/.test(value[i])) continue;
    return value[i] === '{';
  }
  return false;
}

function findJsonArrayEnd(value, start) {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < value.length; i += 1) {
    const char = value[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '[') {
      depth += 1;
    } else if (char === ']' && depth > 0) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }

  return -1;
}

function findJsonArrayRanges(value) {
  const ranges = [];
  for (let start = value.indexOf('['); start !== -1; start = value.indexOf('[', start + 1)) {
    if (!isJsonArrayCandidate(value, start)) continue;
    const end = findJsonArrayEnd(value, start);
    if (end !== -1) ranges.push([start, end]);
  }
  return ranges;
}

function parseNpmPackJson(stdout) {
  const clean = stripAnsi(stdout).trim();
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed) && parsed[0]?.filename) return parsed[0];
  } catch {
    // Keep scanning; package lifecycle scripts can print arbitrary output.
  }

  const ranges = findJsonArrayRanges(clean);
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const [start, end] = ranges[i];
    try {
      const parsed = JSON.parse(clean.slice(start, end));
      if (Array.isArray(parsed) && parsed[0]?.filename) return parsed[0];
    } catch {
      // Keep scanning; package lifecycle scripts can print arbitrary output.
    }
  }
  throw new Error('Unable to parse npm pack --json output');
}

function assertFile(filePath, label = filePath) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Missing ${label}`);
    }
    throw error;
  }
  if (stat.isSymbolicLink()) {
    throw new Error(`${label} must be a real file, not a symlink`);
  }
  if (!stat.isFile()) {
    throw new Error(`${label} must be a file`);
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
  const isSymlink = stat.isSymbolicLink();
  let target = null;
  let originalContent = null;
  if (isSymlink) {
    target = fs.readlinkSync(versionFile);
  } else if (stat.isFile()) {
    originalContent = fs.readFileSync(versionFile);
    const content = originalContent.toString('utf8').trim();
    if (content.startsWith('.') && content.endsWith('.json') && !content.includes('\n')) {
      target = content;
    }
  }
  if (!target) return () => {};

  const resolvedTarget = path.resolve(path.dirname(versionFile), target);
  try {
    fs.rmSync(versionFile);
    fs.copyFileSync(resolvedTarget, versionFile);
  } catch (error) {
    try {
      fs.rmSync(versionFile, {force: true});
      if (isSymlink) {
        fs.symlinkSync(target, versionFile);
      } else {
        fs.writeFileSync(versionFile, originalContent);
      }
    } catch {
      // Preserve the original failure; the restore attempt is best-effort.
    }
    throw error;
  }

  return () => {
    fs.rmSync(versionFile, {force: true});
    if (isSymlink) {
      fs.symlinkSync(target, versionFile);
    } else {
      fs.writeFileSync(versionFile, originalContent);
    }
  };
}

function validateInstalledPackage(installedRoot, options) {
  const packageJsonPath = path.join(installedRoot, 'package.json');
  assertFile(packageJsonPath, 'installed package.json');

  const packageJson = readJsonObject(packageJsonPath, 'installed package.json');
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
      if (exportPath.includes('*')) continue;
      assertFile(path.join(installedRoot, exportPath), `export target ${exportPath}`);
    }
  }

  for (const requiredPath of options.required) {
    assertFile(path.join(installedRoot, requiredPath), requiredPath);
  }

  const versionFile = path.join(installedRoot, 'openiap-versions.json');
  try {
    const stat = fs.lstatSync(versionFile);
    if (stat.isSymbolicLink()) {
      throw new Error('openiap-versions.json must be packed as a real file, not a symlink');
    }
    if (!stat.isFile()) {
      throw new Error('openiap-versions.json must be a file');
    }
    const versions = readJsonObject(versionFile, 'openiap-versions.json');
    for (const key of ['spec', 'google', 'apple']) {
      if (typeof versions[key] !== 'string' || versions[key].trim().length === 0) {
        throw new Error(`openiap-versions.json is missing ${key}`);
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
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
const sourcePackageJson = readJsonObject(path.join(packageRoot, 'package.json'), `${packageRoot}/package.json`);
if (sourcePackageJson.name !== options.packageName) {
  throw new Error(`${packageRoot} package name ${sourcePackageJson.name} does not match ${options.packageName}`);
}

let tempRoot = null;
let restoreVersionFile = () => {};
let success = false;

try {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `${options.packageName.replaceAll('/', '-')}-consumer-`));
  restoreVersionFile = prepareVersionFile(packageRoot);

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
  const relativeTarballPath = path.relative(consumerRoot, tarballPath).split(path.sep).join(path.posix.sep);
  fs.writeFileSync(
    path.join(consumerRoot, 'package.json'),
    `${JSON.stringify({
      name: consumerPackageName(options.packageName),
      private: true,
      type: 'module',
      dependencies: {
        [options.packageName]: `file:${relativeTarballPath}`,
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
  success = true;
} finally {
  let restoreError = null;
  try {
    restoreVersionFile();
  } catch (error) {
    restoreError = error;
    console.error('Failed to restore version file:', error);
  }
  if (tempRoot && !readBooleanEnv('OPENIAP_KEEP_NPM_CONSUMER_SMOKE_TMP')) {
    try {
      fs.rmSync(tempRoot, {recursive: true, force: true});
    } catch (error) {
      console.error('Failed to clean up temp directory:', error);
    }
  }
  if (success && restoreError) throw restoreError;
}
