import org.jetbrains.kotlin.gradle.ExperimentalKotlinGradlePluginApi
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties

// Load local.properties
val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localProperties.load(localPropertiesFile.inputStream())
}

// Load OpenIAP versions from openiap-versions.json
val openIapVersionsFile = rootProject.file("openiap-versions.json")
val appleVersion = if (openIapVersionsFile.exists()) {
    val jsonContent = openIapVersionsFile.readText()
    Regex(""""apple":\s*"([^"]+)"""").find(jsonContent)?.groupValues?.get(1) ?: "1.2.5"
} else {
    "1.2.5"
}
val googleVersion = if (openIapVersionsFile.exists()) {
    val jsonContent = openIapVersionsFile.readText()
    Regex(""""google":\s*"([^"]+)"""").find(jsonContent)?.groupValues?.get(1) ?: "1.2.10"
} else {
    "1.2.10"
}

println("DEBUG: OpenIAP versions loaded - Apple: $appleVersion, Google: $googleVersion")

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
    println("DEBUG: GPG key loaded from environment variable (length: ${cleanedKey.length})")
} else {
    // Local development: Read GPG key from file if specified
    val keyFile = localProperties.getProperty("signingInMemoryKeyFile")
    if (keyFile != null) {
        val keyFileHandle = rootProject.file(keyFile)
        if (keyFileHandle.exists()) {
            val keyContent = keyFileHandle.readText().trim()
            localProperties.setProperty("signingInMemoryKey", keyContent)
            project.extensions.extraProperties.set("signingInMemoryKey", keyContent)
            println("DEBUG: GPG key loaded from file: $keyFile (length: ${keyContent.length})")
        } else {
            println("DEBUG: GPG key file not found: $keyFile")
        }
    } else {
        println("DEBUG: No GPG key configured (for CI, set ORG_GRADLE_PROJECT_signingInMemoryKey)")
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
    "sonatypeRepositoryId",
    "sonatypeAutomaticRelease",
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
        if (propName == "signingInMemoryKey") {
            println("DEBUG: signingInMemoryKey is set (length: ${value.length})")
            println("DEBUG: First 50 chars: ${value.take(50)}")
        }
    } else if (propName == "signingInMemoryKey") {
        println("DEBUG: signingInMemoryKey is NOT set!")
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
version = localProperties.getProperty("libraryVersion") ?: "1.0.0-alpha02"

kotlin {
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
        version = localProperties.getProperty("libraryVersion")
            ?: project.findProperty("libraryVersion")?.toString()
            ?: "1.0.0"
        summary = "KMP IAP Library"
        homepage = "https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap"
        ios.deploymentTarget = "15.0"

        pod("openiap") {
            version = appleVersion
            source = git("https://github.com/hyodotdev/openiap.git") {
                tag = appleVersion
            }
            moduleName = "OpenIAP"
        }
    }

    sourceSets {
        val commonMain by getting {
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

// Task to update README and docs version
val updateReadmeVersion = tasks.register("updateReadmeVersion") {
    doLast {
        val version = localProperties.getProperty("libraryVersion") ?: "1.0.0-alpha04"

        // Update openiap-versions.json with kmp-iap version
        val versionsFile = rootProject.file("openiap-versions.json")
        if (versionsFile.exists()) {
            val versionsContent = versionsFile.readText()
            val updatedVersions = versionsContent.replace(
                Regex("\"kmp-iap\":\\s*\"[^\"]+\""),
                "\"kmp-iap\": \"$version\""
            )
            versionsFile.writeText(updatedVersions)
            println("Updated openiap-versions.json with kmp-iap version: $version")
        }

        // Files to update
        val filesToUpdate = listOf(
            rootProject.file("README.md"),
            rootProject.file("docs/docs/intro.md"),
            rootProject.file("docs/docs/getting-started/installation.md")
        )

        // Version patterns to replace
        val replacements = listOf(
            Regex("implementation\\(\"io\\.github\\.hyochan:kmp-iap:[^\"]+\"\\)") to
                "implementation(\"io.github.hyochan:kmp-iap:$version\")",
            Regex("io\\.github\\.hyochan:kmp-iap:[^\"]+") to
                "io.github.hyochan:kmp-iap:$version",
            Regex("kmp-iap = \"[^\"]+\"") to
                "kmp-iap = \"$version\""
        )

        filesToUpdate.forEach { file ->
            if (file.exists()) {
                var content = file.readText()
                replacements.forEach { (pattern, replacement) ->
                    content = content.replace(pattern, replacement)
                }
                file.writeText(content)
                println("Updated ${file.name} with version: $version")
            }
        }
    }
}

// Task to make podspec read openiap-versions.json dynamically
val updatePodspecDependency = tasks.register("updatePodspecDependency") {
    dependsOn("podspec")
    doLast {
        val podspecFile = file("library.podspec")
        if (!podspecFile.exists()) {
            println("WARN: library.podspec not found")
            return@doLast
        }

        val content = podspecFile.readText()
        // Replace hardcoded dependency with dynamic version loading from JSON
        val updatedContent = content.replace(
            Regex("""spec\.dependency\s+'openiap',\s+'[^']+'"""),
            """# Read OpenIAP version from openiap-versions.json
    require 'json'
    openiap_versions_file = File.join(File.dirname(__FILE__), '..', 'openiap-versions.json')
    openiap_apple_version = '1.2.5' # fallback version
    if File.exist?(openiap_versions_file)
        openiap_versions = JSON.parse(File.read(openiap_versions_file))
        openiap_apple_version = openiap_versions['apple'] || openiap_apple_version
    end
    spec.dependency 'openiap', openiap_apple_version"""
        )

        podspecFile.writeText(updatedContent)
        println("Updated library.podspec to read openiap version dynamically from openiap-versions.json")
    }
}

// Automatically update README when publishing
tasks.withType<PublishToMavenRepository> {
    dependsOn(updateReadmeVersion)
}

// Only configure publishing when we have signing credentials
val hasSigningKey = localProperties.getProperty("signingInMemoryKey") != null ||
    System.getenv("ORG_GRADLE_PROJECT_signingInMemoryKey") != null

mavenPublishing {
    // Explicitly use Central Portal instead of legacy Sonatype
    publishToMavenCentral(com.vanniktech.maven.publish.SonatypeHost.CENTRAL_PORTAL)
    
    // Only sign if we have credentials
    if (hasSigningKey) {
        signAllPublications()
    }
    
    coordinates("io.github.hyochan", "kmp-iap", localProperties.getProperty("libraryVersion") ?: "1.0.0-alpha02")
    
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
        url.set("https://github.com/hyochan/kmp-iap")
        
        licenses {
            license {
                name.set("MIT License")
                url.set("https://opensource.org/licenses/MIT")
                distribution.set("repo")
            }
        }
        
        developers {
            developer {
                id.set("hyochan")
                name.set("Hyo Chan Jang")
                email.set("hyo@hyo.dev")
                url.set("https://github.com/hyochan/")
                organization.set("hyochan")
                organizationUrl.set("https://github.com/hyochan")
            }
        }
        
        scm {
            connection.set("scm:git:git://github.com/hyochan/kmp-iap.git")
            developerConnection.set("scm:git:ssh://git@github.com/hyochan/kmp-iap.git")
            url.set("https://github.com/hyochan/kmp-iap")
            tag.set("v${localProperties.getProperty("libraryVersion") ?: "1.0.0-alpha02"}")
        }
        
        issueManagement {
            system.set("GitHub")
            url.set("https://github.com/hyochan/kmp-iap/issues")
        }
    }
}

// Manual signing configuration (disabled in favor of vanniktech signing)
/*
signing {
    val signingKeyId: String? by project
    val signingPassword: String? by project
    
    // Try to read signing key from file if not available in properties
    val signingKey: String? = project.findProperty("signingKey") as String? ?: 
        rootProject.file("temp_private_key.asc").takeIf { it.exists() }?.readText()
    
    println("DEBUG: signingKeyId = ${signingKeyId?.substring(0, 8)}...")
    println("DEBUG: signingKey present = ${signingKey != null}")
    println("DEBUG: signingPassword present = ${signingPassword != null}")
    
    if (signingKeyId != null && signingKey != null) {
        println("DEBUG: Configuring in-memory PGP keys for signing")
        useInMemoryPgpKeys(signingKeyId, signingKey, signingPassword)
        sign(publishing.publications)
    } else {
        println("DEBUG: Signing disabled - missing required properties")
    }
}
*/
