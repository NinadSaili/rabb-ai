// JVM only build that compiles and tests the pure Kotlin decision logic without an Android SDK.
plugins { kotlin("jvm") version "2.1.0" }
repositories { mavenCentral() }
sourceSets { main { kotlin.srcDir("../android/src/main/java/com/rabbai/blocking/logic") } }
dependencies { testImplementation(kotlin("test")) }
tasks.test { useJUnitPlatform(); testLogging { events("passed", "failed", "skipped"); showStandardStreams = false } }
