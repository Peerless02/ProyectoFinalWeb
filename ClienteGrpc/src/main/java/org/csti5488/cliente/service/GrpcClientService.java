package org.csti5488.cliente.service;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.CSTI5488.edu.grpc.EncuestaServiceGrpc;
import org.CSTI5488.edu.grpc.FormularioRequest;
import org.CSTI5488.edu.grpc.FormularioResponse;
import org.CSTI5488.edu.grpc.ListaFormulariosResponse;
import org.CSTI5488.edu.grpc.UsuarioRequest;

import java.util.concurrent.TimeUnit;

public class GrpcClientService {

    private static final GrpcClientService INSTANCE = new GrpcClientService();

    private ManagedChannel channel;
    private EncuestaServiceGrpc.EncuestaServiceBlockingStub stub;
    private String currentHost = "localhost";
    private int currentPort = 9090;

    private GrpcClientService() {}

    public static GrpcClientService getInstance() {
        return INSTANCE;
    }

    public synchronized void connect(String host, int port) {
        if (channel != null && !channel.isShutdown()) {
            channel.shutdownNow();
        }
        this.currentHost = host;
        this.currentPort = port;
        channel = ManagedChannelBuilder.forAddress(host, port)
                .usePlaintext()
                .build();
        stub = EncuestaServiceGrpc.newBlockingStub(channel);
    }

    private synchronized EncuestaServiceGrpc.EncuestaServiceBlockingStub getStub() {
        if (stub == null) {
            connect(currentHost, currentPort);
        }
        return stub;
    }

    public FormularioResponse crearFormulario(
            String nombre, String sector, String nivelEscolar,
            String usuarioRegistro, double latitud, double longitud,
            String fotoBase64) {

        FormularioRequest request = FormularioRequest.newBuilder()
                .setNombre(nombre)
                .setSector(sector)
                .setNivelEscolar(nivelEscolar)
                .setUsuarioRegistro(usuarioRegistro)
                .setLatitud(latitud)
                .setLongitud(longitud)
                .setFotoBase64(fotoBase64 != null ? fotoBase64 : "")
                .build();

        return getStub().crearFormulario(request);
    }

    public ListaFormulariosResponse listarFormularios(String username) {
        UsuarioRequest request = UsuarioRequest.newBuilder()
                .setUsername(username)
                .build();
        return getStub().listarFormulariosPorUsuario(request);
    }

    public synchronized void shutdown() {
        if (channel != null && !channel.isShutdown()) {
            try {
                channel.shutdown().awaitTermination(3, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                channel.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }
}
