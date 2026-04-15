FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Mejor cacheo de Gradle: copiar primero wrapper + archivos de build
COPY gradle/ gradle/
COPY gradlew gradlew
COPY gradlew.bat gradlew.bat
COPY build.gradle settings.gradle ./
RUN chmod +x ./gradlew
RUN ./gradlew --no-daemon --version

# Luego el codigo fuente (cambia mas seguido)
COPY src/ src/
RUN ./gradlew --no-daemon installDist

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# curl para healthchecks en compose
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Usuario no-root
RUN useradd -r -u 10001 -g root appuser

COPY --from=build /app/build/install/AppEncuesta/ /app/
RUN chown -R appuser:root /app
USER appuser

ENV PUERTO=7000
ENV GRPC_PORT=9090
EXPOSE 7000 9090
CMD ["./bin/AppEncuesta"]
