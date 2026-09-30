plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
apply(from = file("../../../gradle/openiap-store.gradle"))
android {
    namespace = "community.fixture.host"
    compileSdk = 36
    defaultConfig { applicationId = "community.fixture.host"; minSdk = 23; targetSdk = 36; versionCode = 1; versionName = "1" }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    buildTypes { getByName("release") { isMinifyEnabled = true; signingConfig = signingConfigs.getByName("debug"); proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt")) } }
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
val addDependencies = extra["openIapAddStoreDependencies"] as groovy.lang.Closure<*>
addDependencies.call("implementation", providers.gradleProperty("openIapVersion").get())
dependencies { if (providers.gradleProperty("duplicateProvider").isPresent) implementation(project(":second-provider")) }
