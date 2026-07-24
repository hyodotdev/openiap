export interface PlatformRequestSelection<T> {
  usesLegacyKey: boolean;
  value: T | null | undefined;
}

/**
 * Selects a canonical platform request by key presence, not value.
 *
 * An explicitly supplied canonical `null` or `undefined` is authoritative and
 * must not fall back to the deprecated alias.
 */
export const selectCanonicalPlatformRequest = <T>(
  request: object,
  canonicalKey: PropertyKey,
  legacyKey: PropertyKey,
): PlatformRequestSelection<T> => {
  const record = request as Record<PropertyKey, T | null | undefined>;

  if (Object.prototype.hasOwnProperty.call(record, canonicalKey)) {
    return {
      usesLegacyKey: false,
      value: record[canonicalKey],
    };
  }

  if (Object.prototype.hasOwnProperty.call(record, legacyKey)) {
    return {
      usesLegacyKey: true,
      value: record[legacyKey],
    };
  }

  return {
    usesLegacyKey: false,
    value: undefined,
  };
};
