import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/release-google.yml', import.meta.url), 'utf8');
const preflight = workflow.split('      - name: Preflight Maven Central publication\n')[1]
  .split('        run: |\n')[1].split('\n      - name:')[0].replace(/^          /gm, '');
const base = {CORE_EXISTS: 'false', CONFORMANCE_EXISTS: 'false', HORIZON_EXISTS: 'false', AMAZON_EXISTS: 'false', PLAY_EXISTS: 'false', PLUGIN_EXISTS: 'false', RELEASE_TAG_EXISTS: 'false'};
const credentials = Object.fromEntries(['MAVEN_CENTRAL_USERNAME', 'MAVEN_CENTRAL_PASSWORD', 'GPG_KEY_CONTENTS', 'SIGNING_KEY_ID', 'SIGNING_PASSWORD'].map((key) => [key, 'fixture']));
function check(values, legacy = false) {
  const root = mkdtempSync(join(tmpdir(), 'provider-preflight-'));
  if (!legacy) { mkdirSync(join(root, 'packages/google/core'), {recursive: true}); writeFileSync(join(root, 'packages/google/core/build.gradle.kts'), ''); }
  try { return spawnSync('bash', ['-e', '-c', preflight], {cwd: root, encoding: 'utf8', env: {...process.env, ...Object.fromEntries(Object.keys(credentials).map((key) => [key, ''])), ...base, ...values}}); }
  finally { rmSync(root, {recursive: true, force: true}); }
}
test('new provider artifacts require credentials before a release tag exists', () => {
  assert.notEqual(check({}).status, 0);
  assert.equal(check(credentials).status, 0);
});
test('an orphan core publication cannot be attached to a fresh Google release', () => {
  assert.notEqual(check({...credentials, CORE_EXISTS: 'true'}).status, 0);
});
test('the independent conformance version may already exist on a new Google release', () => {
  assert.equal(check({...credentials, CONFORMANCE_EXISTS: 'true'}).status, 0);
});
test('a complete existing release needs no publishing credentials', () => {
  assert.equal(check(Object.fromEntries(Object.keys(base).map((key) => [key, 'true']))).status, 0);
});
test('legacy release tags do not require an artifact that did not exist at that tag', () => {
  assert.equal(check(Object.fromEntries(Object.keys(base).map((key) => [key, 'true'])), true).status, 0);
});
test('provider prerequisites publish before official stores and stable conformance skips prereleases', () => {
  assert.ok(workflow.indexOf('name: Publish core to Maven Central') < workflow.indexOf('name: Publish Android conformance to Maven Central'));
  assert.ok(workflow.indexOf('name: Publish Android conformance to Maven Central') < workflow.indexOf('name: Publish Horizon flavor to Maven Central'));
  assert.match(workflow, /if \[ "\$IS_PRERELEASE" != "true" \]; then\n\s+CONFORMANCE_EXISTS=/);
});
