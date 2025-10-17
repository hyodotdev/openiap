plugins {
    id("com.android.library") version "8.5.0" apply false
    id("com.android.application") version "8.5.0" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
    id("com.vanniktech.maven.publish") version "0.29.0" apply false
}

import java.io.File

// Read version from monorepo root or environment variable
val androidVersion = System.getenv("ORG_GRADLE_PROJECT_openIapVersion") ?: run {
    // Fallback: read from openiap-versions.json
    val versionsFile = File(rootDir.parentFile.parentFile, "openiap-versions.json")
    val jsonText = versionsFile.readText()
    jsonText.substringAfter("\"google\": \"").substringBefore("\"")
}

val gqlVersion = run {
    val versionsFile = File(rootDir.parentFile.parentFile, "openiap-versions.json")
    if (versionsFile.exists()) {
        val jsonText = versionsFile.readText()
        jsonText.substringAfter("\"gql\": \"").substringBefore("\"")
    } else {
        "1.2.2" // Fallback
    }
}

extra["OPENIAP_VERSION"] = androidVersion
extra["GQL_VERSION"] = gqlVersion

// Configure Sonatype (OSSRH) publishing at the root
// Credentials are sourced from env or gradle.properties (OSSRH_USERNAME/OSSRH_PASSWORD)
// Maven Central publishing is configured per-module via Vanniktech plugin.

tasks.register("clean", Delete::class) {
    delete(rootProject.layout.buildDirectory)
}

// Print Compose versions on project sync/build so it’s visible in IDE
val composeUiVersion = providers.gradleProperty("COMPOSE_UI_VERSION").orNull ?: "unknown"
val composeCompilerVersion = providers.gradleProperty("COMPOSE_COMPILER_VERSION").orNull ?: "unknown"
logger.lifecycle("Compose UI version: $composeUiVersion (compiler ext: $composeCompilerVersion)")
