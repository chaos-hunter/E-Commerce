# ##  Start with a base image from Eclipse Temurin (a distribution of OpenJDK) with Alpine 
# FROM eclipse-temurin:21-jammy as build
# WORKDIR /workspace/app


# ## Copy neccessary files for building the java project
# COPY gradlew .
# RUN chmod +x ./gradlew
# COPY gradle/wrapper/gradle-wrapper.properties ./gradle/wrapper/gradle-wrapper.properties
# COPY gradle/wrapper/gradle-wrapper.jar ./gradle/wrapper/gradle-wrapper.jar

# COPY build.gradle .

# COPY src src

# ## Ensure the Gradle Wrapper script is executable
# RUN chmod +x ./gradlew

# ## Use Gradle to build the application using the RUN stanza
# RUN ./gradlew build

# ## need to add a command to run the app here
# CMD ["bash", "-c", "java -jar build/libs/notes-app-1.0.jar & tail -f /dev/null"]
# # this command is useful for debugging because it lets you kill and restart the java process without killing the container




#### Updated - fixed Gradle re-download issue ####

# backend/Dockerfile
# syntax=docker/dockerfile:1.6

##########
# Build
##########
FROM gradle:8.5-jdk17 AS build
WORKDIR /app

# Wrapper + build files (only the ones that exist)
COPY gradle/wrapper/ gradle/wrapper/
COPY gradlew gradlew.bat ./
COPY build.gradle ./

# Warm Gradle cache so the wrapper doesn’t re-download each build
RUN --mount=type=cache,target=/home/gradle/.gradle \
    ./gradlew --no-daemon --version

# Bring in sources and build
COPY src src
RUN --mount=type=cache,target=/home/gradle/.gradle \
    ./gradlew --no-daemon clean bootJar

##########
# Runtime (multi-arch)
##########
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
