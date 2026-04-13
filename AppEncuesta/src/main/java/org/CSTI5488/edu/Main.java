package org.CSTI5488.edu;

import io.javalin.Javalin;
import io.javalin.http.staticfiles.Location;
import org.CSTI5488.edu.controller.AuthController;
import org.CSTI5488.edu.controller.FormularioController;
import org.CSTI5488.edu.controller.SyncController;
import org.CSTI5488.edu.controller.UsuarioController;
import org.CSTI5488.edu.db.MongoConfig;
import org.CSTI5488.edu.grpc.GrpcServer;
import org.CSTI5488.edu.service.AuthService;
import org.CSTI5488.edu.service.FormularioService;

public class Main {
    public static void main(String[] args) throws Exception {
        String puerto = System.getenv().getOrDefault("PUERTO", "7000");
        String grpcPuerto = System.getenv().getOrDefault("GRPC_PORT", "9090");

        System.out.println("MongoDB URL: " + MongoConfig.getMongoUrlRedacted() + " (db=" + MongoConfig.getMongoDbName() + ")");

        AuthService authService = new AuthService();
        FormularioService formularioService = new FormularioService();

        AuthController authController = new AuthController(authService);
        FormularioController formularioController = new FormularioController(formularioService, authService);
        SyncController syncController = new SyncController(formularioService, authService);
        UsuarioController usuarioController = new UsuarioController(authService);

        Javalin app = Javalin.create(config -> {
            // Servir archivos estaticos desde src/main/resources/public
            config.staticFiles.add("/public", Location.CLASSPATH);
            // Aumentar limite de mensaje WS para soportar fotos en base64 (hasta 2MB)
            config.jetty.modifyWebSocketServletFactory(wsFactory ->
                wsFactory.setMaxTextMessageSize(20 * 1024 * 1024)
            );
        });

        // Si MongoDB no esta disponible, el servidor igual debe arrancar y devolver 503 en endpoints que usan la BD.
        app.unsafe.routes.exception(MongoConfig.MongoUnavailableException.class, (e, ctx) ->
            ctx.status(503).result("Servicio de base de datos no disponible (MongoDB).")
        );
        app.unsafe.routes.exception(com.mongodb.MongoTimeoutException.class, (e, ctx) ->
            ctx.status(503).result("Servicio de base de datos no disponible (MongoDB).")
        );
        app.unsafe.routes.exception(com.mongodb.MongoSocketOpenException.class, (e, ctx) ->
            ctx.status(503).result("Servicio de base de datos no disponible (MongoDB).")
        );
        app.unsafe.routes.exception(com.mongodb.MongoSocketReadException.class, (e, ctx) ->
            ctx.status(503).result("Servicio de base de datos no disponible (MongoDB).")
        );

        app.start(Integer.parseInt(puerto));

        // Entrada por defecto: redirecciona al index estatico
        app.unsafe.routes.get("/", ctx -> ctx.redirect("/index.html"));

        authController.registerRoutes(app);
        formularioController.registerRoutes(app);
        syncController.registerRoutes(app);
        usuarioController.registerRoutes(app);

        GrpcServer grpcServer = new GrpcServer(formularioService, Integer.parseInt(grpcPuerto));
        grpcServer.start();
        System.out.println("gRPC server started on port " + grpcPuerto);
    }
}
