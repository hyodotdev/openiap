# Kotlin Codegen Scaffold

Use this directory as a reference when wiring Apollo Kotlin into your Android
project.  The main repository does not include a standalone Gradle project;
instead, copy the snippet from the root `README.md` into a module inside your
app and point the `schemaFiles` to the shared SDL under `../../src/`.

Typical usage inside `build.gradle.kts`:

```kotlin
plugins {
  id("com.apollographql.apollo3") version "4.0.0"
}

dependencies {
  implementation("com.apollographql.apollo3:apollo-runtime:4.0.0")
}

apollo {
  service("openIap") {
    packageName.set("dev.openiap.graphql")
    schemaFiles.from(
      file("../../src/type.graphql"),
      file("../../src/type-ios.graphql"),
      file("../../src/type-android.graphql"),
      file("../../src/api.graphql"),
      file("../../src/api-ios.graphql"),
      file("../../src/api-android.graphql"),
    )
    srcDir("src/main/graphql")
  }
}
```

Run `./gradlew :<module>:generateApolloSources` after adding or updating your
queries.
