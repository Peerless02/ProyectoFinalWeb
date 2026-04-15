FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY build/libs/AppEncuesta-1.0-SNAPSHOT.jar app.jar
EXPOSE 7000 50051
ENTRYPOINT ["java", "-jar", "app.jar"]
