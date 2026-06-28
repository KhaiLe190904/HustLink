# Stage 1: Build JAR
FROM gradle:8.12-jdk21-alpine AS builder
WORKDIR /app
COPY gradle/ gradle/
COPY gradlew build.gradle.kts settings.gradle.kts ./
# Pre-download dependencies to utilize Docker layer cache
RUN ./gradlew dependencies --no-daemon || true

COPY src/ src/
RUN ./gradlew bootJar -x test --no-daemon

# Stage 2: Run application
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/hustlink-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
