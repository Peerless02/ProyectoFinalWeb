package org.CSTI5488.edu.controller;

import com.auth0.jwt.interfaces.DecodedJWT;
import io.javalin.Javalin;
import io.javalin.http.Context;
import org.CSTI5488.edu.model.Usuario;
import org.CSTI5488.edu.repository.UsuarioRepository;
import org.CSTI5488.edu.service.AuthService;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class UsuarioController {

    private final UsuarioRepository usuarioRepository;
    private final AuthService authService;

    public UsuarioController(AuthService authService) {
        this.usuarioRepository = new UsuarioRepository();
        this.authService = authService;
    }

    public void registerRoutes(Javalin app) {
        app.unsafe.routes.get("/api/session", this::session);
        app.unsafe.routes.get("/api/admin/users", this::listar);
        app.unsafe.routes.post("/api/admin/users", this::crear);
        app.unsafe.routes.post("/api/admin/users/{id}/role", this::cambiarRol);
        app.unsafe.routes.post("/api/admin/users/{id}/blocked", this::cambiarBloqueado);
    }

    private DecodedJWT getJwt(Context ctx) {
        String header = ctx.header("Authorization");
        if (header == null || !header.startsWith("Bearer ")) return null;
        return authService.verifyToken(header.substring(7));
    }

    private DecodedJWT requireAdmin(Context ctx) {
        DecodedJWT jwt = getJwt(ctx);
        if (jwt == null) {
            ctx.status(401).json(Map.of("error", "Token requerido"));
            return null;
        }
        String rol = jwt.getClaim("rol").asString();
        if (!"ADMINISTRADOR".equals(rol) && !"ADMIN".equals(rol)) {
            ctx.status(403).json(Map.of("error", "Se requiere rol ADMINISTRADOR"));
            return null;
        }
        return jwt;
    }

    private void session(Context ctx) {
        DecodedJWT jwt = getJwt(ctx);
        if (jwt == null) {
            ctx.json(Map.of("loggedIn", false));
            return;
        }
        Map<String, Object> user = new LinkedHashMap<>();
        user.put("username", jwt.getSubject());
        user.put("email", jwt.getSubject());
        user.put("rol", jwt.getClaim("rol").asString());
        ctx.json(Map.of("loggedIn", true, "user", user));
    }

    private void listar(Context ctx) {
        if (requireAdmin(ctx) == null) return;

        List<Usuario> usuarios = usuarioRepository.findAll();
        List<Map<String, Object>> lista = new ArrayList<>();
        for (Usuario u : usuarios) {
            lista.add(toMap(u));
        }
        ctx.json(Map.of("users", lista));
    }

    private void crear(Context ctx) {
        if (requireAdmin(ctx) == null) return;

        String nombre = ctx.formParam("nombre");
        String email  = ctx.formParam("email");
        String pass   = ctx.formParam("password");
        String confirm = ctx.formParam("confirmPassword");
        String rol    = ctx.formParam("rol");

        if (nombre == null || nombre.isBlank() ||
            email == null  || email.isBlank()  ||
            pass == null   || pass.isBlank()   ||
            rol == null    || rol.isBlank()) {
            ctx.status(400).json(Map.of("error", "Todos los campos son requeridos"));
            return;
        }
        if (!pass.equals(confirm)) {
            ctx.status(400).json(Map.of("error", "Las contrasenas no coinciden"));
            return;
        }
        if (usuarioRepository.existsByUsername(email)) {
            ctx.status(409).json(Map.of("error", "El usuario ya existe"));
            return;
        }

        Usuario u = new Usuario();
        u.setUsername(email);
        u.setNombre(nombre);
        u.setPassword(authService.hashPassword(pass));
        u.setRol(rol);
        u.setBloqueado(false);
        usuarioRepository.save(u);

        ctx.status(201).json(Map.of("mensaje", "Usuario creado"));
    }

    private void cambiarRol(Context ctx) {
        if (requireAdmin(ctx) == null) return;

        String id  = ctx.pathParam("id");
        String rol = ctx.formParam("rol");

        Usuario u = usuarioRepository.findById(id);
        if (u == null) {
            ctx.status(404).json(Map.of("error", "Usuario no encontrado"));
            return;
        }
        usuarioRepository.updateRol(id, rol == null ? "" : rol);
        ctx.status(204);
    }

    private void cambiarBloqueado(Context ctx) {
        if (requireAdmin(ctx) == null) return;

        String id  = ctx.pathParam("id");
        String raw = ctx.formParam("bloqueado");

        Usuario u = usuarioRepository.findById(id);
        if (u == null) {
            ctx.status(404).json(Map.of("error", "Usuario no encontrado"));
            return;
        }
        boolean bloqueado = "true".equalsIgnoreCase(raw);
        usuarioRepository.updateBloqueado(id, bloqueado);
        ctx.status(204);
    }

    private Map<String, Object> toMap(Usuario u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("nombre", u.getNombre());
        m.put("email", u.getUsername());
        m.put("rol", u.getRol());
        m.put("bloqueado", u.isBloqueado());
        m.put("esAdmin", "ADMIN".equals(u.getRol()) || "ADMINISTRADOR".equals(u.getRol()));
        return m;
    }
}
