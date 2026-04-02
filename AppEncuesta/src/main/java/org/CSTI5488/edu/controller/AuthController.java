package org.CSTI5488.edu.controller;

import io.javalin.Javalin;
import io.javalin.http.Context;
import org.CSTI5488.edu.service.AuthService;

import java.util.Map;

public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    public void registerRoutes(Javalin app) {
        app.post("/api/auth/login", this::login);
    }

    private void login(Context ctx) {
        Map<String, String> body = ctx.bodyAsClass(Map.class);
        String username = body.get("username");
        String password = body.get("password");

        if (username == null || password == null) {
            ctx.status(400).json(Map.of("error", "username y password son requeridos"));
            return;
        }

        String token = authService.login(username, password);
        if (token == null) {
            ctx.status(401).json(Map.of("error", "Credenciales invalidas"));
            return;
        }

        ctx.json(Map.of("token", token));
    }
}
