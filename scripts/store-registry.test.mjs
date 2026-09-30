import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {maintenanceStatus, validateProviderReport, validateStoreRegistry} from '../specs/client/store-registry.mjs';
import {requiredProviderBehaviors} from '../packages/conformance/src/spec/android-provider-profile.mjs';
import {SUITE_VERSION} from '../packages/conformance/src/spec/suite-version.mjs';

const registry = () => JSON.parse(readFileSync(new URL('../specs/client/src/store-registry.json', import.meta.url), 'utf8'));
const report = (capabilities = ['pendingPurchases']) => {
  const required = requiredProviderBehaviors(capabilities);
  return {
    suiteVersion: SUITE_VERSION, clientProtocolVersion: '0.1.1', store: 'unknown', storeId: 'community-fixture',
    capabilities, conformant: true,
    scope: {kind: 'android-provider', complete: true, requiredBehaviors: required},
    results: required.map((id) => ({id, outcome: 'pass'})),
  };
};
const community = () => ({
  id: 'community-fixture', platform: 'android', displayName: 'Fixture', tier: 'community', aliases: ['fixture'],
  maintainers: ['example'], repo: 'https://github.com/example/provider', coordinates: 'dev.example:provider:1.0.0',
  capabilities: ['pendingPurchases'], latestReport: {url: 'https://github.com/example/provider/actions/runs/1', report: report()},
});

test('the official registry matches the existing capability matrix', () => validateStoreRegistry(registry()));
test('registration accepts a passing independent provider or an experimental entry', () => {
  const data = registry();
  data.stores.push(community());
  assert.equal(validateStoreRegistry(data), data);
  data.stores.at(-1).tier = 'experimental';
  data.stores.at(-1).latestReport = null;
  assert.equal(validateStoreRegistry(data), data);
});
test('registered aliases and generated member names cannot collide', () => {
  for (const mutate of [
    (store) => { store.id = 'play'; },
    (store) => { store.aliases = ['google']; },
    (store) => { store.aliases = ['fixture', 'fixture']; },
  ]) {
    const data = registry(); const store = community(); mutate(store); data.stores.push(store);
    assert.throws(() => validateStoreRegistry(data), /duplicate|collide/);
  }
  const data = registry(); data.stores.push(community(), {...community(), id: 'community.fixture', aliases: []});
  assert.throws(() => validateStoreRegistry(data), /constants collide/);
});
test('community coordinates and declared capabilities are validated', () => {
  for (const mutate of [
    (store) => { store.coordinates = 'dev.example:provider:+'; },
    (store) => { store.coordinates = 'io.github.hyochan.openiap:openiap-google:3.6.2'; },
    (store) => { store.capabilities = ['made-up']; },
    (store) => { store.latestReport = null; },
    (store) => { store.latestReport.report.storeId = 'different'; },
  ]) {
    const data = registry(); const store = community(); mutate(store); data.stores.push(store);
    assert.throws(() => validateStoreRegistry(data));
  }
});
test('a passing claim cannot omit, skip or duplicate required behavior results', () => {
  for (const mutate of [
    (value) => { value.results.pop(); },
    (value) => { value.results[0].outcome = 'not-applicable'; },
    (value) => { value.results.push({...value.results[0]}); },
    (value) => { value.scope.kind = 'android-mapping'; },
    (value) => { value.scope.requiredBehaviors.pop(); },
    (value) => { value.capabilities = []; },
  ]) {
    const value = report(); mutate(value);
    assert.throws(() => validateProviderReport(value, ['pendingPurchases']));
  }
});
test('a complete failed report remains experimental', () => {
  const value = report(); value.results[0].outcome = 'fail'; value.conformant = false;
  assert.equal(validateProviderReport(value, ['pendingPurchases']), false);
  const data = registry(); const store = community(); store.tier = 'experimental'; store.latestReport.report = value;
  data.stores.push(store); validateStoreRegistry(data);
});
test('declaring another capability makes its behavior mandatory', () => {
  const value = report(); value.capabilities.push('subscriptionBillingIssue');
  assert.throws(() => validateProviderReport(value, value.capabilities), /required current-suite/);
});
test('an older passing major becomes unmaintained after the grace window', () => {
  const store = community(); store.latestReport.report.suiteVersion = '3.0.0';
  assert.equal(maintenanceStatus(store, 90, {now: new Date('2026-10-15'), majorReleaseDate: '2026-10-01'}), 'outdated');
  assert.equal(maintenanceStatus(store, 90, {now: new Date('2027-01-01'), majorReleaseDate: '2026-10-01'}), 'unmaintained');
  store.latestReport.report.suiteVersion = SUITE_VERSION;
  assert.equal(maintenanceStatus(store, 90, {now: new Date('2027-01-01')}), 'community');
});
