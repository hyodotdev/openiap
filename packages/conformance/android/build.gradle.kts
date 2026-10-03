import com.vanniktech.maven.publish.AndroidSingleVariantLibrary
import com.vanniktech.maven.publish.JavadocJar
import com.vanniktech.maven.publish.MavenPublishBaseExtension
import com.vanniktech.maven.publish.SourcesJar
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android") apply false
    id("com.vanniktech.maven.publish") apply false
}

val builtInKotlin = providers.gradleProperty("android.builtInKotlin").orNull?.toBoolean()
    ?: (com.android.Version.ANDROID_GRADLE_PLUGIN_VERSION.substringBefore('.').toInt() >= 9)
if (!builtInKotlin) pluginManager.apply("org.jetbrains.kotlin.android")

val conformanceRoot = projectDir.parentFile
val suiteVersion = Regex("SUITE_VERSION = '([^']+)'").find(
    conformanceRoot.resolve("src/spec/suite-version.mjs").readText()
)?.groupValues?.get(1) ?: error("Missing conformance suite version")
val standalone = gradle.parent == null && rootProject.projectDir.canonicalFile ==
    projectDir.resolve("../../google").canonicalFile
if (standalone) pluginManager.apply("com.vanniktech.maven.publish")
else layout.buildDirectory.set(rootProject.layout.buildDirectory.dir("openiap-conformance"))

android {
    namespace = "dev.hyo.openiap.conformance"
    compileSdk = 36
    defaultConfig { minSdk = 23 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
extensions.configure<KotlinAndroidProjectExtension> {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
        freeCompilerArgs.add("-Xjvm-default=all")
    }
}
dependencies {
    api(project(":openiap-core"))
    api("junit:junit:4.13.2")
    implementation("com.google.code.gson:gson:2.14.0")
}

if (standalone) extensions.configure<MavenPublishBaseExtension> {
    coordinates("io.github.hyochan.openiap", "openiap-conformance", suiteVersion)
    configure(AndroidSingleVariantLibrary(variant = "release", sourcesJar = SourcesJar.Sources(), javadocJar = JavadocJar.Empty()))
    pom {
        name.set("OpenIAP Android Conformance")
        description.set("Provider conformance tests for the public OpenIAP Android core")
        url.set("https://github.com/hyodotdev/openiap/tree/main/packages/conformance")
        licenses { license { name.set("MIT"); url.set("https://opensource.org/licenses/MIT") } }
        developers { developer { id.set("hyochan"); name.set("Hyo Dev"); url.set("https://github.com/hyochan") } }
        scm {
            url.set("https://github.com/hyodotdev/openiap")
            connection.set("scm:git:https://github.com/hyodotdev/openiap.git")
            developerConnection.set("scm:git:ssh://git@github.com/hyodotdev/openiap.git")
        }
    }
    if (gradle.startParameter.taskNames.any { it.contains("mavenCentral", true) }) {
        publishToMavenCentral()
        signAllPublications()
    }
}
