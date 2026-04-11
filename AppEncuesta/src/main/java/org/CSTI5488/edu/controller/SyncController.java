package org.CSTI5488.edu.controller;

import com.auth0.jwt.interfaces.DecodedJWT;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.Javalin;
import io.javalin.websocket.WsCloseContext;
import io.javalin.websocket.WsConnectContext;
import io.javalin.websocket.WsErrorContext;
import io.javalin.websocket.WsMessageContext;
import org.CSTI5488.edu.db.MongoConfig;
import org.CSTI5488.edu.model.Formulario;
import org.CSTI5488.edu.service.AuthService;
import org.CSTI5488.edu.service.FormularioService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;

public class SyncController {

    private static final Logger log = LoggerFactory.getLogger(SyncController.class);

    private final FormularioService formularioService;
    private final AuthService authService;
    private static final ObjectMapper mapper;

    static {
        mapper = new ObjectMapper();
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        mapper.setDateFormat(sdf);
    }

    public SyncController(FormularioService formularioService, AuthService authService) {
        this.formularioService = formularioService;
        this.authService = authService;
    }

    public void registerRoutes(Javalin app) {
        app.unsafe.routes.ws("/sync", wsConfig -> {
            wsConfig.onConnect(this::handleConnect);
            wsConfig.onMessage(this::handleMessage);
            wsConfig.onError(this::handleError);
            wsConfig.onClose(this::handleClose);
        });
    }

    private void handleConnect(WsConnectContext ctx) {
        String token = ctx.queryParam("token");
        if (token == null || token.isEmpty()) {
            ctx.closeSession(1008, "Token requerido");
            return;
        }
        DecodedJWT jwt = authService.verifyToken(token);
        if (jwt == null) {
            ctx.closeSession(1008, "Token invalido o expirado");
            return;
        }
        ctx.attribute("username", jwt.getSubject());
        log.info("[Sync] Conexion establecida para usuario: {}", jwt.getSubject());
    }

    private void handleMessage(WsMessageContext ctx) {
        String username = ctx.attribute("username");
        if (username == null) {
            ctx.send("{\"exito\":false,\"error\":\"No autenticado\"}");
            ctx.closeSession(1008, "No autenticado");
            return;
        }

        List<Formulario> formularios;
        try {
            formularios = mapper.readValue(
                ctx.message(),
                mapper.getTypeFactory().constructCollectionType(List.class, Formulario.class)
            );
        } catch (Exception e) {
            log.warn("[Sync] JSON invalido de {}: {}", username, e.getMessage());
            ctx.send("{\"exito\":false,\"error\":\"JSON invalido\"}");
            return;
        }

        int guardados = 0;
        int errores = 0;
        List<String> idsGuardados = new ArrayList<>();
        boolean dbDown = false;

        for (Formulario f : formularios) {
            String localId = f.getId();
            f.setUsuarioRegistro(username); // enforce from JWT
            try {
                formularioService.crear(f);
                guardados++;
                if (localId != null) idsGuardados.add(localId);
            } catch (MongoConfig.MongoUnavailableException | com.mongodb.MongoTimeoutException
                     | com.mongodb.MongoSocketOpenException | com.mongodb.MongoSocketReadException e) {
                dbDown = true;
                errores++;
                break; // MongoDB down — no point continuing
            } catch (Exception e) {
                log.warn("[Sync] Error guardando formulario {}: {}", localId, e.getMessage());
                errores++;
            }
        }

        if (dbDown) {
            // Count remaining unprocessed items
            errores += (formularios.size() - guardados - errores);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("exito", errores == 0);
        result.put("guardados", guardados);
        result.put("errores", errores);
        result.put("idsGuardados", idsGuardados);

        try {
            ctx.send(mapper.writeValueAsString(result));
        } catch (Exception e) {
            ctx.send("{\"exito\":false,\"error\":\"Error al serializar respuesta\"}");
        }

        log.info("[Sync] Usuario {}: {} guardados, {} errores", username, guardados, errores);
    }

    private void handleError(WsErrorContext ctx) {
        log.warn("[Sync] Error en sesion {}: {}", ctx.sessionId(),
                ctx.error() != null ? ctx.error().getMessage() : "desconocido");
    }

    private void handleClose(WsCloseContext ctx) {
        log.info("[Sync] Sesion cerrada: id={} status={} razon={}",
                ctx.sessionId(), ctx.status(), ctx.reason());
    }
}
