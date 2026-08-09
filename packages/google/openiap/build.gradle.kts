import com.vanniktech.maven.publish.JavadocJar
import com.vanniktech.maven.publish.MavenPublishBaseExtension
import com.vanniktech.maven.publish.SourcesJar
import groovy.json.JsonSlurper
import org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.io.File

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
    id("org.jetbrains.kotlin.android") apply false
    id("org.jetbrains.kotlin.plugin.compose") apply false
    id("com.vanniktech.maven.publish") apply false
}

// AGP 9 provides built-in Kotlin, but Flutter 3.44's migrator can explicitly
// disable it while retaining AGP 9. Honor the host flag before using the AGP
// major as the default so this included build works in both migration states.
val androidGradlePluginMajor =
    com.android.Version.ANDROID_GRADLE_PLUGIN_VERSION.substringBefore('.').toInt()
val builtInKotlinProperty = providers.gradleProperty("android.builtInKotlin").orNull
val usesBuiltInKotlin =
    builtInKotlinProperty?.let { value ->
        when (value.lowercase()) {
            "true" -> true
            "false" -> false
            else -> throw GradleException("android.builtInKotlin must be true or false")
        }
    } ?: (androidGradlePluginMajor >= 9)
if (!usesBuiltInKotlin) {
    pluginManager.apply("org.jetbrains.kotlin.android")
}
pluginManager.apply("org.jetbrains.kotlin.plugin.compose")

// Consumer examples include this module in their own Gradle builds, while KMP
// and MAUI consume the Google root as a composite build. Keep every consumer's
// intermediates under its own root build directory so sequential or parallel
// builds cannot corrupt packages/google/openiap/build. Applying the publication
// plugin there would also couple consumers to the standalone publishing setup.
val isStandaloneGoogleBuild =
    gradle.parent == null &&
        rootProject.projectDir.canonicalFile == projectDir.parentFile.canonicalFile
if (!isStandaloneGoogleBuild) {
    layout.buildDirectory.set(rootProject.layout.buildDirectory.dir("openiap-google"))
    tasks.configureEach {
        // The same source project is embedded by hosts that intentionally use
        // different AGP/Kotlin versions. Gradle's shared build cache can restore
        // a host-incompatible classes jar even though the isolated build path is
        // correct. Keep normal up-to-date checks, but never exchange cached task
        // outputs between embedded consumers.
        outputs.doNotCacheIf("embedded OpenIAP Google host toolchains differ") { true }
    }
}
if (isStandaloneGoogleBuild) {
    pluginManager.apply("com.vanniktech.maven.publish")
}

// Read version from Gradle property first, then from monorepo root openiap-versions.json.
// Release and local publish scripts pass -P/ORG_GRADLE_PROJECT_openIapVersion;
// normal development builds use the repository SSOT file.
val versionsFile = locateOpeniapVersionsFile(projectDir)
val versionsJson = JsonSlurper().parseText(versionsFile.readText()) as Map<*, *>
val openIapVersion: String =
    project.findProperty("openIapVersion")?.toString()?.takeIf { it.isNotBlank() }
        ?: versionsJson["google"]?.toString()?.takeIf { it.isNotBlank() }
        ?: throw GradleException("packages/google: 'google' version missing in openiap-versions.json")
val isPublishTaskRequested =
    gradle.startParameter.taskNames.any { taskName ->
        taskName.contains("publish", ignoreCase = true) ||
            taskName.contains("mavenCentral", ignoreCase = true)
    }

android {
    namespace = "io.github.hyochan.openiap"
    compileSdk = 36

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
                "proguard-rules.pro",
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

extensions.configure<KotlinAndroidProjectExtension> {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    val playBillingVersion = "9.1.0"
    val coroutinesVersion = "1.11.0"
    val horizonBillingCompatibilityVersion = "2.0.0"
    val horizonPlatformKotlinVersion = "0.2.2"
    // 1.10+ is compiled with Kotlin 2.3 metadata, which Expo SDK 57's Kotlin
    // 2.1.20 compiler cannot consume. 1.9.0 is the newest readable release.
    val horizonSerializationVersion = "1.9.0"

    // AndroidX merged these KTX APIs into their base artifacts. Depending on
    // the empty compatibility artifacts keeps obsolete coordinates alive.
    // 1.19.0 requires compileSdk 37 and AGP 9.1; 1.18.0 is the latest release
    // compatible with this library's API 36 / AGP 8.13 support line.
    implementation("androidx.core:core:1.18.0")
    implementation("androidx.lifecycle:lifecycle-runtime:2.10.0")

    // Billing libraries per flavor (completely independent):
    // - Play flavor uses Google Play Billing (main/ source uses it)
    // - Horizon flavor uses Meta Horizon Billing Compatibility Library

    // Play flavor: Google Play Billing API (compile + runtime)
    // Version 9.1.0 adds Billing Choice and keeps 8.3.0 External Payments support.
    // OpenIAP uses the callback API only. The core artifact also avoids forcing
    // consumers to match the Kotlin metadata version used to publish billing-ktx.
    add("playCompileOnly", "com.android.billingclient:billing:$playBillingVersion")
    add("playApi", "com.android.billingclient:billing:$playBillingVersion")

    // Horizon flavor: Meta Billing Compatibility 2.x uses the current Kotlin
    // platform SDK modules transitively; do not also ship the legacy OVR SDK.
    add("horizonCompileOnly", "com.meta.horizon.billingclient.api:horizon-billing-compatibility:$horizonBillingCompatibilityVersion")
    add("horizonApi", "com.meta.horizon.billingclient.api:horizon-billing-compatibility:$horizonBillingCompatibilityVersion")
    for (module in listOf("core-kotlin", "user-age-category-kotlin", "iap-kotlin")) {
        add("horizonApi", "com.meta.horizon.platform.sdk:$module:$horizonPlatformKotlinVersion")
    }
    add("horizonApi", "org.jetbrains.kotlinx:kotlinx-serialization-json:$horizonSerializationVersion")

    // Amazon flavor: Amazon Appstore SDK for Fire OS IAP
    add("amazonCompileOnly", "com.amazon.device:amazon-appstore-sdk:3.0.9")
    add("amazonApi", "com.amazon.device:amazon-appstore-sdk:3.0.9")

    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:$coroutinesVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$coroutinesVersion")
    implementation("androidx.lifecycle:lifecycle-viewmodel:2.10.0")

    // JSON handling
    implementation("com.google.code.gson:gson:2.14.0")

    // Compose runtime (for CompositionLocal provider in IapContext)
    val composeUiVersion = (project.findProperty("COMPOSE_UI_VERSION") as String?) ?: "1.11.4"
    implementation("androidx.compose.runtime:runtime:$composeUiVersion")
    implementation("androidx.compose.ui:ui:$composeUiVersion")

    // Testing dependencies
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:$coroutinesVersion")
    // Add Google Play Billing for tests (all flavors need it for OpenIapErrorTest)
    testImplementation("com.android.billingclient:billing:$playBillingVersion")
    // Robolectric for lightweight Android JVM tests (e.g. Horizon no-op listener)
    testImplementation("org.robolectric:robolectric:4.16.1")
    testImplementation("androidx.test:core:1.7.0")

    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
}

// Configure Vanniktech Maven Publish
// Determine which variant to publish based on gradle.properties or default to play
val publishVariant = project.findProperty("OPENIAP_PUBLISH_VARIANT")?.toString() ?: "play"

if (isStandaloneGoogleBuild) {
    extensions.configure<MavenPublishBaseExtension> {
        val groupId = project.findProperty("OPENIAP_GROUP_ID")?.toString() ?: "io.github.hyochan.openiap"

        when (publishVariant) {
            "horizon" -> {
                coordinates(groupId, "openiap-google-horizon", openIapVersion)

                // Publish the Horizon flavor (Meta Horizon Billing)
                configure(
                    com.vanniktech.maven.publish.AndroidSingleVariantLibrary(
                        variant = "horizonRelease",
                        sourcesJar = SourcesJar.Sources(),
                        javadocJar = JavadocJar.Empty(),
                    ),
                )

                pom {
                    name.set("OpenIAP Horizon")
                    description.set("OpenIAP Android library using Meta Horizon Billing Compatibility Library")
                    url.set("https://github.com/hyodotdev/openiap")
                }
            }
            "amazon" -> {
                coordinates(groupId, "openiap-google-amazon", openIapVersion)

                // Publish the Amazon flavor (Amazon Appstore SDK)
                configure(
                    com.vanniktech.maven.publish.AndroidSingleVariantLibrary(
                        variant = "amazonRelease",
                        sourcesJar = SourcesJar.Sources(),
                        javadocJar = JavadocJar.Empty(),
                    ),
                )

                pom {
                    name.set("OpenIAP Amazon")
                    description.set("OpenIAP Android library using Amazon Appstore SDK IAP")
                    url.set("https://github.com/hyodotdev/openiap")
                }
            }
            else -> { // "play" is default
                coordinates(groupId, "openiap-google", openIapVersion)

                // Publish the Play flavor (Google Play Billing)
                configure(
                    com.vanniktech.maven.publish.AndroidSingleVariantLibrary(
                        variant = "playRelease",
                        sourcesJar = SourcesJar.Sources(),
                        javadocJar = JavadocJar.Empty(),
                    ),
                )

                pom {
                    name.set("OpenIAP GMS")
                    description.set("OpenIAP Android library using Google Play Billing v9.1")
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
}
