// Declared-fact registry: the single place a cross-cutting scalar (a tool
// version, a runner image) is written down. Scanners find every occurrence of
// the fact's shape; the audit requires each occurrence to be one of the
// declared values and each declared value to still occur somewhere. There is
// deliberately no per-site list to maintain — an unlisted site cannot drift
// silently, because the scanner sees it anyway.
//
// Authoring rules live in knowledge/internal/08-fact-graph.md. The short form:
// values here are authoritative; files follow. Multiple values in one fact
// mean deliberately coexisting roles (current vs minimum), not drift.

const WORKFLOWS = ".github/workflows/*.yml";

export const FACTS = Object.freeze([
  {
    key: "toolchain.xcode",
    values: { pinned: "26.6" },
    scanners: [
      {
        files: [WORKFLOWS],
        pattern: /(?:XCODE_VERSION|xcode-version):\s*["']?([\d.]+)/g,
      },
    ],
  },
  {
    key: "runner.macos-image",
    values: { hosted: "macos-26" },
    scanners: [{ files: [WORKFLOWS], pattern: /\b(macos-\d+)\b/g }],
  },
  {
    key: "toolchain.jdk",
    values: { pinned: "17" },
    scanners: [{ files: [WORKFLOWS], pattern: /java-version:\s*["']?(\d+)/g }],
  },
  {
    key: "toolchain.bun",
    values: { pinned: "1.3.13" },
    scanners: [
      { files: [WORKFLOWS], pattern: /bun-version:\s*["']?([\d.]+)/g },
      {
        files: ["package.json"],
        pattern: /"packageManager":\s*"bun@([\d.]+)"/g,
      },
    ],
  },
  {
    key: "godot.version",
    // current builds the artifacts; minimum is the oldest supported editor.
    values: { current: "4.7.1", minimum: "4.3" },
    scanners: [
      {
        files: [WORKFLOWS, "libraries/godot-iap/Makefile"],
        pattern: /\b(\d+\.\d+(?:\.\d+)?)-stable\b/g,
      },
      {
        files: [".github/workflows/ci-godot-iap.yml"],
        pattern: /^\s*version:\s*([\d.]+)\s*$/gm,
      },
      {
        files: ["libraries/godot-iap/Makefile"],
        pattern: /^GODOT_VERSION \?= ([\d.]+)$/gm,
      },
      {
        files: [
          WORKFLOWS,
          "libraries/godot-iap/Makefile",
          "libraries/godot-iap/addons/godot-iap/bin/godot_iap.gdextension",
          "libraries/godot-iap/.claude/guides/03-ios-plugin.md",
        ],
        pattern: /compatibility_minimum = "([\d.]+)"/g,
      },
    ],
  },
]);

// Relations that derive one declaration from another instead of equating them.
export const DERIVED = Object.freeze([
  {
    key: "godot.example-features",
    // The example project's feature tag is the current editor's major.minor.
    file: "libraries/godot-iap/Example/project.godot",
    pattern: /config\/features=PackedStringArray\("([\d.]+)"/,
    from: { fact: "godot.version", value: "current" },
    derive: (version) => version.split(".").slice(0, 2).join("."),
  },
]);
