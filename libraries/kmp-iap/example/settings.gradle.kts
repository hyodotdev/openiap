rootProject.name = "KotlinProject"
enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")

pluginManagement {
    buildscript {
        repositories {
            google()
            mavenCentral()
        }
        dependencies {
            // AGP 8.13's bundled R8 cannot preserve Kotlin 2.4 metadata.
            classpath("com.android.tools:r8:9.1.56")
        }
    }
    repositories {
        google {
            mavenContent {
                includeGroupAndSubgroups("androidx")
                includeGroupAndSubgroups("com.android")
                includeGroupAndSubgroups("com.google")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google {
            mavenContent {
                includeGroupAndSubgroups("androidx")
                includeGroupAndSubgroups("com.android")
                includeGroupAndSubgroups("com.google")
            }
        }
        mavenCentral()
    }
}

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

val versionsFile = file("../../../libraries-versions.jsonc")
val kmpIapMode = if (versionsFile.exists()) {
    Regex(""""kmp-iap"\s*:\s*"([^"]+)"""")
        .find(versionsFile.readText())
        ?.groupValues
        ?.get(1)
        ?: "local"
} else {
    "local"
}

include(":composeApp")

if (kmpIapMode == "local") {
    include(":library")
    project(":library").projectDir = file("../library")
}
