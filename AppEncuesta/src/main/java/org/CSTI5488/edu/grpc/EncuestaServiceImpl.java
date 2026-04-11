package org.CSTI5488.edu.grpc;

import io.grpc.stub.StreamObserver;
import org.CSTI5488.edu.model.Formulario;
import org.CSTI5488.edu.model.NivelEscolar;
import org.CSTI5488.edu.service.FormularioService;

import java.util.List;

public class EncuestaServiceImpl extends EncuestaServiceGrpc.EncuestaServiceImplBase {

    private final FormularioService formularioService;

    public EncuestaServiceImpl(FormularioService formularioService) {
        this.formularioService = formularioService;
    }

    @Override
    public void crearFormulario(FormularioRequest request,
                                StreamObserver<FormularioResponse> responseObserver) {
        try {
            if (request.getNombre().isBlank() || request.getSector().isBlank()
                    || request.getNivelEscolar().isBlank()) {
                responseObserver.onNext(FormularioResponse.newBuilder()
                        .setExito(false)
                        .setMensaje("nombre, sector y nivel_escolar son requeridos")
                        .build());
                responseObserver.onCompleted();
                return;
            }

            NivelEscolar nivel;
            try {
                nivel = NivelEscolar.valueOf(request.getNivelEscolar().toUpperCase());
            } catch (IllegalArgumentException e) {
                responseObserver.onNext(FormularioResponse.newBuilder()
                        .setExito(false)
                        .setMensaje("nivel_escolar invalido: " + request.getNivelEscolar())
                        .build());
                responseObserver.onCompleted();
                return;
            }

            Formulario f = new Formulario();
            f.setNombre(request.getNombre());
            f.setSector(request.getSector());
            f.setNivelEscolar(nivel);
            f.setUsuarioRegistro(request.getUsuarioRegistro());
            f.setLatitud(request.getLatitud() != 0.0 ? request.getLatitud() : null);
            f.setLongitud(request.getLongitud() != 0.0 ? request.getLongitud() : null);
            f.setFotoBase64(request.getFotoBase64());

            formularioService.crear(f);

            responseObserver.onNext(FormularioResponse.newBuilder()
                    .setExito(true)
                    .setMensaje("Formulario registrado exitosamente")
                    .build());
        } catch (Exception e) {
            responseObserver.onNext(FormularioResponse.newBuilder()
                    .setExito(false)
                    .setMensaje("Error interno: " + e.getMessage())
                    .build());
        }
        responseObserver.onCompleted();
    }

    @Override
    public void listarFormulariosPorUsuario(UsuarioRequest request,
                                            StreamObserver<ListaFormulariosResponse> responseObserver) {
        try {
            List<Formulario> formularios = formularioService.listarPorUsuario(request.getUsername());

            ListaFormulariosResponse.Builder builder = ListaFormulariosResponse.newBuilder();
            for (Formulario f : formularios) {
                FormularioRequest.Builder fb = FormularioRequest.newBuilder()
                        .setNombre(f.getNombre() != null ? f.getNombre() : "")
                        .setSector(f.getSector() != null ? f.getSector() : "")
                        .setNivelEscolar(f.getNivelEscolar() != null ? f.getNivelEscolar().name() : "")
                        .setUsuarioRegistro(f.getUsuarioRegistro() != null ? f.getUsuarioRegistro() : "")
                        .setFotoBase64(f.getFotoBase64() != null ? f.getFotoBase64() : "");

                if (f.getLatitud() != null) fb.setLatitud(f.getLatitud());
                if (f.getLongitud() != null) fb.setLongitud(f.getLongitud());

                builder.addFormularios(fb.build());
            }

            responseObserver.onNext(builder.build());
        } catch (Exception e) {
            responseObserver.onNext(ListaFormulariosResponse.newBuilder().build());
        }
        responseObserver.onCompleted();
    }
}
