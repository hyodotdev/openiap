import java.util.Properties

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

android {
    namespace = "dev.hyo.martie"
    compileSdk = 34

    defaultConfig {
        applicationId = "dev.hyo.martie"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true

        val appId = localProperties.getProperty("EXAMPLE_HORIZON_APP_ID")
            ?: localProperties.getProperty("EXAMPLE_OPENIAP_APP_ID")
            ?: (project.findProperty("EXAMPLE_HORIZON_APP_ID") as String?)
            ?: (project.findProperty("EXAMPLE_OPENIAP_APP_ID") as String?)
            ?: ""
        buildConfigField("String", "HORIZON_APP_ID", "\"${appId}\"")
        // Ensure placeholder exists for all variants (play included)
        manifestPlaceholders["OCULUS_APP_ID"] = appId
    }

    flavorDimensions += "platform"

    productFlavors {
        // Play flavor - Google Play Billing only (default)
        create("play") {
            dimension = "platform"
            buildConfigField("String", "OPENIAP_STORE", "\"play\"")
            isDefault = true
        }

        // Horizon flavor - Meta Horizon Billing only
        create("horizon") {
            dimension = "platform"
            buildConfigField("String", "OPENIAP_STORE", "\"horizon\"")

            // Dynamically inject OCULUS_APP_ID into AndroidManifest
            val appId = localProperties.getProperty("EXAMPLE_HORIZON_APP_ID")
                ?: (project.findProperty("EXAMPLE_HORIZON_APP_ID") as String?)
                ?: ""
            manifestPlaceholders["OCULUS_APP_ID"] = appId
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

    kotlinOptions {
        jvmTarget = "17"
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

dependencies {
    implementation(project(":openiap"))

    val composeUiVersion = (project.findProperty("COMPOSE_UI_VERSION") as String?) ?: "1.6.8"

    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.activity:activity-compose:1.9.0")

    implementation("androidx.compose.ui:ui:$composeUiVersion")
    implementation("androidx.compose.ui:ui-tooling-preview:$composeUiVersion")
    implementation("androidx.compose.material3:material3:1.2.1")
    implementation("androidx.compose.material:material-icons-extended:$composeUiVersion")
    implementation("androidx.navigation:navigation-compose:2.7.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")

    debugImplementation("androidx.compose.ui:ui-tooling:$composeUiVersion")
    debugImplementation("androidx.compose.ui:ui-test-manifest:$composeUiVersion")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4:$composeUiVersion")
}
