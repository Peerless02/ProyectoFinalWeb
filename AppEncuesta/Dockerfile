FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN ./gradlew installDist

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/build/install/AppEncuesta/ /app/
EXPOSE 7070 9090
CMD ["./bin/AppEncuesta"]
