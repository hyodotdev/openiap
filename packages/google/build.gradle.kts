plugins {
    id("com.android.library") version "8.13.2" apply false
    id("com.android.application") version "8.13.2" apply false
    id("org.jetbrains.kotlin.android") version "2.2.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.0" apply false
    id("com.vanniktech.maven.publish") version "0.37.0" apply false
}

import groovy.json.JsonSlurper
import java.io.File

// Read version from monorepo root or environment variable
val androidVersion = System.getenv("ORG_GRADLE_PROJECT_openIapVersion") ?: run {
    val versionsFile = File(rootDir.parentFile.parentFile, "openiap-versions.json")
    if (!versionsFile.isFile) {
        error("packages/google: missing openiap-versions.json at ${versionsFile.path}")
    }
    val versionsJson = JsonSlurper().parseText(versionsFile.readText()) as Map<*, *>
    versionsJson["google"]?.toString()
        ?: error("packages/google: 'google' version missing in openiap-versions.json")
}

extra["OPENIAP_VERSION"] = androidVersion

// Composite consumers must not reuse packages/google/build with standalone or
// sibling consumer builds. AGP and Kotlin keep variant intermediates in that
// directory, and different composite roots can otherwise invalidate each
// other's outputs while Gradle still considers downstream tasks up to date.
gradle.parent?.rootProject?.let { consumerRoot ->
    val isolatedBuildRoot = consumerRoot.layout.buildDirectory
        .get()
        .asFile
        .resolve("included-openiap-google")
    layout.buildDirectory.set(isolatedBuildRoot)
}

// Robolectric fetches its Android runtime outside Gradle, so a Maven Central
// 429 fails tests with no retry. Gradle resolves the runtimes instead and hands
// Robolectric their paths. Versions match Robolectric 4.16.1; bump them with it.
val robolectricRuntimes = listOf(
    "6.0.1_r3-robolectric-r1-i7", // API 23, minSdk: tests without @Config(sdk)
    "10-robolectric-5803371-i7", // API 29
    "14-robolectric-10818077-i7", // API 34
    "15-robolectric-13954326-i7", // API 35
)
listOf(":openiap-core", ":openiap").forEach { path ->
    // Configuring a module before its script compiles hides the root plugins from it.
    project(path).afterEvaluate {
        // One configuration per runtime: Gradle would keep only the newest version.
        val runtimes = robolectricRuntimes.associateWith { version ->
            configurations.detachedConfiguration(
                dependencies.create("org.robolectric:android-all-instrumented:$version"),
            ).apply { isTransitive = false }.incoming.files
        }
        val depsFile = layout.buildDirectory.file("robolectric/robolectric-deps.properties")
        val writeDeps = tasks.register("writeRobolectricDeps") {
            runtimes.values.forEach { inputs.files(it) }
            outputs.file(depsFile)
            doLast {
                val deps = java.util.Properties()
                runtimes.forEach { (version, jar) ->
                    deps["org.robolectric:android-all-instrumented:$version"] = jar.singleFile.absolutePath
                }
                depsFile.get().asFile.outputStream().use { deps.store(it, null) }
            }
        }
        tasks.withType<Test>().configureEach {
            dependsOn(writeDeps)
            systemProperty("robolectric-deps.properties", depsFile.get().asFile.absolutePath)
        }
    }
}

// Configure Maven Central publishing at the root.
// Credentials are sourced from env or gradle.properties.
// Maven Central publishing is configured per-module via Vanniktech plugin.

tasks.register("clean", Delete::class) {
    delete(rootProject.layout.buildDirectory)
}

// Print Compose versions on project sync/build so it’s visible in IDE
val composeUiVersion = providers.gradleProperty("COMPOSE_UI_VERSION").orNull ?: "unknown"
val composeCompilerVersion = providers.gradleProperty("COMPOSE_COMPILER_VERSION").orNull ?: "unknown"
logger.lifecycle("Compose UI version: $composeUiVersion (compiler ext: $composeCompilerVersion)")
