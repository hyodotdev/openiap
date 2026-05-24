import groovy.json.JsonSlurper
import java.io.File
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

fun locateOpeniapVersionsFile(startDir: File): File {
    var current: File? = startDir
    while (current != null) {
        val candidate = File(current, "openiap-versions.json")
        if (candidate.isFile) {
            return candidate
        }
        current = current.parentFile
    }
    throw GradleException("packages/google: missing openiap-versions.json from ${startDir.absolutePath}")
}

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.vanniktech.maven.publish")
}

// Read version from Gradle property first, then from monorepo root openiap-versions.json.
// Release and local publish scripts pass -P/ORG_GRADLE_PROJECT_openIapVersion;
// normal development builds use the repository SSOT file.
val versionsFile = locateOpeniapVersionsFile(projectDir)
val versionsJson = JsonSlurper().parseText(versionsFile.readText()) as Map<*, *>
val openIapVersion: String = project.findProperty("openIapVersion")?.toString()?.takeIf { it.isNotBlank() }
    ?: versionsJson["google"]?.toString()?.takeIf { it.isNotBlank() }
    ?: throw GradleException("packages/google: 'google' version missing in openiap-versions.json")
val isPublishTaskRequested = gradle.startParameter.taskNames.any { taskName ->
    taskName.contains("publish", ignoreCase = true) ||
        taskName.contains("mavenCentral", ignoreCase = true)
}

android {
    namespace = "io.github.hyochan.openiap"
    compileSdk = 35

    defaultConfig {
        minSdk = 23
        
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")
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
        }
        // Amazon flavor - Amazon Appstore SDK IAP only
        create("amazon") {
            dimension = "platform"
            buildConfigField("String", "OPENIAP_STORE", "\"amazon\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // Enable Compose for composables in this library (IapContext)
    buildFeatures {
        compose = true
        buildConfig = true
    }

    // Explicit source set configuration for shared code
    sourceSets {
        named("main") {
            java.srcDirs("src/main/java")
        }
        named("play") {
            java.srcDirs("src/play/java")
        }
        named("horizon") {
            java.srcDirs("src/horizon/java")
        }
        named("amazon") {
            java.srcDirs("src/amazon/java")
            manifest.srcFile("src/amazon/AndroidManifest.xml")
        }
        named("testPlay") {
            java.srcDirs("src/testPlay/java")
        }
        named("testHorizon") {
            java.srcDirs("src/testHorizon/java")
        }
        named("testAmazon") {
            java.srcDirs("src/testAmazon/java")
        }
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    val playBillingVersion = "8.3.0"
    val coroutinesVersion = "1.9.0"
    val horizonPlatformVersion = "77.0.1"
    val horizonBillingCompatibilityVersion = "1.1.1"

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")

    // Billing libraries per flavor (completely independent):
    // - Play flavor uses Google Play Billing (main/ source uses it)
    // - Horizon flavor uses Meta Horizon Billing Compatibility Library

    // Play flavor: Google Play Billing API (compile + runtime)
    // Version 8.3.0 adds External Payments Program support (Japan only)
    add("playCompileOnly", "com.android.billingclient:billing-ktx:$playBillingVersion")
    add("playApi", "com.android.billingclient:billing-ktx:$playBillingVersion")

    // Horizon flavor: Meta Horizon Platform SDK and Billing Compatibility Library (compile + runtime)
    add("horizonCompileOnly", "com.meta.horizon.platform.ovr:android-platform-sdk:$horizonPlatformVersion")
    add("horizonApi", "com.meta.horizon.platform.ovr:android-platform-sdk:$horizonPlatformVersion")
    add("horizonCompileOnly", "com.meta.horizon.billingclient.api:horizon-billing-compatibility:$horizonBillingCompatibilityVersion")
    add("horizonApi", "com.meta.horizon.billingclient.api:horizon-billing-compatibility:$horizonBillingCompatibilityVersion")

    // Amazon flavor: Amazon Appstore SDK for Fire OS IAP
    add("amazonCompileOnly", "com.amazon.device:amazon-appstore-sdk:3.0.8")
    add("amazonApi", "com.amazon.device:amazon-appstore-sdk:3.0.8")

    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:$coroutinesVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$coroutinesVersion")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    
    // JSON handling
    implementation("com.google.code.gson:gson:2.10.1")

    // Compose runtime (for CompositionLocal provider in IapContext)
    val composeUiVersion = (project.findProperty("COMPOSE_UI_VERSION") as String?) ?: "1.6.8"
    implementation("androidx.compose.runtime:runtime:$composeUiVersion")
    implementation("androidx.compose.ui:ui:$composeUiVersion")
    
    // Testing dependencies
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:$coroutinesVersion")
    // Add Google Play Billing for tests (all flavors need it for OpenIapErrorTest)
    testImplementation("com.android.billingclient:billing-ktx:$playBillingVersion")
    // Robolectric for lightweight Android JVM tests (e.g. Horizon no-op listener)
    testImplementation("org.robolectric:robolectric:4.13")
    testImplementation("androidx.test:core:1.5.0")

    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}

// Configure Vanniktech Maven Publish
// Determine which variant to publish based on gradle.properties or default to play
val publishVariant = project.findProperty("OPENIAP_PUBLISH_VARIANT")?.toString() ?: "play"

mavenPublishing {
    val groupId = project.findProperty("OPENIAP_GROUP_ID")?.toString() ?: "io.github.hyochan.openiap"

    when (publishVariant) {
        "horizon" -> {
            coordinates(groupId, "openiap-google-horizon", openIapVersion)

            // Publish the Horizon flavor (Meta Horizon Billing)
            configure(com.vanniktech.maven.publish.AndroidSingleVariantLibrary(
                variant = "horizonRelease",
                sourcesJar = true,
                publishJavadocJar = true
            ))

            pom {
                name.set("OpenIAP Horizon")
                description.set("OpenIAP Android library using Meta Horizon Billing Compatibility Library")
                url.set("https://github.com/hyodotdev/openiap")
            }
        }
        "amazon" -> {
            coordinates(groupId, "openiap-google-amazon", openIapVersion)

            // Publish the Amazon flavor (Amazon Appstore SDK)
            configure(com.vanniktech.maven.publish.AndroidSingleVariantLibrary(
                variant = "amazonRelease",
                sourcesJar = true,
                publishJavadocJar = true
            ))

            pom {
                name.set("OpenIAP Amazon")
                description.set("OpenIAP Android library using Amazon Appstore SDK IAP")
                url.set("https://github.com/hyodotdev/openiap")
            }
        }
        else -> { // "play" is default
            coordinates(groupId, "openiap-google", openIapVersion)

            // Publish the Play flavor (Google Play Billing)
            configure(com.vanniktech.maven.publish.AndroidSingleVariantLibrary(
                variant = "playRelease",
                sourcesJar = true,
                publishJavadocJar = true
            ))

            pom {
                name.set("OpenIAP GMS")
                description.set("OpenIAP Android library using Google Play Billing v8")
                url.set("https://github.com/hyodotdev/openiap")
            }
        }
    }

    if (isPublishTaskRequested) {
        // Use the Central Portal publishing path only for publishing tasks.
        publishToMavenCentral()
        signAllPublications()
    }

    pom {
        licenses {
            license {
                name.set("MIT License")
                url.set("https://opensource.org/licenses/MIT")
            }
        }
        developers {
            developer {
                id.set("hyochan")
                name.set("hyochan")
            }
        }
        scm {
            connection.set("scm:git:git://github.com/hyodotdev/openiap.git")
            developerConnection.set("scm:git:ssh://git@github.com/hyodotdev/openiap.git")
            url.set("https://github.com/hyodotdev/openiap/tree/main/packages/google")
        }
    }
}
