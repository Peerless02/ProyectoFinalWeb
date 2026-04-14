package org.CSTI5488.edu.cliente;

import io.javalin.Javalin;
import io.javalin.http.staticfiles.Location;

public class ClienteRestApp {
    public static void main(String[] args) {
        String puerto = System.getenv().getOrDefault("CLIENTE_PUERTO", "8080");

        ClienteRestService service = new ClienteRestService();
        ClienteRestController controller = new ClienteRestController(service);

        Javalin app = Javalin.create(config -> {
            // Sirve src/main/resources/cliente-public/*
            config.staticFiles.add("/cliente-public", Location.CLASSPATH);
        });

        app.start(Integer.parseInt(puerto));

        controller.registerRoutes(app);

        System.out.println("Cliente REST escuchando en http://localhost:" + puerto);
        System.out.println("Consumiendo API servidor en: " + service.getServidorBaseUrl());
    }
}

