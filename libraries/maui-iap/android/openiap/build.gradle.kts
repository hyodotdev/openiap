import groovy.json.JsonSlurper
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

val versionsFile = file("../../../../openiap-versions.json")
val versionsJson = JsonSlurper().parseText(versionsFile.readText()) as Map<*, *>
val openIapGoogleVersion = versionsJson["google"]?.toString() ?: "2.1.2"

android {
    namespace = "dev.hyo.openiap.maui"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
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

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
