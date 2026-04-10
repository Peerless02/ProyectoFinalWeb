package org.CSTI5488.edu;

import io.javalin.Javalin;
import io.javalin.http.staticfiles.Location;
import org.CSTI5488.edu.controller.AuthController;
import org.CSTI5488.edu.service.AuthService;

public class Main {
    public static void main(String[] args) {
        String puerto = System.getenv().getOrDefault("PUERTO", "7000");

        AuthService authService = new AuthService();
        AuthController authController = new AuthController(authService);

        Javalin app = Javalin.create(config -> {
            // Servir archivos estaticos desde src/main/resources/public
            config.staticFiles.add("/public", Location.CLASSPATH);
        }).start(Integer.parseInt(puerto));

        // Entrada por defecto: redirecciona al index estatico
        app.unsafe.routes.get("/", ctx -> ctx.redirect("/index.html"));

        authController.registerRoutes(app);
    }
}
