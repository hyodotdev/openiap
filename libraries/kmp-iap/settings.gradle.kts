enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")

pluginManagement {
    resolutionStrategy {
        eachPlugin {
            val version = requested.version ?: return@eachPlugin
            when (requested.id.id) {
                "com.android.application",
                "com.android.library" -> useModule("com.android.tools.build:gradle:$version")
                "org.jetbrains.dokka" -> useModule("org.jetbrains.dokka:dokka-gradle-plugin:$version")
            }
        }
    }
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

includeBuild("../../packages/google") {
    dependencySubstitution {
        substitute(module("io.github.hyochan.openiap:openiap-google")).using(project(":openiap"))
        substitute(module("io.github.hyochan.openiap:openiap-google-horizon")).using(project(":openiap"))
        substitute(module("io.github.hyochan.openiap:openiap-google-amazon")).using(project(":openiap"))
    }
}

// Configure build cache
buildCache {
    local {
        isEnabled = true
        directory = File(rootDir, ".gradle/build-cache")
    }
}
