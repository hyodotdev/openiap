import versionsFile from '../../openiap-versions.json?raw';

type VersionKey = 'gql';

type VersionRecord = Record<VersionKey, string>;

const REQUIRED_KEYS: readonly VersionKey[] = ['gql'] as const;

function parseVersions(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error(
      'openiap-versions.json contains invalid JSON. Check the file for syntax errors.'
    );
  }
}

function ensureVersions(data: Record<string, unknown>): VersionRecord {
  return REQUIRED_KEYS.reduce<Partial<VersionRecord>>((accumulator, key) => {
    const value = data[key];

    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`openiap-versions.json missing "${key}" version string`);
    }

    accumulator[key] = value;
    return accumulator;
  }, {}) as VersionRecord;
}

const parsedVersions = parseVersions(versionsFile);

export const OPENIAP_VERSIONS = Object.freeze(ensureVersions(parsedVersions));

export const GQL_RELEASE = Object.freeze({
  tag: OPENIAP_VERSIONS.gql,
  pageUrl: `https://github.com/hyodotdev/openiap-gql/releases/tag/${OPENIAP_VERSIONS.gql}`,
  downloadPrefix: `https://github.com/hyodotdev/openiap-gql/releases/download/${OPENIAP_VERSIONS.gql}/`,
});
