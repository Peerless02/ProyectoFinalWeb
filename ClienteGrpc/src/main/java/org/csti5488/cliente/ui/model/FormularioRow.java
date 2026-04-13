package org.csti5488.cliente.ui.model;

import org.CSTI5488.edu.grpc.FormularioRequest;

public class FormularioRow {

    private final String nombre;
    private final String sector;
    private final String nivelEscolar;
    private final String usuarioRegistro;
    private final String latitud;
    private final String longitud;
    private final String tienesFoto;

    public FormularioRow(FormularioRequest req) {
        this.nombre          = req.getNombre();
        this.sector          = req.getSector();
        this.nivelEscolar    = req.getNivelEscolar();
        this.usuarioRegistro = req.getUsuarioRegistro();
        this.latitud         = String.valueOf(req.getLatitud());
        this.longitud        = String.valueOf(req.getLongitud());
        this.tienesFoto      = req.getFotoBase64().isEmpty() ? "No" : "Sí";
    }

    public String getNombre()          { return nombre; }
    public String getSector()          { return sector; }
    public String getNivelEscolar()    { return nivelEscolar; }
    public String getUsuarioRegistro() { return usuarioRegistro; }
    public String getLatitud()         { return latitud; }
    public String getLongitud()        { return longitud; }
    public String getTienesFoto()      { return tienesFoto; }
}
