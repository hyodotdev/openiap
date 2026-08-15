export const BUN_PROJECTS = [
  { directory: ".", lockfile: "bun.lock" },
  {
    directory: "libraries/expo-iap",
    lockfile: "libraries/expo-iap/bun.lock",
  },
  {
    directory: "libraries/expo-iap/example",
    lockfile: "libraries/expo-iap/example/bun.lock",
  },
  {
    directory: "libraries/expo-iap/example/vega",
    lockfile: "libraries/expo-iap/example/vega/bun.lock",
  },
  {
    directory: "libraries/react-native-iap/example/vega",
    lockfile: "libraries/react-native-iap/example/vega/bun.lock",
  },
  {
    directory: "scripts/agent",
    lockfile: "scripts/agent/bun.lock",
  },
];

export const OSV_LOCKFILES = [
  ...BUN_PROJECTS.map(({ lockfile }) => lockfile),
  "libraries/react-native-iap/yarn.lock",
];
