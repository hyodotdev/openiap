pluginManagement {
    resolutionStrategy {
        eachPlugin {
            if (requested.id.id == "com.android.application" || requested.id.id == "com.android.library") {
                val version = requested.version ?: return@eachPlugin
                useModule("com.android.tools.build:gradle:$version")
            }
        }
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

rootProject.name = "openiap-google"

include(":openiap")
include(":openiap-core")
project(":openiap-core").projectDir = file("core")
include(":openiap-conformance")
project(":openiap-conformance").projectDir = file("../conformance/android")
include(":Example")
