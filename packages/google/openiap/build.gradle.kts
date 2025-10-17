import groovy.json.JsonSlurper

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.vanniktech.maven.publish")
}

// Read version from monorepo root openiap-versions.json
val versionsFile = File(rootDir.parentFile.parentFile, "openiap-versions.json")
val versionsJson = JsonSlurper().parseText(versionsFile.readText()) as Map<*, *>
val openIapVersion: String = versionsJson["google"]?.toString() ?: "1.0.0"

android {
    namespace = "io.github.hyochan.openiap"
    compileSdk = 34

    defaultConfig {
        minSdk = 21
        
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

    flavorDimensions += "store"
    productFlavors {
        create("play") {
            dimension = "store"
            buildConfigField("String", "OPENIAP_STORE", "\"play\"")
        }
        create("horizon") {
            dimension = "store"
            buildConfigField("String", "OPENIAP_STORE", "\"horizon\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    // Enable Compose for composables in this library (IapContext)
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    
    // Google Play Billing Library (align with app/lib v8)
    api("com.android.billingclient:billing-ktx:8.0.0")

    // Horizon Billing Compatibility Library (for horizon flavor only)
    add("horizonImplementation", "com.meta.horizon.billingclient.api:horizon-billing-compatibility:1.1.1")

    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
    
    // JSON handling
    implementation("com.google.code.gson:gson:2.10.1")

    // Compose runtime (for CompositionLocal provider in IapContext)
    val composeUiVersion = (project.findProperty("COMPOSE_UI_VERSION") as String?) ?: "1.6.8"
    implementation("androidx.compose.runtime:runtime:$composeUiVersion")
    implementation("androidx.compose.ui:ui:$composeUiVersion")
    
    // Testing dependencies
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}

// Configure Vanniktech Maven Publish
mavenPublishing {
    val groupId = project.findProperty("OPENIAP_GROUP_ID")?.toString() ?: "io.github.hyochan.openiap"
    coordinates(groupId, "openiap-google", openIapVersion)

    // Publish the Play flavor (default for Google Play Store)
    configure(com.vanniktech.maven.publish.AndroidSingleVariantLibrary(
        variant = "playRelease",
        sourcesJar = true,
        publishJavadocJar = true
    ))

    // Use the new Central Portal publishing which avoids Nexus staging profile lookups.
    publishToMavenCentral(com.vanniktech.maven.publish.SonatypeHost.CENTRAL_PORTAL)
    signAllPublications()

    pom {
        name.set("OpenIAP GMS")
        description.set("OpenIAP Android library using Google Play Billing v8")
        url.set("https://github.com/hyodotdev/openiap")

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
