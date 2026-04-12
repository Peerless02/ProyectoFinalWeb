package org.CSTI5488.edu.controller;

import com.auth0.jwt.interfaces.DecodedJWT;
import io.javalin.Javalin;
import io.javalin.http.Context;
import org.CSTI5488.edu.model.CampoExtra;
import org.CSTI5488.edu.model.Plantilla;
import org.CSTI5488.edu.service.AuthService;
import org.CSTI5488.edu.service.PlantillaService;

import java.util.List;
import java.util.Map;

public class PlantillaController {

    private final PlantillaService plantillaService;
    private final AuthService authService;

    public PlantillaController(PlantillaService plantillaService, AuthService authService) {
        this.plantillaService = plantillaService;
        this.authService = authService;
    }

    public void registerRoutes(Javalin app) {
        app.unsafe.routes.get("/api/plantillas", this::listar);
        app.unsafe.routes.post("/api/plantillas", this::crearPlantilla);
        app.unsafe.routes.get("/api/plantillas/{id}", this::obtener);
        app.unsafe.routes.delete("/api/plantillas/{id}", this::eliminarPlantilla);

        app.unsafe.routes.post("/api/plantillas/{id}/campos", this::agregarCampo);
        app.unsafe.routes.put("/api/plantillas/{id}/campos/{cid}", this::editarCampo);
        app.unsafe.routes.delete("/api/plantillas/{id}/campos/{cid}", this::eliminarCampo);

        app.unsafe.routes.post("/api/plantillas/{id}/default", this::marcarDefault);
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

    private boolean requireAdmin(Context ctx, DecodedJWT jwt) {
        if (jwt == null) return false;
        String rol = jwt.getClaim("rol") != null ? jwt.getClaim("rol").asString() : null;
        if (!"ADMINISTRADOR".equals(rol)) {
            ctx.status(403).json(Map.of("error", "Solo ADMINISTRADOR puede modificar plantillas"));
            return false;
        }
        return true;
    }

    private void listar(Context ctx) {
        if (validarToken(ctx) == null) return;
        ctx.json(plantillaService.listar());
    }

    private void crearPlantilla(Context ctx) {
        DecodedJWT jwt = validarToken(ctx);
        if (jwt == null) return;
        if (!requireAdmin(ctx, jwt)) return;

        Plantilla p = ctx.bodyAsClass(Plantilla.class);
        if (p == null || p.getNombre() == null || p.getNombre().trim().isEmpty()) {
            ctx.status(400).json(Map.of("error", "nombre es requerido"));
            return;
        }
        p.setCreadoPor(jwt.getSubject());

        try {
            plantillaService.crearPlantilla(p);
            ctx.status(201).json(p);
        } catch (IllegalArgumentException e) {
            ctx.status(400).json(Map.of("error", e.getMessage()));
        }
    }

    private void obtener(Context ctx) {
        if (validarToken(ctx) == null) return;
        String id = ctx.pathParam("id");
        Plantilla p = plantillaService.obtener(id);
        if (p == null) {
            ctx.status(404).json(Map.of("error", "Plantilla no encontrada"));
            return;
        }
        ctx.json(p);
    }

    private void eliminarPlantilla(Context ctx) {
        DecodedJWT jwt = validarToken(ctx);
        if (jwt == null) return;
        if (!requireAdmin(ctx, jwt)) return;

        String id = ctx.pathParam("id");
        try {
            plantillaService.eliminarPlantilla(id);
            ctx.json(Map.of("mensaje", "Plantilla eliminada"));
        } catch (IllegalStateException e) {
            ctx.status(409).json(Map.of("error", e.getMessage()));
        }
    }

    private void agregarCampo(Context ctx) {
        DecodedJWT jwt = validarToken(ctx);
        if (jwt == null) return;
        if (!requireAdmin(ctx, jwt)) return;

        String id = ctx.pathParam("id");
        CampoExtra campo = ctx.bodyAsClass(CampoExtra.class);
        try {
            CampoExtra created = plantillaService.agregarCampo(id, campo);
            ctx.status(201).json(created);
        } catch (IllegalArgumentException e) {
            ctx.status(400).json(Map.of("error", e.getMessage()));
        }
    }

    private void editarCampo(Context ctx) {
        DecodedJWT jwt = validarToken(ctx);
        if (jwt == null) return;
        if (!requireAdmin(ctx, jwt)) return;

        String id = ctx.pathParam("id");
        String cid = ctx.pathParam("cid");
        CampoExtra nuevo = ctx.bodyAsClass(CampoExtra.class);
        try {
            plantillaService.editarCampo(id, cid, nuevo);
            ctx.json(Map.of("mensaje", "Campo actualizado"));
        } catch (IllegalArgumentException e) {
            ctx.status(400).json(Map.of("error", e.getMessage()));
        }
    }

    private void eliminarCampo(Context ctx) {
        DecodedJWT jwt = validarToken(ctx);
        if (jwt == null) return;
        if (!requireAdmin(ctx, jwt)) return;

        String id = ctx.pathParam("id");
        String cid = ctx.pathParam("cid");
        try {
            plantillaService.eliminarCampo(id, cid);
            ctx.json(Map.of("mensaje", "Campo eliminado"));
        } catch (IllegalArgumentException e) {
            ctx.status(400).json(Map.of("error", e.getMessage()));
        }
    }

    private void marcarDefault(Context ctx) {
        DecodedJWT jwt = validarToken(ctx);
        if (jwt == null) return;
        if (!requireAdmin(ctx, jwt)) return;

        String id = ctx.pathParam("id");
        try {
            plantillaService.marcarDefault(id);
            ctx.json(Map.of("mensaje", "Plantilla marcada como default"));
        } catch (IllegalArgumentException e) {
            ctx.status(400).json(Map.of("error", e.getMessage()));
        }
    }
}

