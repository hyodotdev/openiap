dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    compileOnly("com.android.billingclient:billing-ktx:8.0.0")
    add("playApi", "com.android.billingclient:billing-ktx:8.0.0")
    add("autoApi", "com.android.billingclient:billing-ktx:8.0.0")
    add("autoApi", "com.meta.horizon.billingclient.api:horizon-billing-compatibility:1.1.1")
    add("horizonApi", "com.meta.horizon.billingclient.api:horizon-billing-compatibility:1.1.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
    implementation("com.google.code.gson:gson:2.10.1")

    val composeUiVersion = (project.findProperty("COMPOSE_UI_VERSION") as String?) ?: "1.6.8"
    implementation("androidx.compose.runtime:runtime:$composeUiVersion")
    implementation("androidx.compose.ui:ui:$composeUiVersion")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
}
