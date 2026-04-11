package org.CSTI5488.edu;

import io.javalin.Javalin;
import io.javalin.http.staticfiles.Location;
import org.CSTI5488.edu.controller.AuthController;
import org.CSTI5488.edu.controller.FormularioController;
<<<<<<< Updated upstream
import org.CSTI5488.edu.db.MongoConfig;
=======
import org.CSTI5488.edu.grpc.GrpcServer;
>>>>>>> Stashed changes
import org.CSTI5488.edu.service.AuthService;
import org.CSTI5488.edu.service.FormularioService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Main {

    private static final Logger log = LoggerFactory.getLogger(Main.class);

    public static void main(String[] args) throws Exception {
        String puerto = System.getenv().getOrDefault("PUERTO", "7000");
        int grpcPuerto = Integer.parseInt(System.getenv().getOrDefault("GRPC_PORT", "9090"));

        System.out.println("MongoDB URL: " + MongoConfig.getMongoUrlRedacted() + " (db=" + MongoConfig.getMongoDbName() + ")");

        AuthService authService = new AuthService();
        FormularioService formularioService = new FormularioService();

        AuthController authController = new AuthController(authService);
        FormularioController formularioController = new FormularioController(formularioService, authService);

        // Servidor HTTP (Javalin)
        Javalin app = Javalin.create(config -> {
            config.staticFiles.add("/public", Location.CLASSPATH);
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

        app.unsafe.routes.get("/", ctx -> ctx.redirect("/index.html"));

        authController.registerRoutes(app);
        formularioController.registerRoutes(app);

        // Servidor gRPC
        GrpcServer grpcServer = new GrpcServer(formularioService, grpcPuerto);
        grpcServer.start();
        log.info("HTTP server started on port {}", puerto);
    }
}
