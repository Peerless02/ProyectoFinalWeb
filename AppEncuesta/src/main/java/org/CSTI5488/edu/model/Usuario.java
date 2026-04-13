package org.CSTI5488.edu.model;

import java.io.Serializable;

/**
 * Entidad principal para manejar los Usuarios.
 * Esta clase sirve como contrato para la autenticación y gestión de roles.
 */
public class Usuario implements Serializable {

    private String id;
    private String username;
    private String password;
    private String nombre;
    private String rol;
    private boolean bloqueado;

    public Usuario() {
    }

    public Usuario(String id, String username, String password, String nombre, String rol) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.nombre = nombre;
        this.rol = rol;
        this.bloqueado = false;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password; // Recuerda: El backend debe guardar esto con hash (Bcrypt, Argon2, etc)
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getRol() {
        return rol;
    }

    public void setRol(String rol) {
        this.rol = rol;
    }

    public boolean isBloqueado() {
        return bloqueado;
    }

    public void setBloqueado(boolean bloqueado) {
        this.bloqueado = bloqueado;
    }
}
