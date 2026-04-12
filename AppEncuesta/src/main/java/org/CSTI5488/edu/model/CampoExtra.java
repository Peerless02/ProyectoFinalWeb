package org.CSTI5488.edu.model;

import java.io.Serializable;
import java.util.List;

public class CampoExtra implements Serializable {

    private String id; // UUID
    private String label;
    private String tipo; // text, number, select, textarea, date, checkbox
    private List<String> opciones; // solo si tipo=select
    private boolean requerido;
    private int orden;

    public CampoExtra() {
    }

    public CampoExtra(String id, String label, String tipo, List<String> opciones, boolean requerido, int orden) {
        this.id = id;
        this.label = label;
        this.tipo = tipo;
        this.opciones = opciones;
        this.requerido = requerido;
        this.orden = orden;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }

    public List<String> getOpciones() { return opciones; }
    public void setOpciones(List<String> opciones) { this.opciones = opciones; }

    public boolean isRequerido() { return requerido; }
    public void setRequerido(boolean requerido) { this.requerido = requerido; }

    public int getOrden() { return orden; }
    public void setOrden(int orden) { this.orden = orden; }
}

