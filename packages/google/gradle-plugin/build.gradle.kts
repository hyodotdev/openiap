import com.vanniktech.maven.publish.GradlePlugin
import com.vanniktech.maven.publish.JavadocJar
import groovy.json.JsonSlurper

plugins {
    `java-gradle-plugin`
    id("com.vanniktech.maven.publish") version "0.37.0"
}

// Same version line as openiap-google, whose artifacts the plugin selects.
val openIapVersion: String = providers.gradleProperty("openIapVersion").orNull
    ?: run {
        val versionsFile = rootDir.resolve("../../../openiap-versions.json")
        if (!versionsFile.isFile) {
            throw GradleException("openiap-gradle-plugin: missing openiap-versions.json at ${versionsFile.path}")
        }
        (JsonSlurper().parseText(versionsFile.readText()) as Map<*, *>)["google"]?.toString()
            ?: throw GradleException("openiap-gradle-plugin: 'google' version missing in openiap-versions.json")
    }

group = "io.github.hyochan.openiap"
version = openIapVersion

// Java rather than Groovy: a class compiled against Groovy 4 is not guaranteed
// to load under the Groovy 3 runtime Gradle 8 ships.
tasks.withType<JavaCompile>().configureEach {
    options.release.set(11)
}

gradlePlugin {
    website.set("https://openiap.dev/docs/setup/store")
    vcsUrl.set("https://github.com/hyodotdev/openiap")
    plugins {
        create("openiap") {
            id = "io.github.hyochan.openiap"
            implementationClass = "dev.hyo.openiap.gradle.OpenIapPlugin"
            displayName = "OpenIAP store selection"
            description = "Links the Play, Horizon, or Amazon build of openiap-google and kmp-iap by the OpenIAP store rule."
        }
    }
}

// Ship the resolver the framework wrappers apply rather than a port of it.
tasks.processResources {
    from(rootDir.resolve("../../../openiap-store.gradle")) {
        into("dev/hyo/openiap/gradle")
    }
}

val isCentralPublishTaskRequested = gradle.startParameter.taskNames.any {
    it.contains("mavenCentral", ignoreCase = true)
}

mavenPublishing {
    coordinates("io.github.hyochan.openiap", "openiap-gradle-plugin", openIapVersion)
    configure(GradlePlugin(javadocJar = JavadocJar.Empty(), sourcesJar = true))
    if (isCentralPublishTaskRequested) {
        publishToMavenCentral()
        signAllPublications()
    }
    pom {
        name.set("OpenIAP Gradle plugin")
        description.set("Selects the Android store build of openiap-google and kmp-iap")
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
            url.set("https://github.com/hyodotdev/openiap/tree/main/packages/google/gradle-plugin")
        }
    }
}
