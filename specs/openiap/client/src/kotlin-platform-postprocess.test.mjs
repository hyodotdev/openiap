import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GENERATED_SYNC_MANIFEST } from "../generated-sync-manifest.mjs";
import { postProcessKotlinSource } from "../scripts/kotlin-platform-postprocess.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const read = (path) => readFileSync(resolve(repositoryRoot, path), "utf8");
const canonical = read(GENERATED_SYNC_MANIFEST.kotlin.source);

describe("Kotlin platform post-processing", () => {
  it("reproduces the checked-in Google target exactly", () => {
    expect(postProcessKotlinSource(canonical, "google")).toBe(
      read(GENERATED_SYNC_MANIFEST.kotlin.targets.google.path),
    );
  });

  it("reproduces the checked-in KMP target exactly", () => {
    expect(postProcessKotlinSource(canonical, "kmp")).toBe(
      read(GENERATED_SYNC_MANIFEST.kotlin.targets.kmp.path),
    );
  });

  it("owns package placement, enum semicolons, and published Google aliases", () => {
    const fixture = `// generated
@file:Suppress("UNCHECKED_CAST")

public enum class ExampleValue(val rawValue: String) {
    FirstValue("legacy-value"),
    LastValue("last-value")

    companion object {
        fun fromJson(value: String): ExampleValue = when (value) {
            "legacy-value" -> ExampleValue.FirstValue
            "LEGACY_VALUE" -> ExampleValue.FirstValue
            "last-value" -> ExampleValue.LastValue
            else -> throw IllegalArgumentException()
        }
    }
}
`;

    const google = postProcessKotlinSource(fixture, "google");
    expect(google).toContain(
      '@file:Suppress("UNCHECKED_CAST")\npackage dev.hyo.openiap',
    );
    expect(google).toContain('LastValue("last-value");');
    expect(google).toContain('"legacy-value" -> ExampleValue.FirstValue');
    expect(google).toContain('"FirstValue" -> ExampleValue.FirstValue');
    expect(google).toContain('"LEGACY_VALUE" -> ExampleValue.FirstValue');

    const kmp = postProcessKotlinSource(fixture, "kmp");
    expect(kmp).toContain(
      '@file:Suppress("UNCHECKED_CAST")\n\npackage io.github.hyochan.kmpiap.openiap',
    );
    expect(kmp).toContain('LastValue("last-value");');
    expect(kmp).toContain('"LEGACY_VALUE" -> ExampleValue.FirstValue');
  });

  it("rejects unknown profiles and multiple package declarations", () => {
    expect(() => postProcessKotlinSource(canonical, "unknown")).toThrow(
      "Unknown Kotlin platform post-process profile",
    );
    expect(() =>
      postProcessKotlinSource("package one\npackage two\n", "kmp"),
    ).toThrow("multiple package declarations");
  });

  it("rewrites compact when(value) parsers after verifying every raw value", () => {
    const fixture = `public enum class ExampleValue(val rawValue: String) {
    FirstValue("legacy-value")

    companion object {
        fun fromJson(value: String): ExampleValue = when(value) {
            "legacy-value" -> ExampleValue.FirstValue
            else -> throw IllegalArgumentException()
        }
    }
}
`;

    const google = postProcessKotlinSource(fixture, "google");
    expect(google).toContain('FirstValue("legacy-value");');
    expect(google).toContain('"legacy-value" -> ExampleValue.FirstValue');
    expect(google).toContain('"FirstValue" -> ExampleValue.FirstValue');
  });

  it("fails closed when a Google enum parser cannot be verified", () => {
    const fixture = `public enum class ExampleValue(val rawValue: String) {
    FirstValue("legacy-value")

    companion object {
        fun fromJson(value: String): ExampleValue = parseLegacy(value)
    }
}
`;

    expect(() => postProcessKotlinSource(fixture, "google")).toThrow(
      "ExampleValue is missing fromJson when(value) parsing",
    );
  });

  it("fails closed when a Google enum raw value does not round-trip", () => {
    const fixture = `public enum class ExampleValue(val rawValue: String) {
    FirstValue("first-value")

    companion object {
        fun fromJson(value: String): ExampleValue = when(value) {
            "legacy-value" -> ExampleValue.FirstValue
            else -> throw IllegalArgumentException()
        }
    }
}
`;

    expect(() => postProcessKotlinSource(fixture, "google")).toThrow(
      'ExampleValue.FirstValue raw value "first-value" does not round-trip',
    );
  });

  it("fails closed when a Google enum parser references an unknown constant", () => {
    const fixture = `public enum class ExampleValue(val rawValue: String) {
    FirstValue("first-value")

    companion object {
        fun fromJson(value: String): ExampleValue = when(value) {
            "first-value" -> ExampleValue.FirstValue
            "legacy-value" -> ExampleValue.MissingValue
            else -> throw IllegalArgumentException()
        }
    }
}
`;

    expect(() => postProcessKotlinSource(fixture, "google")).toThrow(
      'maps alias "legacy-value" to unknown constant MissingValue',
    );
  });
});
