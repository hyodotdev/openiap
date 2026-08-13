import type { IRSchema } from "../core/types.js";

export function nullableEnumListSchema(): IRSchema {
  return {
    enums: [
      {
        name: "TestStatus",
        values: [
          { name: "Unknown", rawValue: "unknown", legacyAliases: [] },
          { name: "Active", rawValue: "active", legacyAliases: [] },
        ],
        isErrorCode: false,
      },
      {
        name: "StrictStatus",
        values: [{ name: "Active", rawValue: "active", legacyAliases: [] }],
        isErrorCode: false,
      },
    ],
    interfaces: [],
    objects: [
      {
        name: "EnumListHolder",
        fields: [
          {
            name: "statuses",
            description:
              "Status values from the schema.\n\nPreserves every documentation line.\n@see https://openiap.dev/docs/types",
            type: {
              kind: "list",
              nullable: false,
              elementType: {
                kind: "enum",
                name: "TestStatus",
                nullable: false,
              },
            },
            isOverride: false,
          },
          {
            name: "strictStatuses",
            type: {
              kind: "list",
              nullable: false,
              elementType: {
                kind: "enum",
                name: "StrictStatus",
                nullable: false,
              },
            },
            isOverride: false,
          },
          {
            name: "nullableStrictStatuses",
            type: {
              kind: "list",
              nullable: false,
              elementType: {
                kind: "enum",
                name: "StrictStatus",
                nullable: true,
              },
            },
            isOverride: false,
          },
          {
            name: "nullableLabels",
            type: {
              kind: "list",
              nullable: false,
              elementType: {
                kind: "scalar",
                name: "String",
                nullable: true,
              },
            },
            isOverride: false,
          },
        ],
        interfaces: [],
        unions: [],
        isResultUnion: false,
      },
    ],
    inputs: [],
    unions: [],
    operations: [],
  };
}
