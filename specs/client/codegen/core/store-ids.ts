import registry from "../../src/store-registry.json";
import { storeConstantName } from "../../store-registry.mjs";
import { SWIFT_KEYWORDS } from "./utils.js";

import type { IRField } from "./types.js";

export const LEGACY_STORE_IDS = {
  Apple: "apple",
  Google: "play",
  Horizon: "horizon",
  Amazon: "amazon",
} as const;

export function hasStoreIdentity(fields: IRField[]): boolean {
  return (
    fields.some(
      ({ name, type }) =>
        name === "store" && type.name === "IapStore" && !type.nullable,
    ) &&
    fields.some(
      ({ name, type }) =>
        name === "storeId" && type.name === "String" && !type.nullable,
    )
  );
}

type StoreIdLanguage =
  | "typescript"
  | "kotlin"
  | "swift"
  | "dart"
  | "gdscript"
  | "csharp";
/** Registry ids are additive constants; they never extend IapStore. */
export function renderStoreIds(language: StoreIdLanguage): string {
  const rows = registry.stores
    .map(({ id }) => {
      const name = storeConstantName(id);
      switch (language) {
        case "typescript":
          return `  ${name}: '${id}',`;
        case "kotlin":
          return `    const val ${name} = "${id}"`;
        case "swift":
          return `    public static let ${SWIFT_KEYWORDS.has(name) ? `\`${name}\`` : name} = "${id}"`;
        case "dart":
          return `  static const String ${name[0].toLowerCase() + name.slice(1)} = '${id}';`;
        case "gdscript":
          return `\tconst ${id.replace(/[._-]/g, "_").toUpperCase()} = "${id}"`;
        case "csharp":
          return `    public const string ${name} = "${id}";`;
      }
    })
    .join("\n");
  switch (language) {
    case "typescript":
      return `export const StoreIds = {\n${rows}\n} as const;\n`;
    case "kotlin":
      return `public object StoreIds {\n${rows}\n}\n`;
    case "swift":
      return `public enum StoreIds {\n${rows}\n}\n`;
    case "dart":
      return `abstract final class StoreIds {\n${rows}\n}\n`;
    case "gdscript":
      return `class StoreIds:\n${rows}\n`;
    case "csharp":
      return `public static class StoreIds\n{\n${rows}\n}\n`;
  }
}

/** Decode official purchases persisted before storeId became required. */
export function renderStoreIdentityResolver(language: StoreIdLanguage): string {
  const entries = Object.entries(LEGACY_STORE_IDS);
  const reserved = [
    "auto",
    "none",
    "unknown",
    "apple",
    "play",
    "google",
    "horizon",
    "amazon",
  ];
  // Same grammar as the Commerce Protocol store key.
  const pattern = "[a-z][a-z0-9_]*";
  switch (language) {
    case "kotlin":
      return `private fun resolveStoreId(store: IapStore, value: Any?): String {
    val official = when (store) {
${entries.map(([name, id]) => `        IapStore.${name} -> "${id}"`).join("\n")}
        IapStore.Unknown -> null
    }
    require(value == null || value is String) { "storeId must be a string" }
    val id = value as String? ?: official
    require(id != null && if (official != null) id == official else id.matches(Regex("${pattern}")) && id !in setOf(${reserved.map((id) => `"${id}"`).join(", ")})) { "Invalid store identity" }
    return id
}
`;
    case "swift":
      return `private func resolveStoreId(_ store: IapStore, _ value: String?) -> String? {
    let official: String?
    switch store {
${entries.map(([name, id]) => `    case .${name.toLowerCase()}: official = "${id}"`).join("\n")}
    case .unknown: official = nil
    }
    guard let id = value ?? official else { return nil }
    if let official { return id == official ? id : nil }
    guard id.range(of: "^${pattern}$", options: .regularExpression) == id.startIndex..<id.endIndex,
          ![${reserved.map((id) => `"${id}"`).join(", ")}].contains(id) else { return nil }
    return id
}
`;
    case "dart":
      return `String _resolveStoreId(IapStore store, dynamic value) {
  final official = switch (store) {
${entries.map(([name, id]) => `    IapStore.${name} => '${id}',`).join("\n")}
    IapStore.Unknown => null,
  };
  final id = value ?? official;
  if (id is! String || (official != null ? id != official : RegExp(r'^${pattern}\$').firstMatch(id)?.end != id.length || const {${reserved.map((id) => `'${id}'`).join(", ")}}.contains(id))) {
    throw const FormatException('Invalid store identity');
  }
  return id;
}
`;
    case "gdscript":
      return `static func resolve_store_id(store: Variant, value: Variant) -> Variant:
	var official: Variant = {${entries.map(([name, id]) => `IapStore.${name.toUpperCase()}: "${id}"`).join(", ")}}.get(store)
	var id: Variant = value if value != null else official
	if not id is String:
		return null
	if official != null:
		return id if id == official else null
	var pattern = RegEx.new()
	pattern.compile("^${pattern}$")
	return id if pattern.search(id) != null and pattern.search(id).get_string() == id and not id in [${reserved.map((id) => `"${id}"`).join(", ")}] else null
`;
    case "csharp":
      return `internal static class StoreIdentity
{
    internal static string Resolve(IapStore store, string? value)
    {
        var official = store switch
        {
${entries.map(([name, id]) => `            IapStore.${name} => "${id}",`).join("\n")}
            _ => null,
        };
        var id = value ?? official;
        if (id is null || (official is not null ? id != official : !System.Text.RegularExpressions.Regex.IsMatch(id, @"\\A${pattern}\\z") || id is ${reserved.map((id) => `"${id}"`).join(" or ")}))
            throw new JsonException("Invalid store identity.");
        return id;
    }
}
`;
    case "typescript":
      return `export function resolveStoreId(value: unknown, store: IapStore): string {
  const officialIds: Partial<Record<IapStore, string>> = {${entries.map(([name, id]) => `'${name.toLowerCase()}': '${id}'`).join(", ")}};
  const official = officialIds[store];
  const id = value ?? official;
  if (typeof id !== 'string' || (official != null ? id !== official : store !== 'unknown' || id.match(/^${pattern}$/)?.[0] !== id || [${reserved.map((id) => `'${id}'`).join(", ")}].includes(id))) {
    throw new Error('Invalid store identity');
  }
  return id;
}
`;
  }
}
