plugins { id("com.android.library"); id("org.jetbrains.kotlin.android"); id("maven-publish") }
val coreVersion = providers.gradleProperty("openIapVersion").get()
android {
    namespace = "community.fixture"
    compileSdk = 36
    defaultConfig { minSdk = 23; buildConfigField("String", "CORE_VERSION", "\"$coreVersion\"") }
    buildFeatures { buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    testOptions.unitTests.isIncludeAndroidResources = true
    publishing { singleVariant("release") }
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
dependencies {
    api("io.github.hyochan.openiap:openiap-core:$coreVersion")
    testImplementation("io.github.hyochan.openiap:openiap-conformance:${providers.gradleProperty("conformanceVersion").get()}")
    testImplementation("org.robolectric:robolectric:4.16.1")
    testImplementation("androidx.test:core:1.7.0")
}
tasks.withType<Test>().configureEach {
    include("**/FixtureConformanceTest.class")
    systemProperty("openiap.conformanceReport", layout.buildDirectory.file("reports/openiap/{storeId}.json").get().asFile.path)
}
afterEvaluate {
    publishing {
        publications { create<MavenPublication>("fixture") {
            from(components["release"])
            groupId = "community.fixture"; artifactId = "provider"; version = "1.0.0"
        } }
    }
}

afterEvaluate {
    val positive = tasks.named<Test>("testDebugUnitTest")
    tasks.register<Test>("negativeConformance") {
        dependsOn(positive)
        testClassesDirs = positive.get().testClassesDirs
        classpath = positive.get().classpath
        setIncludes(setOf("**/MissingCapabilityTest.class"))
        ignoreFailures = true
        val report = layout.buildDirectory.file("reports/openiap/missing-capability.json").get().asFile
        systemProperty("openiap.conformanceReport", report.path)
        doLast {
            check(report.readText().contains("\"conformant\": false"))
            val results = reports.junitXml.outputLocation.get().asFile.resolve("TEST-community.fixture.MissingCapabilityTest.xml")
            check(results.readText().contains("failures=\"1\"")) { "Expected exactly one declared-capability failure" }
        }
    }
}
