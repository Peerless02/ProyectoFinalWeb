package org.CSTI5488.edu.model;

import java.io.Serializable;
import java.util.Date;
import java.util.List;

public class Plantilla implements Serializable {

    private String id;
    private String nombre;
    private String descripcion;
    private boolean esDefault;
    private String creadoPor;
    private Date fechaCreacion;
    private List<CampoExtra> camposExtra;

    public Plantilla() {
    }

    public Plantilla(String id, String nombre, String descripcion, boolean esDefault, String creadoPor, Date fechaCreacion, List<CampoExtra> camposExtra) {
        this.id = id;
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.esDefault = esDefault;
        this.creadoPor = creadoPor;
        this.fechaCreacion = fechaCreacion;
        this.camposExtra = camposExtra;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public boolean isEsDefault() { return esDefault; }
    public void setEsDefault(boolean esDefault) { this.esDefault = esDefault; }

    public String getCreadoPor() { return creadoPor; }
    public void setCreadoPor(String creadoPor) { this.creadoPor = creadoPor; }

    public Date getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(Date fechaCreacion) { this.fechaCreacion = fechaCreacion; }

    public List<CampoExtra> getCamposExtra() { return camposExtra; }
    public void setCamposExtra(List<CampoExtra> camposExtra) { this.camposExtra = camposExtra; }
}

