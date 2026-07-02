pluginManagement {
    val googleRootBuildFile = file("../../../packages/google/build.gradle.kts")
    if (!googleRootBuildFile.isFile) {
        error("maui-iap Android: missing packages/google/build.gradle.kts")
    }
    val googleRootBuild = googleRootBuildFile.readText()

    fun googlePluginVersion(pluginId: String): String {
        return Regex("""id\("${Regex.escape(pluginId)}"\) version "([^"]+)"""")
            .find(googleRootBuild)
            ?.groupValues
            ?.get(1)
            ?: error("maui-iap Android: missing $pluginId version in ${googleRootBuildFile.path}")
    }

    resolutionStrategy {
        eachPlugin {
            if (requested.id.id == "com.android.library") {
                val version = requested.version ?: return@eachPlugin
                useModule("com.android.tools.build:gradle:$version")
            }
        }
    }

    plugins {
        id("com.android.library") version googlePluginVersion("com.android.library")
        id("org.jetbrains.kotlin.android") version googlePluginVersion("org.jetbrains.kotlin.android")
    }

    repositories {
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "openiap-maui-android"

include(":openiap")

includeBuild("../../../packages/google") {
    dependencySubstitution {
        substitute(module("io.github.hyochan.openiap:openiap-google")).using(project(":openiap"))
        substitute(module("io.github.hyochan.openiap:openiap-google-horizon")).using(project(":openiap"))
        substitute(module("io.github.hyochan.openiap:openiap-google-amazon")).using(project(":openiap"))
    }
}
