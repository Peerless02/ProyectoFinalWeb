package org.CSTI5488.edu.grpc;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import org.CSTI5488.edu.service.FormularioService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

public class GrpcServer {

    private static final Logger log = LoggerFactory.getLogger(GrpcServer.class);

    private final Server server;
    private final int port;

    public GrpcServer(FormularioService formularioService, int port) {
        this.port = port;
        this.server = ServerBuilder.forPort(port)
                .addService(new EncuestaServiceImpl(formularioService))
                .build();
    }

    public void start() throws IOException {
        server.start();
        log.info("gRPC server started on port {}", port);

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            log.info("Shutting down gRPC server...");
            GrpcServer.this.stop();
        }));
    }

    public void stop() {
        if (server != null && !server.isShutdown()) {
            server.shutdown();
        }
    }

    public void blockUntilShutdown() throws InterruptedException {
        if (server != null) {
            server.awaitTermination();
        }
    }
}
