package org.CSTI5488.edu.cliente;

import io.javalin.Javalin;
import io.javalin.http.ContentType;
import io.javalin.http.Context;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ClienteRestController {

    private final ClienteRestService service;

    public ClienteRestController(ClienteRestService service) {
        this.service = service;
    }

    public void registerRoutes(Javalin app) {
        app.unsafe.routes.get("/", ctx -> ctx.redirect("/index.html"));

        app.unsafe.routes.get("/api/login", ctx -> {
            ctx.contentType(ContentType.TEXT_HTML);
            ctx.result(loginHtml());
        });

        app.unsafe.routes.post("/api/login", this::handleLogin);

        app.unsafe.routes.get("/api/formularios", this::handleListarFormularios);
        app.unsafe.routes.post("/api/formularios", this::handleCrearFormulario);
    }

    private void handleLogin(Context ctx) {
        String username = firstNonBlank(ctx.formParam("username"), ctx.queryParam("username"));
        String password = firstNonBlank(ctx.formParam("password"), ctx.queryParam("password"));

        // Permitir JSON tambien (por si el frontend usa fetch con JSON)
        if (isBlank(username) || isBlank(password)) {
            try {
                Map<String, Object> body = ctx.bodyAsClass(Map.class);
                if (body != null) {
                    username = firstNonBlank(username, asString(body.get("username")));
                    password = firstNonBlank(password, asString(body.get("password")));
                }
            } catch (Exception ignored) {
                // si el body no es JSON valido, seguimos con validacion normal
            }
        }

        if (isBlank(username) || isBlank(password)) {
            ctx.status(400).json(Map.of("ok", false, "error", "username y password son requeridos"));
            return;
        }

        String token = service.login(username, password);
        if (service.getLastConnectionError() != null) {
            ctx.status(503).json(Map.of("ok", false, "error", service.getLastConnectionError()));
            return;
        }
        if (token == null) {
            ctx.status(401).json(Map.of("ok", false, "error", "Credenciales invalidas"));
            return;
        }

        ctx.sessionAttribute("token", token);
        ctx.sessionAttribute("username", username);
        ctx.json(Map.of("ok", true, "token", token, "username", username));
    }

    private void handleListarFormularios(Context ctx) {
        String token = ctx.sessionAttribute("token");
        String username = ctx.sessionAttribute("username");

        if (isBlank(token) || isBlank(username)) {
            ctx.status(401).json(Map.of("ok", false, "error", "Debe iniciar sesion"));
            return;
        }

        List<Map<String, Object>> formularios = service.listarFormularios(username, token);
        if (service.getLastConnectionError() != null) {
            ctx.status(503).json(Map.of("ok", false, "error", service.getLastConnectionError()));
            return;
        }
        if (formularios == null) {
            ctx.status(502).json(Map.of("ok", false, "error", "No se pudo obtener formularios"));
            return;
        }

        ctx.json(formularios);
    }

    private void handleCrearFormulario(Context ctx) {
        String token = ctx.sessionAttribute("token");
        if (isBlank(token)) {
            ctx.status(401).json(Map.of("ok", false, "error", "Debe iniciar sesion"));
            return;
        }

        Map<String, Object> datos = new HashMap<>();

        // Preferimos form-encoded (del index.html), pero aceptamos JSON como fallback.
        String nombre = ctx.formParam("nombre");
        String sector = ctx.formParam("sector");
        String nivelEscolar = ctx.formParam("nivelEscolar");

        if (isBlank(nombre) && isBlank(sector) && isBlank(nivelEscolar)) {
            try {
                Map<String, Object> body = ctx.bodyAsClass(Map.class);
                if (body != null) {
                    nombre = firstNonBlank(nombre, asString(body.get("nombre")));
                    sector = firstNonBlank(sector, asString(body.get("sector")));
                    nivelEscolar = firstNonBlank(nivelEscolar, asString(body.get("nivelEscolar")));
                }
            } catch (Exception ignored) {
            }
        }

        if (isBlank(nombre) || isBlank(sector) || isBlank(nivelEscolar)) {
            ctx.status(400).json(Map.of("ok", false, "error", "nombre, sector y nivelEscolar son requeridos"));
            return;
        }

        datos.put("nombre", nombre);
        datos.put("sector", sector);
        datos.put("nivelEscolar", nivelEscolar);

        boolean ok = service.crearFormulario(datos, token);
        if (service.getLastConnectionError() != null) {
            ctx.status(503).json(Map.of("ok", false, "error", service.getLastConnectionError()));
            return;
        }
        if (!ok) {
            ctx.status(400).json(Map.of("ok", false, "error", "No se pudo crear el formulario"));
            return;
        }

        ctx.status(201).json(Map.of("ok", true));
    }

    private static String loginHtml() {
        return """
            <!doctype html>
            <html lang="es">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>Login - AppEncuesta Cliente REST</title>
              <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css">
            </head>
            <body class="container" style="padding-top: 30px;">
              <h3>AppEncuesta — Cliente REST</h3>
              <p><a href="/index.html">Ir a la interfaz</a></p>
              <hr/>
              <form method="post" action="/api/login" class="form">
                <div class="form-group">
                  <label>Usuario</label>
                  <input class="form-control" name="username" />
                </div>
                <div class="form-group">
                  <label>Contrasena</label>
                  <input class="form-control" type="password" name="password" />
                </div>
                <button class="btn btn-primary" type="submit">Login</button>
              </form>
            </body>
            </html>
            """;
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static String asString(Object o) {
        return o == null ? null : o.toString();
    }

    private static String firstNonBlank(String a, String b) {
        if (!isBlank(a)) return a;
        if (!isBlank(b)) return b;
        return null;
    }
}

