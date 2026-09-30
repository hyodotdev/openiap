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
    layout.buildDirectory.set(rootProject.layout.buildDirectory.dir("openiap-core"))
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
val isCentralPublishTaskRequested =
    gradle.startParameter.taskNames.any { taskName ->
        taskName.contains("mavenCentral", ignoreCase = true)
    }

android {
    namespace = "io.github.hyochan.openiap.core"
    compileSdk = 36
    defaultConfig {
        minSdk = 23
        buildConfigField("String", "OPENIAP_CORE_VERSION", "\"$openIapVersion\"")
        consumerProguardFiles("consumer-rules.pro")
    }
    sourceSets.named("main") {
        java.setSrcDirs(listOf("../openiap/src/main/java"))
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    testOptions.unitTests.isIncludeAndroidResources = true
}

extensions.configure<KotlinAndroidProjectExtension> {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
        freeCompilerArgs.add("-Xjvm-default=all")
    }
}

dependencies {
    api("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
    implementation("androidx.core:core:1.18.0")
    api("androidx.lifecycle:lifecycle-runtime:2.10.0")
    api("androidx.lifecycle:lifecycle-viewmodel:2.10.0")
    implementation("com.google.code.gson:gson:2.14.0")
    val composeUiVersion = project.findProperty("COMPOSE_UI_VERSION")?.toString() ?: "1.11.4"
    api("androidx.compose.runtime:runtime:$composeUiVersion")
    implementation("androidx.compose.ui:ui:$composeUiVersion")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.16.1")
    testImplementation("androidx.test:core:1.7.0")
}

if (isStandaloneGoogleBuild) {
    extensions.configure<MavenPublishBaseExtension> {
        val groupId = project.findProperty("OPENIAP_GROUP_ID")?.toString() ?: "io.github.hyochan.openiap"

        coordinates(groupId, "openiap-core", openIapVersion)
        configure(com.vanniktech.maven.publish.AndroidSingleVariantLibrary(
            variant = "release", sourcesJar = SourcesJar.Sources(), javadocJar = JavadocJar.Empty(),
        ))
        pom {
            name.set("OpenIAP Core")
            description.set("Store-neutral Android provider contract and runtime")
            url.set("https://github.com/hyodotdev/openiap")
        }

        if (isCentralPublishTaskRequested) {
            // Local compatibility tests publish without release credentials.
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
