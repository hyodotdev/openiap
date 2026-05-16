pluginManagement {
    val androidGradleProperties = java.util.Properties().apply {
        file("gradle.properties").inputStream().use(::load)
    }
    val googleRootBuildFile = file("../../../packages/google/build.gradle.kts")
    val googleRootBuild = googleRootBuildFile.takeIf { it.isFile }?.readText()

    fun configuredVersion(propertyName: String): String {
        return androidGradleProperties.getProperty(propertyName)
            ?: error("godot-iap Android: missing $propertyName in gradle.properties")
    }

    fun googlePluginVersion(pluginId: String, fallbackPropertyName: String): String {
        if (googleRootBuild != null) {
            val matcher = Regex("""id\("${Regex.escape(pluginId)}"\) version "([^"]+)"""")
                .find(googleRootBuild)
            if (matcher != null) {
                return matcher.groupValues[1]
            }
        }
        return configuredVersion(fallbackPropertyName)
    }

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
    plugins {
        id("com.android.library") version googlePluginVersion(
            "com.android.library",
            "androidGradlePluginVersion",
        )
        id("org.jetbrains.kotlin.android") version googlePluginVersion(
            "org.jetbrains.kotlin.android",
            "kotlinVersion",
        )
    }
}

rootProject.name = "godot-iap"

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
