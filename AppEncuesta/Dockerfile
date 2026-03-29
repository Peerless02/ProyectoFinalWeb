FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY . .
RUN ./gradlew installDist

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/build/install/AppEncuesta/ /app/
EXPOSE 7070
CMD ["./bin/AppEncuesta"]
