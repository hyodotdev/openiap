enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
        maven("https://maven.pkg.jetbrains.space/public/p/compose/dev")
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        mavenLocal()
        maven("https://maven.pkg.jetbrains.space/public/p/compose/dev")
    }
}

rootProject.name = "kmp-iap"
include(":library")
include(":example")
include(":example:composeApp")

// Configure build cache
buildCache {
    local {
        isEnabled = true
        directory = File(rootDir, ".gradle/build-cache")
    }
}
