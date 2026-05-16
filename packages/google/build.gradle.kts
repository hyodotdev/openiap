plugins {
    id("com.android.library") version "8.13.2" apply false
    id("com.android.application") version "8.13.2" apply false
    id("org.jetbrains.kotlin.android") version "2.2.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.0" apply false
    id("com.vanniktech.maven.publish") version "0.35.0" apply false
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
