package org.CSTI5488.edu.model;

import java.io.Serializable;
import java.util.Date;

public class Formulario implements Serializable {

    private String id;
    private String nombre;
    private String sector;
    private NivelEscolar nivelEscolar;
    private String usuarioRegistro;
    private Double latitud;
    private Double longitud;
    private String fotoBase64;
    private Date fechaRegistro;

    public Formulario() {
    }

    public Formulario(String id, String nombre, String sector, NivelEscolar nivelEscolar, String usuarioRegistro, Double latitud, Double longitud, String fotoBase64, Date fechaRegistro) {
        this.id = id;
        this.nombre = nombre;
        this.sector = sector;
        this.nivelEscolar = nivelEscolar;
        this.usuarioRegistro = usuarioRegistro;
        this.latitud = latitud;
        this.longitud = longitud;
        this.fotoBase64 = fotoBase64;
        this.fechaRegistro = fechaRegistro;
    }

    // Getters y Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getSector() { return sector; }
    public void setSector(String sector) { this.sector = sector; }

    public NivelEscolar getNivelEscolar() { return nivelEscolar; }
    public void setNivelEscolar(NivelEscolar nivelEscolar) { this.nivelEscolar = nivelEscolar; }

    public String getUsuarioRegistro() { return usuarioRegistro; }
    public void setUsuarioRegistro(String usuarioRegistro) { this.usuarioRegistro = usuarioRegistro; }

    public Double getLatitud() { return latitud; }
    public void setLatitud(Double latitud) { this.latitud = latitud; }

    public Double getLongitud() { return longitud; }
    public void setLongitud(Double longitud) { this.longitud = longitud; }

    public String getFotoBase64() { return fotoBase64; }
    public void setFotoBase64(String fotoBase64) { this.fotoBase64 = fotoBase64; }

    public Date getFechaRegistro() { return fechaRegistro; }
    public void setFechaRegistro(Date fechaRegistro) { this.fechaRegistro = fechaRegistro; }
}
