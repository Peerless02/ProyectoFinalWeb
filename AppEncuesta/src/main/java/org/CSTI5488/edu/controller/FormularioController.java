package org.CSTI5488.edu.controller;

import com.auth0.jwt.interfaces.DecodedJWT;
import io.javalin.Javalin;
import io.javalin.http.Context;
import org.CSTI5488.edu.model.Formulario;
import org.CSTI5488.edu.service.AuthService;
import org.CSTI5488.edu.service.FormularioService;

import java.util.List;
import java.util.Map;

public class FormularioController {

    private final FormularioService formularioService;
    private final AuthService authService;

    public FormularioController(FormularioService formularioService, AuthService authService) {
        this.formularioService = formularioService;
        this.authService = authService;
    }

    public void registerRoutes(Javalin app) {
        app.unsafe.routes.post("/api/formularios", this::crear);
        app.unsafe.routes.put("/api/formularios/{id}", this::actualizar);
        app.unsafe.routes.get("/api/formularios/usuario/{username}", this::listarPorUsuario);
        app.unsafe.routes.get("/api/formularios/mapa", this::listarMapa);
    }

    private DecodedJWT validarToken(Context ctx) {
        String header = ctx.header("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            ctx.status(401).json(Map.of("error", "Token requerido"));
            return null;
        }
        DecodedJWT jwt = authService.verifyToken(header.substring(7));
        if (jwt == null) {
            ctx.status(401).json(Map.of("error", "Token invalido o expirado"));
        }
        return jwt;
    }

    private void crear(Context ctx) {
        if (validarToken(ctx) == null) return;

        Formulario formulario = ctx.bodyAsClass(Formulario.class);
        if (formulario.getNombre() == null || formulario.getSector() == null || formulario.getNivelEscolar() == null) {
            ctx.status(400).json(Map.of("error", "nombre, sector y nivelEscolar son requeridos"));
            return;
        }

        formularioService.crear(formulario);
        ctx.status(201).json(Map.of("mensaje", "Formulario registrado exitosamente"));
    }

    private void actualizar(Context ctx) {
        DecodedJWT jwt = validarToken(ctx);
        if (jwt == null) return;

        String id = ctx.pathParam("id");
        Formulario body;
        try {
            body = ctx.bodyAsClass(Formulario.class);
        } catch (Exception e) {
            ctx.status(400).json(Map.of("error", "Cuerpo JSON invalido"));
            return;
        }

        if (body.getNombre() == null || body.getSector() == null || body.getNivelEscolar() == null) {
            ctx.status(400).json(Map.of("error", "nombre, sector y nivelEscolar son requeridos"));
            return;
        }

        Formulario existente = formularioService.buscarPorId(id);
        if (existente == null) {
            ctx.status(404).json(Map.of("error", "Formulario no encontrado"));
            return;
        }
        if (!jwt.getSubject().equals(existente.getUsuarioRegistro())) {
            ctx.status(403).json(Map.of("error", "No autorizado para modificar este formulario"));
            return;
        }

        formularioService.actualizar(id, body);
        ctx.status(200).json(Map.of("mensaje", "Formulario actualizado"));
    }

    private void listarPorUsuario(Context ctx) {
        if (validarToken(ctx) == null) return;

        String username = ctx.pathParam("username");
        List<Formulario> formularios = formularioService.listarPorUsuario(username);
        ctx.json(formularios);
    }

    private void listarMapa(Context ctx) {
        if (validarToken(ctx) == null) return;

        List<Formulario> formularios = formularioService.listarConCoordenadas();
        ctx.json(formularios);
    }
}
