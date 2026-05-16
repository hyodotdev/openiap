import groovy.json.JsonSlurper
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

val monorepoRoot = projectDir.resolve("../../../..").canonicalFile
val versionsFile = monorepoRoot.resolve("openiap-versions.json")
if (!versionsFile.isFile) {
    error("maui-iap Android: missing openiap-versions.json at ${versionsFile.path}")
}
val versionsJson = JsonSlurper().parseText(versionsFile.readText()) as Map<*, *>
val openIapGoogleVersion = versionsJson["google"]?.toString()
    ?: error("maui-iap Android: 'google' version missing in openiap-versions.json")
val gsonVersion = providers.gradleProperty("mauiGsonVersion").orNull
    ?: error("maui-iap Android: missing mauiGsonVersion in gradle.properties")
val googleOpenIapBuildFile = monorepoRoot.resolve("packages/google/openiap/build.gradle.kts")
if (!googleOpenIapBuildFile.isFile) {
    error("maui-iap Android: missing packages/google/openiap/build.gradle.kts")
}
val googleOpenIapBuild = googleOpenIapBuildFile.readText()

fun readGoogleAndroidInt(name: String): Int {
    return Regex("""$name\s*=\s*(\d+)""")
        .find(googleOpenIapBuild)
        ?.groupValues
        ?.get(1)
        ?.toInt()
        ?: error("maui-iap Android: missing $name in ${googleOpenIapBuildFile.path}")
}

fun readGoogleVariable(name: String): String {
    return Regex("""val\s+$name\s*=\s*"([^"]+)"""")
        .find(googleOpenIapBuild)
        ?.groupValues
        ?.get(1)
        ?: error("maui-iap Android: missing $name in ${googleOpenIapBuildFile.path}")
}

fun readGoogleDependencyVersion(coordinate: String): String {
    return Regex("""${Regex.escape(coordinate)}:([^"$]+)""")
        .find(googleOpenIapBuild)
        ?.groupValues
        ?.get(1)
        ?: error("maui-iap Android: missing $coordinate in ${googleOpenIapBuildFile.path}")
}

fun readMauiAndroidMinSdk(): Int {
    val mauiProjectFile = projectDir.resolve("../../src/OpenIap.Maui/OpenIap.Maui.csproj")
    if (!mauiProjectFile.isFile) {
        error("maui-iap Android: missing ${mauiProjectFile.path}")
    }
    return Regex("""<SupportedOSPlatformVersion[^>]*android[^>]*>(\d+)(?:\.\d+)?</SupportedOSPlatformVersion>""")
        .find(mauiProjectFile.readText())
        ?.groupValues
        ?.get(1)
        ?.toInt()
        ?: error("maui-iap Android: missing Android SupportedOSPlatformVersion")
}

val googleCompileSdk = readGoogleAndroidInt("compileSdk")
val googleMinSdk = readGoogleAndroidInt("minSdk")
val mauiAndroidMinSdk = readMauiAndroidMinSdk()
val googleCoreKtxVersion = readGoogleDependencyVersion("androidx.core:core-ktx")
val googleCoroutinesVersion = readGoogleVariable("coroutinesVersion")

android {
    namespace = "dev.hyo.openiap.maui"
    compileSdk = googleCompileSdk

    defaultConfig {
        minSdk = maxOf(googleMinSdk, mauiAndroidMinSdk)
        missingDimensionStrategy("platform", "play")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
    compileOnly("io.github.hyochan.openiap:openiap-google:$openIapGoogleVersion")

    implementation("androidx.core:core-ktx:$googleCoreKtxVersion")
    implementation("com.google.code.gson:gson:$gsonVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$googleCoroutinesVersion")
}
