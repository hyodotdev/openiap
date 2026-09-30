import { CAPABILITY_MATRIX } from './src/capability-matrix.mjs';
import { SUITE_VERSION, SUITE_MAJOR_RELEASE_DATE } from '../../packages/conformance/src/spec/suite-version.mjs';
import { ANDROID_PROVIDER_PROFILE, requiredProviderBehaviors } from '../../packages/conformance/src/spec/android-provider-profile.mjs';

export const STORE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
export const PROVIDER_COORDINATE_PATTERN = /^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[0-9][A-Za-z0-9_.-]*$/;
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const capabilities = Object.keys(ANDROID_PROVIDER_PROFILE.capabilities);
const discriminators = { apple: 'Apple', play: 'Google', horizon: 'Horizon', amazon: 'Amazon' };
const sameSet = (a, b) => a.length === new Set(a).size && a.length === b.length && a.every((item) => b.includes(item));
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const semverMajor = (version) => {
  requireThat(typeof version === 'string' && SEMVER.test(version), `Invalid semantic version: ${version}`);
  return Number(version.split('.')[0]);
};

export function validateProviderReport(report, declaredCapabilities, {suiteVersion = SUITE_VERSION} = {}) {
  requireThat(report && typeof report === 'object', 'Missing provider report');
  const major = semverMajor(report.suiteVersion);
  const current = semverMajor(suiteVersion);
  semverMajor(report.clientProtocolVersion);
  requireThat(major <= current, 'Report names a future suite major');
  requireThat(sameSet(report.capabilities ?? [], declaredCapabilities), 'Report capabilities differ from registry');
  requireThat(report.scope?.kind === 'android-provider', 'Report must use the android-provider profile');
  const required = report.scope?.requiredBehaviors;
  requireThat(Array.isArray(required) && required.length > 0 && required.length === new Set(required).size, 'Missing or duplicate required behaviors');
  if (major === current) requireThat(sameSet(required, requiredProviderBehaviors(declaredCapabilities)), 'Report omits required current-suite behaviors');
  requireThat(Array.isArray(report.results) && report.results.length === new Set(report.results.map((result) => result.id)).size, 'Missing or duplicate report results');
  const outcomes = new Map(report.results.map((result) => [result.id, result.outcome]));
  requireThat(report.results.every((result) => typeof result.id === 'string' && ['pass', 'fail', 'not-applicable'].includes(result.outcome)), 'Invalid report result');
  const passing = required.every((id) => outcomes.get(id) === 'pass') && !report.results.some((result) => result.outcome === 'fail');
  requireThat(report.conformant === passing && report.scope.complete === required.every((id) => outcomes.has(id)), 'Report verdict contradicts executed results');
  return passing;
}

export function maintenanceStatus(store, windowDays, {
  now = new Date(), suiteVersion = SUITE_VERSION, majorReleaseDate = SUITE_MAJOR_RELEASE_DATE,
} = {}) {
  if (store.tier !== 'community') return store.tier;
  if (semverMajor(store.latestReport.report.suiteVersion) === semverMajor(suiteVersion)) return 'community';
  return now.getTime() - new Date(majorReleaseDate).getTime() > windowDays * 86_400_000 ? 'unmaintained' : 'outdated';
}

/** Optional registration adds discovery metadata, never a runtime dependency. */
export function validateStoreRegistry(registry) {
  requireThat(registry?.schemaVersion === 1 && Number.isInteger(registry.maintenanceWindowDays) && registry.maintenanceWindowDays > 0, 'Invalid registry schema or maintenance window');
  requireThat(JSON.stringify(registry.selectionAliases) === JSON.stringify({auto: 'auto', none: 'none'}), 'Selection controls must remain auto and none');
  requireThat(Array.isArray(registry.stores), 'Registry stores must be an array');
  const names = new Set(['auto', 'none', 'unknown']);
  const members = new Set();
  for (const store of registry.stores) {
    requireThat(typeof store.id === 'string' && STORE_ID_PATTERN.test(store.id) && !names.has(store.id), `Invalid or duplicate store id: ${store.id}`);
    const member = store.id.split(/[._-]/).map((part) => part[0].toUpperCase() + part.slice(1)).join('');
    requireThat(!members.has(member) && !['StoreIds', 'Self', 'Class', 'Enum', 'Extension', 'Factory', 'Get', 'Set', 'Static', 'Const', 'Final', 'Var', 'Void', 'Null', 'True', 'False', 'This', 'Super', 'Switch', 'Case', 'Default', 'Return', 'If', 'Else', 'For', 'While', 'Do', 'Break', 'Continue', 'Try', 'Catch', 'Throw', 'Rethrow', 'Assert', 'New', 'In', 'Is', 'As', 'With', 'Implements', 'Interface', 'Mixin', 'On', 'Import', 'Export', 'Part', 'Library', 'Abstract', 'Covariant', 'External', 'Late', 'Required', 'Await', 'Yield', 'Async', 'Sync', 'ToString', 'GetHashCode', 'Equals', 'GetType', 'ReferenceEquals', 'MemberwiseClone', 'Finalize'].includes(member), `Store constants collide or are reserved: ${store.id}`);
    members.add(member);
    names.add(store.id);
    requireThat(['android', 'ios'].includes(store.platform), `Invalid platform: ${store.id}`);
    requireThat(['experimental', 'community', 'official'].includes(store.tier), `Invalid tier: ${store.id}`);
    requireThat(typeof store.displayName === 'string' && store.displayName.trim(), `Missing display name: ${store.id}`);
    requireThat(Array.isArray(store.maintainers) && store.maintainers.length > 0 && store.maintainers.every((name) => /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(name)), `Invalid maintainers: ${store.id}`);
    requireThat(typeof store.repo === 'string' && /^https:\/\/[^\s]+$/.test(store.repo), `Missing public repository: ${store.id}`);
    requireThat(Array.isArray(store.aliases), `Missing aliases: ${store.id}`);
    for (const alias of store.aliases) {
      requireThat(typeof alias === 'string' && STORE_ID_PATTERN.test(alias) && !names.has(alias), `Invalid or duplicate alias: ${alias}`);
      names.add(alias);
    }
    requireThat(Array.isArray(store.capabilities) && sameSet(store.capabilities, [...new Set(store.capabilities)]) && store.capabilities.every((item) => capabilities.includes(item)), `Invalid capabilities: ${store.id}`);
    if (store.tier === 'official') {
      requireThat(discriminators[store.id] && store.repo.startsWith('https://github.com/hyodotdev/openiap/'), `Official store must live in the monorepo: ${store.id}`);
      const expected = capabilities.filter((capability) => CAPABILITY_MATRIX[capability].stores[discriminators[store.id]] !== 'unsupported');
      requireThat(sameSet(store.capabilities, expected), `Official capabilities differ from matrix: ${store.id}`);
      requireThat(store.coordinates?.versionKey === (store.id === 'apple' ? 'apple' : 'google'), `Official coordinate must use the version SSOT: ${store.id}`);
      requireThat(store.platform === (store.id === 'apple' ? 'ios' : 'android'), `Invalid official platform: ${store.id}`);
      if (store.platform === 'android') requireThat(store.coordinates.module === `io.github.hyochan.openiap:openiap-google${store.id === 'play' ? '' : `-${store.id}`}`, `Invalid official coordinate: ${store.id}`);
    } else {
      requireThat(store.platform === 'android' && typeof store.coordinates === 'string' && PROVIDER_COORDINATE_PATTERN.test(store.coordinates) && !store.coordinates.startsWith('io.github.hyochan.openiap:openiap-'), `Invalid community coordinates: ${store.id}`);
      if (store.latestReport) {
        requireThat(/^https:\/\/[^\s]+$/.test(store.latestReport.url), `Report needs a public URL: ${store.id}`);
        requireThat(store.latestReport.report.storeId === store.id && store.latestReport.report.store === 'unknown', `Report store identity differs: ${store.id}`);
        const passing = validateProviderReport(store.latestReport.report, store.capabilities);
        requireThat(store.tier === (passing ? 'community' : 'experimental'), `Tier disagrees with conformance report: ${store.id}`);
      } else requireThat(store.tier === 'experimental', `Community store needs a passing report: ${store.id}`);
    }
  }
  for (const id of Object.keys(discriminators)) requireThat(registry.stores.some((store) => store.id === id && store.tier === 'official'), `Missing official store: ${id}`);
  return registry;
}
