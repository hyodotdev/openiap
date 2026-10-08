pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        maven { url = uri(providers.gradleProperty("openIapRepository").get()) }
        google(); mavenCentral()
    }
}
rootProject.name = "independent-openiap-provider"
include(":provider", ":host", ":second-provider", ":vendor-sdk")
