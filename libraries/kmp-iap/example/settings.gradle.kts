rootProject.name = "KotlinProject"
enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")

pluginManagement {
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
