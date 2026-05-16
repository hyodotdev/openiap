import org.jetbrains.kotlin.gradle.ExperimentalKotlinGradlePluginApi
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.TaskAction
import java.util.Properties

abstract class GenerateKmpIapVersionTask : DefaultTask() {
    @get:Input
    abstract val libraryVersion: Property<String>

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun generate() {
        val versionFile = outputDir
            .file("io/github/hyochan/kmpiap/KmpIapVersion.kt")
            .get()
            .asFile

        versionFile.parentFile.mkdirs()
        versionFile.writeText(
            """
            package io.github.hyochan.kmpiap

            internal const val KMP_IAP_VERSION = "${libraryVersion.get()}"

            internal fun kmpIapVersionString(platform: String): String =
                "KMP-IAP v" + KMP_IAP_VERSION + " (" + platform + ")"
            """.trimIndent() + "\n"
        )
    }
}

val kmpRootDir = projectDir.parentFile

val kmpGradleProperties = Properties()
val kmpGradlePropertiesFile = kmpRootDir.resolve("gradle.properties")
if (kmpGradlePropertiesFile.exists()) {
    kmpGradleProperties.load(kmpGradlePropertiesFile.inputStream())
}

// Load local.properties
val localProperties = Properties()
val localPropertiesFile = kmpRootDir.resolve("local.properties")
if (localPropertiesFile.exists()) {
    localProperties.load(localPropertiesFile.inputStream())
}

// Load OpenIAP versions from openiap-versions.json
val openIapVersionsFile = kmpRootDir.resolve("openiap-versions.json")
if (!openIapVersionsFile.isFile) {
    error("kmp-iap: missing openiap-versions.json at ${openIapVersionsFile.path}")
}
val openIapVersionsJson = openIapVersionsFile.readText()
fun openIapVersion(key: String): String =
    Regex(""""$key":\s*"([^"]+)"""")
        .find(openIapVersionsJson)
        ?.groupValues
        ?.get(1)
        ?.takeIf { it.isNotBlank() }
        ?: error("kmp-iap: '$key' version missing in openiap-versions.json")

val appleVersion = openIapVersion("apple")
val googleVersion = openIapVersion("google")
val localApplePodspecDir = kmpRootDir.resolve("../../packages/apple")
val kmpIapLibraryVersion = (project.findProperty("libraryVersion")?.toString()
    ?: kmpGradleProperties.getProperty("libraryVersion"))
    ?.takeIf { it.isNotBlank() }
    ?: error("kmp-iap: libraryVersion missing in gradle.properties")

println("OpenIAP versions loaded - Apple: $appleVersion, Google: $googleVersion")

// Load environment variables first (for CI)
System.getenv().forEach { (key, value) ->
    if (key.startsWith("ORG_GRADLE_PROJECT_")) {
        val propertyKey = key.removePrefix("ORG_GRADLE_PROJECT_")
        localProperties.setProperty(propertyKey, value)
        project.extensions.extraProperties.set(propertyKey, value)
    }
}

// Handle GPG key from environment variable or file
val envGpgKey = System.getenv("ORG_GRADLE_PROJECT_signingInMemoryKey")
if (envGpgKey != null && envGpgKey.isNotBlank()) {
    // CI/CD: Use environment variable directly
    val cleanedKey = envGpgKey.trim()
    localProperties.setProperty("signingInMemoryKey", cleanedKey)
    project.extensions.extraProperties.set("signingInMemoryKey", cleanedKey)
    println("GPG signing key loaded from environment")
} else {
    // Local development: Read GPG key from file if specified
    val keyFile = localProperties.getProperty("signingInMemoryKeyFile")
    if (keyFile != null) {
        val keyFileHandle = kmpRootDir.resolve(keyFile)
        if (keyFileHandle.exists()) {
            val keyContent = keyFileHandle.readText().trim()
            localProperties.setProperty("signingInMemoryKey", keyContent)
            project.extensions.extraProperties.set("signingInMemoryKey", keyContent)
            println("GPG signing key loaded from file: $keyFile")
        } else {
            println("GPG signing key file not found: $keyFile")
        }
    } else {
        println("No GPG signing key configured")
    }
}

// Add local properties to project properties
localProperties.forEach { key, value ->
    // Set as project extra properties
    project.extra.set(key.toString(), value)
    // Also set via extensions for vanniktech plugin
    project.extensions.extraProperties.set(key.toString(), value)
    
    // For vanniktech plugin, also set as system properties
    if (key.toString().startsWith("maven") || key.toString().startsWith("central") || key.toString().startsWith("signing")) {
        System.setProperty(key.toString(), value.toString())
    }
}

// Ensure critical properties are available as both project and system properties
val criticalProperties = listOf(
    "mavenCentralUsername",
    "mavenCentralPassword",
    "signingInMemoryKeyId",
    "signingInMemoryKey",
    "signingInMemoryKeyPassword",
    "libraryVersion"
)

criticalProperties.forEach { propName ->
    val value = localProperties.getProperty(propName) ?: project.findProperty(propName) as String?
    if (value != null) {
        project.extra.set(propName, value)
        System.setProperty(propName, value)
        // Also set as gradle property for vanniktech plugin
        project.extensions.extraProperties.set(propName, value)
    }
}

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidLibrary)
    alias(libs.plugins.vanniktechMavenPublish)
    alias(libs.plugins.dokka)
    alias(libs.plugins.kotlinxSerialization)
    kotlin("native.cocoapods")
    signing
}

group = "io.github.hyochan"
version = kmpIapLibraryVersion

val generateKmpIapVersion = tasks.register<GenerateKmpIapVersionTask>("generateKmpIapVersion") {
    libraryVersion.set(kmpIapLibraryVersion)
    outputDir.set(layout.buildDirectory.dir("generated/kmpIapVersion/commonMain/kotlin"))
}

fun dynamicKmpPodspec(): String =
    """
    Pod::Spec.new do |spec|
        spec.name                     = 'library'
        gradle_properties_file = File.join(File.dirname(__FILE__), '..', 'gradle.properties')
        unless File.exist?(gradle_properties_file)
            raise 'kmp-iap: missing gradle.properties'
        end
        library_version = File.read(gradle_properties_file)
            .lines
            .find { |line| line.start_with?('libraryVersion=') }
            &.split('=', 2)
            &.last
            &.strip
        if library_version.to_s.empty?
            raise "kmp-iap: 'libraryVersion' missing in gradle.properties"
        end
        spec.version                  = library_version
        spec.homepage                 = 'https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap'
        spec.source                   = { :git => 'https://github.com/hyodotdev/openiap.git', :tag => "kmp-iap-#{library_version}" }
        spec.authors                  = { 'Hyo Chan Jang' => 'hyo@hyo.dev' }
        spec.license                  = { :type => 'Apache-2.0', :file => '../LICENSE' }
        spec.summary                  = 'Kotlin Multiplatform OpenIAP library'
        spec.vendored_frameworks      = 'build/cocoapods/framework/library.framework'
        spec.libraries                = 'c++'
        spec.ios.deployment_target    = '15.0'
        require 'json'
        openiap_versions_file = File.join(File.dirname(__FILE__), '..', 'openiap-versions.json')
        unless File.exist?(openiap_versions_file)
            raise 'kmp-iap: missing openiap-versions.json'
        end
        openiap_versions = JSON.parse(File.read(openiap_versions_file))
        openiap_apple_version = openiap_versions['apple']
        if openiap_apple_version.to_s.empty?
            raise "kmp-iap: 'apple' version missing in openiap-versions.json"
        end
        spec.dependency 'openiap', openiap_apple_version
        if !Dir.exist?('build/cocoapods/framework/library.framework') || Dir.empty?('build/cocoapods/framework/library.framework')
            raise "

            Kotlin framework 'library' doesn't exist yet, so a proper Xcode project can't be generated.
            'pod install' should be executed after running ':generateDummyFramework' Gradle task:

                ./gradlew :library:generateDummyFramework

            Alternatively, proper pod installation is performed during Gradle sync in the IDE (if Podfile location is set)"
        end
        spec.xcconfig = {
            'ENABLE_USER_SCRIPT_SANDBOXING' => 'NO',
        }
        spec.pod_target_xcconfig = {
            'KOTLIN_PROJECT_PATH' => ':library',
            'PRODUCT_MODULE_NAME' => 'library',
        }
        spec.script_phases = [
            {
                :name => 'Build library',
                :execution_position => :before_compile,
                :shell_path => '/bin/sh',
                :script => <<-SCRIPT
                    if [ "YES" = "${'$'}OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED" ]; then
                      echo "Skipping Gradle build task invocation due to OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED environment variable set to \"YES\""
                      exit 0
                    fi
                    set -ev
                    REPO_ROOT="${'$'}PODS_TARGET_SRCROOT"
                    "${'$'}REPO_ROOT/../gradlew" -p "${'$'}REPO_ROOT" ${'$'}KOTLIN_PROJECT_PATH:syncFramework \
                        -Pkotlin.native.cocoapods.platform=${'$'}PLATFORM_NAME \
                        -Pkotlin.native.cocoapods.archs="${'$'}ARCHS" \
                        -Pkotlin.native.cocoapods.configuration="${'$'}CONFIGURATION"
                SCRIPT
            }
        ]

    end
    """.trimIndent() + "\n"

kotlin {
    // openiap WebhookTransport is shipped as `expect class` in
    // commonMain with platform-specific actual implementations in
    // androidMain / iosMain. Kotlin 2.x emits a warning for this
    // pattern unless the `-Xexpect-actual-classes` flag is set;
    // applying it here keeps the build clean for the kmp-iap
    // consumers without surfacing warnings.
    @OptIn(ExperimentalKotlinGradlePluginApi::class)
    compilerOptions {
        freeCompilerArgs.add("-Xexpect-actual-classes")
    }

    androidTarget {
        publishLibraryVariants("release")
        @OptIn(ExperimentalKotlinGradlePluginApi::class)
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_11)
        }
    }

    // iOS targets
    iosX64()
    iosArm64()
    iosSimulatorArm64()

    // CocoaPods configuration
    cocoapods {
        version = kmpIapLibraryVersion
        summary = "KMP IAP Library"
        homepage = "https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap"
        ios.deploymentTarget = "15.0"

        pod("openiap") {
            version = appleVersion
            source = if (localApplePodspecDir.resolve("openiap.podspec").exists()) {
                path(localApplePodspecDir)
            } else {
                git("https://github.com/hyodotdev/openiap.git") {
                    tag = appleVersion
                }
            }
            moduleName = "OpenIAP"
        }
    }

    sourceSets {
        val commonMain by getting {
            kotlin.srcDir(generateKmpIapVersion)
            dependencies {
                api(libs.kotlinx.coroutines.core)
                implementation(libs.kotlinx.datetime)
                implementation(libs.kotlinx.serialization.json)
            }
        }
        val commonTest by getting {
            dependencies {
                implementation(libs.kotlin.test)
                implementation(libs.kotlinx.coroutines.test)
            }
        }
        val androidMain by getting {
            dependencies {
                implementation("io.github.hyochan.openiap:openiap-google:$googleVersion")
            }
        }
    }
}

tasks.matching { it.name == "podspec" }.configureEach {
    doLast {
        projectDir.resolve("library.podspec").writeText(dynamicKmpPodspec())
    }
}

android {
    namespace = "io.github.hyochan.kmpiap"
    compileSdk = libs.versions.android.compileSdk.get().toInt()
    defaultConfig {
        minSdk = libs.versions.android.minSdk.get().toInt()
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

// Only configure publishing when we have signing credentials
val hasSigningKey = localProperties.getProperty("signingInMemoryKey") != null ||
    System.getenv("ORG_GRADLE_PROJECT_signingInMemoryKey") != null

mavenPublishing {
    // Central Portal is the default Maven Central target on Vanniktech 0.33+.
    publishToMavenCentral()
    
    // Only sign if we have credentials
    if (hasSigningKey) {
        signAllPublications()
    }
    
    coordinates("io.github.hyochan", "kmp-iap", kmpIapLibraryVersion)
    
    // Configure publications with empty Javadoc JAR (Maven Central compatible)
    configure(
        com.vanniktech.maven.publish.KotlinMultiplatform(
            javadocJar = com.vanniktech.maven.publish.JavadocJar.Empty(),
            sourcesJar = true,
        )
    )
    
    pom {
        name.set("KMP IAP")
        description.set("A Kotlin Multiplatform library for in app purchase on Android, iOS, Desktop, and Web platforms")
        inceptionYear.set("2025")
        url.set("https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap")
        
        licenses {
            license {
                name.set("Apache License 2.0")
                url.set("https://www.apache.org/licenses/LICENSE-2.0")
                distribution.set("repo")
            }
        }
        
        developers {
            developer {
                id.set("hyochan")
                name.set("Hyo Chan Jang")
                email.set("hyo@hyo.dev")
                url.set("https://github.com/hyochan/")
                organization.set("hyodotdev")
                organizationUrl.set("https://github.com/hyodotdev")
            }
        }
        
        scm {
            connection.set("scm:git:https://github.com/hyodotdev/openiap.git")
            developerConnection.set("scm:git:ssh://git@github.com/hyodotdev/openiap.git")
            url.set("https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap")
            tag.set("kmp-iap-$kmpIapLibraryVersion")
        }
        
        issueManagement {
            system.set("GitHub")
            url.set("https://github.com/hyodotdev/openiap/issues")
        }
    }
}
