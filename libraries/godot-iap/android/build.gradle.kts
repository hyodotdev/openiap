import groovy.json.JsonSlurper
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

val pluginName = "GodotIap"
val pluginPackageName = "dev.hyo.godotiap"
val monorepoRoot = projectDir.resolve("../../..").canonicalFile

// Read OpenIAP version from shared config
val openiapVersionsFile = listOf(
    monorepoRoot.resolve("openiap-versions.json"),
    file("../openiap-versions.json"),
).firstOrNull { it.isFile }
    ?: error("godot-iap Android: missing openiap-versions.json")
val openiapVersions = JsonSlurper().parse(openiapVersionsFile) as Map<*, *>
val openiapGoogleVersion = openiapVersions["google"]?.toString()
    ?: error("godot-iap Android: 'google' version missing in openiap-versions.json")
val googleOpenIapBuildFile = monorepoRoot.resolve("packages/google/openiap/build.gradle.kts")
val googleOpenIapBuild = googleOpenIapBuildFile.takeIf { it.isFile }?.readText()

fun readFallbackProperty(name: String): String {
    return providers.gradleProperty(name).orNull
        ?: error("godot-iap Android: missing fallback $name in gradle.properties")
}

fun readGoogleAndroidInt(name: String, fallbackPropertyName: String): Int {
    return googleOpenIapBuild
        ?.let { Regex("""$name\s*=\s*(\d+)""").find(it) }
        ?.groupValues
        ?.get(1)
        ?.toInt()
        ?: readFallbackProperty(fallbackPropertyName).toInt()
}

fun readGoogleVariable(name: String, fallbackPropertyName: String): String {
    return googleOpenIapBuild
        ?.let { Regex("""val\s+${Regex.escape(name)}\s*=\s*"([^"]+)"""").find(it) }
        ?.groupValues
        ?.get(1)
        ?: readFallbackProperty(fallbackPropertyName)
}

val googleCompileSdk = readGoogleAndroidInt("compileSdk", "compileSdkVersion")
val googleMinSdk = readGoogleAndroidInt("minSdk", "minSdkVersion")
val googleCoroutinesVersion = readGoogleVariable("coroutinesVersion", "kotlinxCoroutinesVersion")

android {
    namespace = pluginPackageName
    compileSdk = googleCompileSdk

    defaultConfig {
        minSdk = googleMinSdk

        manifestPlaceholders["godotPluginName"] = pluginName
        manifestPlaceholders["godotPluginPackageName"] = pluginPackageName
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    // In monorepo: use local packages/google source if available
    val localGoogleProject = findProject(":openiap")
    if (localGoogleProject != null) {
        implementation(project(":openiap"))
    } else {
        implementation("io.github.hyochan.openiap:openiap-google:$openiapGoogleVersion")
    }

    // Godot Android library
    // For local development: Place godot-lib.aar in libs/ folder
    // For production: This will be provided by Godot's export process
    compileOnly(fileTree(mapOf("dir" to "libs", "include" to listOf("*.jar", "*.aar"))))

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$googleCoroutinesVersion")
}

// Copy the built AAR to the addons directory for Godot
tasks.register<Copy>("copyDebugAarToAddons") {
    dependsOn("assembleDebug")
    from(layout.buildDirectory.dir("outputs/aar"))
    include("${project.name}-debug.aar")
    into("../addons/godot-iap/android/")
    rename { "${pluginName}.debug.aar" }
}

tasks.register<Copy>("copyReleaseAarToAddons") {
    dependsOn("assembleRelease")
    from(layout.buildDirectory.dir("outputs/aar"))
    include("${project.name}-release.aar")
    into("../addons/godot-iap/android/")
    rename { "${pluginName}.release.aar" }
}
