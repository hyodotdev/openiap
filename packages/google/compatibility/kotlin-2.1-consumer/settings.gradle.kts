pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        maven {
            url = uri(providers.gradleProperty("openIapRepository").get())
        }
        mavenCentral()
    }
}

rootProject.name = "openiap-google-kotlin-2.1-consumer"
