import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Load local.properties
val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localPropertiesFile.inputStream().use { localProperties.load(it) }
}

val openIapBuildFile = rootProject.file("openiap/build.gradle.kts")
if (!openIapBuildFile.isFile) {
    error("Google Example: missing openiap/build.gradle.kts")
}
val openIapBuild = openIapBuildFile.readText()

fun readOpenIapAndroidInt(name: String): Int {
    return Regex("""$name\s*=\s*(\d+)""")
        .find(openIapBuild)
        ?.groupValues
        ?.get(1)
        ?.toInt()
        ?: error("Google Example: missing $name in ${openIapBuildFile.path}")
}

fun readOpenIapDependencyVersion(coordinate: String): String {
    return Regex("""${Regex.escape(coordinate)}:([^"$]+)""")
        .find(openIapBuild)
        ?.groupValues
        ?.get(1)
        ?: error("Google Example: missing $coordinate in ${openIapBuildFile.path}")
}

val openIapCompileSdk = readOpenIapAndroidInt("compileSdk")
val openIapMinSdk = readOpenIapAndroidInt("minSdk")
val openIapTargetSdk = openIapCompileSdk
val openIapCoreVersion = readOpenIapDependencyVersion("androidx.core:core")
val openIapLifecycleRuntimeVersion = readOpenIapDependencyVersion("androidx.lifecycle:lifecycle-runtime")
val openIapLifecycleViewModelVersion = readOpenIapDependencyVersion("androidx.lifecycle:lifecycle-viewmodel")
val openIapJunitVersion = readOpenIapDependencyVersion("junit:junit")

android {
    namespace = "dev.hyo.martie"
    compileSdk = openIapCompileSdk

    defaultConfig {
        applicationId = "dev.hyo.martie"
        minSdk = openIapMinSdk
        targetSdk = openIapTargetSdk
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true

        // Ships the shared example app id like the framework examples; an empty
        // value would only surface as a startConnection crash on device.
        // Blank counts as absent: getProperty returns "" for a key with no
        // value, and "" is non-null, so elvis alone would keep it.
        val appId = listOf(
            localProperties.getProperty("EXAMPLE_HORIZON_APP_ID"),
            localProperties.getProperty("EXAMPLE_OPENIAP_APP_ID"),
            project.findProperty("EXAMPLE_HORIZON_APP_ID") as String?,
            project.findProperty("EXAMPLE_OPENIAP_APP_ID") as String?,
        ).firstOrNull { !it.isNullOrBlank() } ?: "31705015229097839"
        buildConfigField("String", "HORIZON_APP_ID", "\"${appId}\"")
        // Ensure placeholder exists for all variants (play included)
        manifestPlaceholders["HORIZON_APP_ID"] = appId

        // IAPKit API Key for purchase verification
        val iapkitApiKey = localProperties.getProperty("iapkit.api.key")
            ?: (project.findProperty("IAPKIT_API_KEY") as String?)
            ?: ""
        buildConfigField("String", "IAPKIT_API_KEY", "\"${iapkitApiKey}\"")
    }

    flavorDimensions += "platform"

    productFlavors {
        // Play flavor - Google Play Billing (default)
        create("play") {
            dimension = "platform"
            buildConfigField("String", "OPENIAP_STORE", "\"play\"")
            isDefault = true
        }

        // Horizon flavor - Meta Horizon Billing only
        create("horizon") {
            dimension = "platform"
            buildConfigField("String", "OPENIAP_STORE", "\"horizon\"")

            // Dynamically inject the Horizon App ID into AndroidManifest
            val appId = listOf(
                localProperties.getProperty("EXAMPLE_HORIZON_APP_ID"),
                project.findProperty("EXAMPLE_HORIZON_APP_ID") as String?,
            ).firstOrNull { !it.isNullOrBlank() } ?: "31705015229097839"
            manifestPlaceholders["HORIZON_APP_ID"] = appId
        }

        // Amazon flavor - Amazon Appstore SDK IAP
        create("amazon") {
            dimension = "platform"
            buildConfigField("String", "OPENIAP_STORE", "\"amazon\"")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            // For easier testing
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(project(":openiap"))

    val composeUiVersion = (project.findProperty("COMPOSE_UI_VERSION") as String?) ?: "1.11.4"
    val composeMaterialIconsVersion =
        (project.findProperty("COMPOSE_MATERIAL_ICONS_VERSION") as String?) ?: "1.7.8"

    implementation("androidx.core:core:$openIapCoreVersion")
    implementation("androidx.lifecycle:lifecycle-runtime:$openIapLifecycleRuntimeVersion")
    implementation("androidx.activity:activity-compose:1.13.0")

    implementation("androidx.compose.ui:ui:$composeUiVersion")
    implementation("androidx.compose.ui:ui-tooling-preview:$composeUiVersion")
    implementation("androidx.compose.material3:material3:1.4.0")
    implementation("androidx.compose.material:material-icons-extended:$composeMaterialIconsVersion")
    implementation("androidx.navigation:navigation-compose:2.9.8")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:$openIapLifecycleViewModelVersion")

    debugImplementation("androidx.compose.ui:ui-tooling:$composeUiVersion")
    debugImplementation("androidx.compose.ui:ui-test-manifest:$composeUiVersion")

    testImplementation("junit:junit:$openIapJunitVersion")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4:$composeUiVersion")
}
