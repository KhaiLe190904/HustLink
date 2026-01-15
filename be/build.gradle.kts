plugins {
	java
	id("org.springframework.boot") version "3.4.5"
	id("io.spring.dependency-management") version "1.1.7"
	id("com.diffplug.spotless") version "6.25.0"
}

group = "com.jobsearch"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

configurations {
	compileOnly {
		extendsFrom(configurations.annotationProcessor.get())
	}
}

repositories {
	mavenCentral()
}

dependencies {
	// Resend mail
	implementation("com.resend:resend-java:+")

	// Database
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-web")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-mail")

	// jwt
	implementation("io.jsonwebtoken:jjwt-api:0.12.6")
	implementation("io.jsonwebtoken:jjwt-impl:0.12.6")
	implementation("io.jsonwebtoken:jjwt-jackson:0.12.6")

	// websocket
	implementation("org.springframework.boot:spring-boot-starter-websocket")

	// Search
	implementation("org.hibernate.search:hibernate-search-mapper-orm:7.2.2.Final")
	implementation("org.hibernate.search:hibernate-search-backend-lucene:7.2.2.Final")
	implementation("org.jboss.logging:jboss-logging:3.6.1.Final")

	// Cache (for ML recommendations)
	implementation("org.springframework.boot:spring-boot-starter-cache")

	// DevTools
	developmentOnly("org.springframework.boot:spring-boot-devtools")
	annotationProcessor("org.projectlombok:lombok")

	// Testing
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	runtimeOnly("com.microsoft.sqlserver:mssql-jdbc")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
	useJUnitPlatform()
}

spotless {
	java {
		target("src/**/*.java")
		eclipse().configFile("intellij-formatter.xml")
		removeUnusedImports()
		trimTrailingWhitespace()
		endWithNewline()
	}
	kotlin {
		target("**/*.kt")
		ktfmt()
		trimTrailingWhitespace()
		endWithNewline()
	}
}

tasks.named("spotlessJavaCheck") {
	enabled = false
}
tasks.named("spotlessKotlinCheck") {
	enabled = false
}
tasks.named("spotlessCheck") {
	enabled = false
}

tasks.named("check") {
	enabled = false
}
