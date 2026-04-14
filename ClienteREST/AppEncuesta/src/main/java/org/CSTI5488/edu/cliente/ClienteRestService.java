package org.CSTI5488.edu.cliente;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

public class ClienteRestService {

    private final HttpClient http;
    private final ObjectMapper mapper;
    private final String servidorBaseUrl;

    // Se usa para distinguir fallas de conexion (503) vs. credenciales/validacion (4xx).
    private volatile String lastConnectionError;

    public ClienteRestService() {
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();
        this.mapper = new ObjectMapper();
        this.servidorBaseUrl = normalizeBaseUrl(System.getenv().getOrDefault("SERVIDOR_URL", "http://localhost:7000"));
    }

    public String getServidorBaseUrl() {
        return servidorBaseUrl;
    }

    public String getLastConnectionError() {
        return lastConnectionError;
    }

    private void clearLastConnectionError() {
        lastConnectionError = null;
    }

    public String login(String username, String password) {
        clearLastConnectionError();
        try {
            String body = mapper.writeValueAsString(Map.of(
                "username", username,
                "password", password
            ));

            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(servidorBaseUrl + "/api/auth/login"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();

            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (res.statusCode() < 200 || res.statusCode() >= 300) return null;

            Map<String, Object> json = mapper.readValue(res.body(), new TypeReference<Map<String, Object>>() {});
            Object token = json.get("token");
            return token == null ? null : token.toString();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            lastConnectionError = "Operacion interrumpida: " + e.getMessage();
            return null;
        } catch (IOException e) {
            lastConnectionError = "No se pudo conectar al servidor REST (" + servidorBaseUrl + "): " + e.getMessage();
            return null;
        }
    }

    public List<Map<String, Object>> listarFormularios(String username, String token) {
        clearLastConnectionError();
        try {
            String encodedUser = URLEncoder.encode(username, StandardCharsets.UTF_8);
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(servidorBaseUrl + "/api/formularios/usuario/" + encodedUser))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();

            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (res.statusCode() != 200) return null;

            return mapper.readValue(res.body(), new TypeReference<List<Map<String, Object>>>() {});
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            lastConnectionError = "Operacion interrumpida: " + e.getMessage();
            return null;
        } catch (IOException e) {
            lastConnectionError = "No se pudo conectar al servidor REST (" + servidorBaseUrl + "): " + e.getMessage();
            return null;
        }
    }

    public boolean crearFormulario(Map<String, Object> datos, String token) {
        clearLastConnectionError();
        try {
            String body = mapper.writeValueAsString(datos);
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(servidorBaseUrl + "/api/formularios"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();

            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            return res.statusCode() == 201;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            lastConnectionError = "Operacion interrumpida: " + e.getMessage();
            return false;
        } catch (IOException e) {
            lastConnectionError = "No se pudo conectar al servidor REST (" + servidorBaseUrl + "): " + e.getMessage();
            return false;
        }
    }

    private static String normalizeBaseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) return "http://localhost:7000";
        String trimmed = baseUrl.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }
}
