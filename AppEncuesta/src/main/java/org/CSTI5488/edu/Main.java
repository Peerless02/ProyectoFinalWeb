package org.CSTI5488.edu;

import io.javalin.Javalin;
import org.CSTI5488.edu.controller.AuthController;
import org.CSTI5488.edu.service.AuthService;

public class Main {
    public static void main(String[] args) {
        String puerto = System.getenv().getOrDefault("PUERTO", "7000");

        AuthService authService = new AuthService();
        AuthController authController = new AuthController(authService);

        Javalin app = Javalin.create().start(Integer.parseInt(puerto));
        authController.registerRoutes(app);
    }
}
