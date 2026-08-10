import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.library") version "8.13.2"
    id("org.jetbrains.kotlin.android") version "2.1.20"
}

layout.buildDirectory.set(file(providers.gradleProperty("consumerBuildDirectory").get()))

android {
    namespace = "dev.hyo.openiap.compatibility"
    compileSdk = 36

    defaultConfig {
        minSdk = 23
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
    implementation(
        "io.github.hyochan.openiap:${providers.gradleProperty("openIapArtifact").get()}:${providers.gradleProperty("openIapVersion").get()}",
    )
}
