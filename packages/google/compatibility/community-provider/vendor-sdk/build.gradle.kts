plugins { `java-library`; `maven-publish` }
java { toolchain { languageVersion.set(JavaLanguageVersion.of(17)) } }
group = "community.fixture"
version = "1.0.0"
dependencies { api("org.jetbrains.kotlinx:kotlinx-datetime:0.7.1") }
publishing { publications { create<MavenPublication>("vendor") { from(components["java"]) } } }
