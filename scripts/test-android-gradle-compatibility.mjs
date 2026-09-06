import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [agp, mode = "default"] = process.argv.slice(2);
assert.match(
  agp ?? "",
  /^\d+\.\d+\.\d+$/,
  "Usage: node scripts/test-android-gradle-compatibility.mjs <AGP version> [default|opt-out]",
);
assert.ok(["default", "opt-out"].includes(mode));
const gradle = process.env.GRADLE_BIN || "gradle";
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
assert.ok(sdk, "Set ANDROID_HOME to an installed Android SDK.");
const root = mkdtempSync(join(tmpdir(), "openiap-gradle-"));
const rn = join(repo, "libraries/react-native-iap");
const expo = join(repo, "libraries/expo-iap");
const defaults = Object.fromEntries(
  readFileSync(join(rn, "android/gradle.properties"), "utf8")
    .trim()
    .split("\n")
    .map((line) => line.split("=")),
);
const kotlin = process.env.KOTLIN_VERSION || defaults.NitroIap_kotlinVersion;
assert.match(kotlin, /^\d+\.\d+\.\d+$/);
const builtIn = Number(agp.split(".")[0]) >= 9 && mode === "default";

function write(path, body) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body);
}

function copy(source, target) {
  mkdirSync(dirname(join(root, target)), { recursive: true });
  cpSync(source, join(root, target));
}

try {
  write(
    "settings.gradle",
    `
rootProject.name = 'openiap-gradle-compatibility'
include ':rn', ':expo', ':expo-modules-core', ':consumer', ':unrelated'
project(':rn').projectDir = file('react-native-iap/android')
project(':expo').projectDir = file('expo-iap/android')
`,
  );
  write(
    "gradle.properties",
    `
org.gradle.jvmargs=-Xmx2g
org.gradle.workers.max=2
android.useAndroidX=true
reactNativeArchitectures=arm64-v8a
${mode === "opt-out" ? "android.builtInKotlin=false\nandroid.newDsl=false" : ""}
`,
  );
  write("local.properties", `sdk.dir=${sdk.replaceAll("\\", "\\\\")}\n`);
  write(
    "build.gradle",
    `
buildscript {
  repositories { google(); mavenCentral() }
  dependencies {
    classpath 'com.android.tools.build:gradle:${agp}'
    classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlin}'
  }
}
ext.kotlinVersion = '${kotlin}'
ext.androidGradlePluginVersion = '${agp}'
subprojects {
  repositories { google(); mavenCentral() }
  plugins.withId('com.android.library') {
    if (name == 'rn') {
      android.buildFeatures.prefabPublishing = true
      android.prefab { NitroIap { headers = 'include' } }
    }
  }
  afterEvaluate {
    if (name in ['rn', 'expo']) {
      // Exercise the shipped build scripts independently of framework plugins.
      configurations.implementation.dependencies.clear()
      dependencies.add('implementation', 'org.jetbrains.kotlin:kotlin-stdlib:${kotlin}')
      assert plugins.hasPlugin('org.jetbrains.kotlin.android') == ${!builtIn}
    }
  }
}
tasks.register('verifyCompatibility') {
  dependsOn ':rn:assembleDebug', ':rn:assembleRelease', ':expo:assembleDebug'
  doLast {
    ['rn', 'expo'].each { name ->
      def lib = project(":\$name")
      assert lib.android.compileOptions.targetCompatibility == JavaVersion.VERSION_17
      def archive = lib.layout.buildDirectory.file("outputs/aar/\$name-debug.aar").get().asFile
      def aar = new java.util.zip.ZipFile(archive)
      try {
        def classes = new java.util.jar.JarInputStream(aar.getInputStream(aar.getEntry('classes.jar')))
        def names = []
        try {
          for (def entry = classes.nextJarEntry; entry != null; entry = classes.nextJarEntry) {
            names.add(entry.name)
          }
        } finally { classes.close() }
        assert names.contains('dev/openiap/probe/Probe.class')
        if (name == 'rn') {
          assert names.contains('dev/openiap/probe/GeneratedBase.class')
          assert aar.getEntry('jni/arm64-v8a/libNitroIap.so') != null
          assert aar.getEntry('prefab/modules/NitroIap/libs/android.arm64-v8a/libNitroIap.so') != null
          assert aar.getEntry('jni/arm64-v8a/libfbjni.so') == null
          assert !names.contains('META-INF/removed.txt')
          assert !names.contains('lib/libfbjni.so')
          assert lib.android.defaultConfig.externalNativeBuild.cmake.cppFlags.join(' ').tokenize().contains('-fstack-protector-all')
          assert lib.android.buildTypes.debug.externalNativeBuild.cmake.cppFlags.contains('-O1 -g')
          assert lib.android.buildTypes.release.externalNativeBuild.cmake.cppFlags.contains('-O2')
        }
      } finally { aar.close() }
    }
    println 'Verified Kotlin classes, generated sources, native packaging, and compiler flags.'
  }
}
`,
  );
  for (const [source, name, packageName] of [
    [rn, "rn", "react-native-iap"],
    [expo, "expo", "expo-iap"],
  ]) {
    copy(
      join(source, "android/build.gradle"),
      `${packageName}/android/build.gradle`,
    );
    copy(join(source, "package.json"), `${packageName}/package.json`);
    copy(
      join(repo, "openiap-versions.json"),
      `${packageName}/openiap-versions.json`,
    );
    write(
      `${packageName}/android/src/main/AndroidManifest.xml`,
      "<manifest />",
    );
    write(
      `${packageName}/android/src/main/java/dev/openiap/probe/Probe.kt`,
      `package dev.openiap.probe\nclass Probe${name === "rn" ? " : GeneratedBase()" : " { val debug = expo.modules.iap.BuildConfig.DEBUG }"}\n`,
    );
  }
  copy(
    join(rn, "android/gradle.properties"),
    "react-native-iap/android/gradle.properties",
  );
  copy(
    join(rn, "android/fix-prefab.gradle"),
    "react-native-iap/android/fix-prefab.gradle",
  );
  copy(
    join(rn, "android/consumer-rules.pro"),
    "react-native-iap/android/consumer-rules.pro",
  );
  copy(
    join(rn, "nitrogen/generated/android/NitroIap+autolinking.gradle"),
    "react-native-iap/nitrogen/generated/android/NitroIap+autolinking.gradle",
  );
  write(
    "react-native-iap/nitrogen/generated/android/kotlin/dev/openiap/probe/GeneratedBase.kt",
    "package dev.openiap.probe\nopen class GeneratedBase\n",
  );
  write(
    "react-native-iap/android/CMakeLists.txt",
    `
cmake_minimum_required(VERSION 3.22.1)
project(NitroIap)
add_library(NitroIap SHARED probe.cpp)
`,
  );
  write(
    "react-native-iap/android/probe.cpp",
    'extern "C" int probe() { return 438; }\n',
  );
  write(
    "react-native-iap/android/include/probe.h",
    'extern "C" int probe();\n',
  );
  write(
    "react-native-iap/android/src/main/jniLibs/arm64-v8a/libfbjni.so",
    "excluded",
  );
  write(
    "react-native-iap/android/src/main/resources/META-INF/removed.txt",
    "excluded",
  );
  write(
    "react-native-iap/android/src/main/resources/lib/libfbjni.so",
    "excluded",
  );
  copy(
    join(expo, "android/openiap-android-sdk.gradle"),
    "expo-iap/android/openiap-android-sdk.gradle",
  );
  copy(
    join(
      expo,
      "node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle",
    ),
    "expo-modules-core/ExpoModulesCorePlugin.gradle",
  );
  for (const name of ["consumer", "unrelated"]) {
    write(
      `${name}/build.gradle`,
      `
apply plugin: 'com.android.application'
android {
  namespace = 'dev.openiap.${name}'
  compileSdk = ${defaults.NitroIap_compileSdkVersion}
  defaultConfig { minSdk = ${defaults.NitroIap_minSdkVersion} }
}
${name === "consumer" ? "dependencies { implementation project(':rn') }" : ""}
`,
    );
  }
  const refreshed = [];
  const unchanged = [];
  for (const module of ["react-native-iap/android", "consumer", "unrelated"]) {
    for (const variant of ["Debug", "release", "customDebug"]) {
      for (const abi of ["arm64-v8a", "x86_64"]) {
        const path = `${module}/.cxx/${variant}/probe/${abi}/prefab_config.json`;
        write(path, "{}");
        utimesSync(join(root, path), 1, 1);
        (module !== "unrelated" && abi === "arm64-v8a"
          ? refreshed
          : unchanged
        ).push(path);
      }
    }
  }
  write(
    "verify-prefab.gradle",
    `
gradle.projectsEvaluated {
  rootProject.tasks.named('verifyCompatibility') {
    doLast {
      ${JSON.stringify(refreshed)}.each { assert rootProject.file(it).lastModified() > 1000 }
      ${JSON.stringify(unchanged)}.each { assert rootProject.file(it).lastModified() == 1000 }
    }
  }
}
`,
  );
  console.log(`Checking AGP ${agp} (${mode}) in ${root}`);
  const result = spawnSync(
    gradle,
    [
      "-p",
      root,
      "--no-daemon",
      "--console=plain",
      "-I",
      join(root, "verify-prefab.gradle"),
      "verifyCompatibility",
    ],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `AGP ${agp} (${mode}) compatibility failed`);
} finally {
  if (process.env.KEEP_GRADLE_FIXTURE) console.log(`Fixture retained: ${root}`);
  else rmSync(root, { recursive: true, force: true });
}
