import java.util.Locale
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
val googleCoreVersion = readGoogleDependencyVersion("androidx.core:core")
val googleCoroutinesVersion = readGoogleVariable("coroutinesVersion")
// Groovy's toBoolean() accepts exactly true/y/1, case-insensitive, and the
// doctor asserts the same set. Parsing a wider or narrower one here would make
// the same gradle.properties select different stores in the two resolvers.
fun legacyFlag(name: String): Boolean =
    providers.gradleProperty(name).orNull?.trim()?.lowercase(Locale.ROOT) in
        setOf("true", "y", "1")
val horizonEnabled = legacyFlag("horizonEnabled")
val fireOsEnabled = legacyFlag("fireOsEnabled")
if (horizonEnabled && fireOsEnabled) {
    error("maui-iap Android: horizonEnabled and fireOsEnabled cannot both be true")
}

// Same alias table as packages/google/gradle/openiap-store.gradle.
fun normalizeOpenIapStore(value: String?): String =
    when (value?.lowercase(Locale.ROOT)) {
        null, "", "auto", "play", "google", "gplay", "googleplay", "google-play", "gms" -> "play"
        "none" -> "none"
        "horizon", "meta", "quest" -> "horizon"
        "amazon", "fire", "fireos", "fire-os" -> "amazon"
        else -> error("maui-iap Android: unsupported openiapStore '$value'")
    }

// Trim and treat blank as absent exactly as the Groovy resolver does; without
// that, " horizon " fails here while it resolves there, from one build's input.
val requestedOpenIapStore = listOf("openiapStore", "openIapAndroidStore", "OpenIapAndroidStore")
    .firstNotNullOfOrNull { providers.gradleProperty(it).orNull?.trim()?.takeIf(String::isNotEmpty) }
// Blank is not absent here: the Groovy resolver and the doctor both reject an
// empty openiapPlatform, so folding it away would accept what they refuse.
val requestedOpenIapPlatform = providers.gradleProperty("openiapPlatform").orNull?.trim()
if (requestedOpenIapPlatform != null && requestedOpenIapPlatform.lowercase(Locale.ROOT) != "none") {
    error("maui-iap Android: openiapPlatform only supports the opt-out value 'none'")
}
val legacyOpenIapStore = when {
    requestedOpenIapPlatform != null -> "none"
    fireOsEnabled -> "amazon"
    horizonEnabled -> "horizon"
    else -> null
}
// Same rule as packages/google/gradle/openiap-store.gradle: two signals that
// name different stores stop the build instead of one quietly winning. `auto`
// is not a pin there either.
val pinnedOpenIapStore = requestedOpenIapStore
    ?.takeIf { it.lowercase(Locale.ROOT) != "auto" }
    ?.let(::normalizeOpenIapStore)
if (pinnedOpenIapStore != null && legacyOpenIapStore != null && pinnedOpenIapStore != legacyOpenIapStore) {
    error("maui-iap Android: openiapStore=$pinnedOpenIapStore conflicts with the legacy flags selecting $legacyOpenIapStore")
}
if (legacyOpenIapStore == "none" || pinnedOpenIapStore == "none") {
    error("maui-iap Android: openiapStore=none is not supported by this library")
}
val openIapAndroidStore = when {
    pinnedOpenIapStore != null -> pinnedOpenIapStore
    legacyOpenIapStore != null -> legacyOpenIapStore
    else -> "play"
}
val openIapGoogleArtifact = when (openIapAndroidStore) {
    "amazon" -> "openiap-google-amazon"
    "horizon" -> "openiap-google-horizon"
    else -> "openiap-google"
}

android {
    namespace = "dev.hyo.openiap.maui"
    compileSdk = googleCompileSdk

    defaultConfig {
        minSdk = maxOf(googleMinSdk, mauiAndroidMinSdk)
        missingDimensionStrategy("platform", openIapAndroidStore)
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
    compileOnly("io.github.hyochan.openiap:$openIapGoogleArtifact:$openIapGoogleVersion")

    implementation("androidx.core:core:$googleCoreVersion")
    implementation("com.google.code.gson:gson:$gsonVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$googleCoroutinesVersion")
}
