pluginManagement {
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
    }
}
