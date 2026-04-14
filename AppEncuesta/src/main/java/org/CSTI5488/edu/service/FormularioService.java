package org.CSTI5488.edu.service;

import org.CSTI5488.edu.model.Formulario;
import org.CSTI5488.edu.repository.FormularioRepository;

import java.util.Date;
import java.util.List;

public class FormularioService {

    private final FormularioRepository formularioRepository;

    public FormularioService() {
        this.formularioRepository = new FormularioRepository();
    }

    public void crear(Formulario formulario) {
        if (formulario.getFechaRegistro() == null) {
            formulario.setFechaRegistro(new Date());
        }
        formularioRepository.save(formulario);
    }

    public List<Formulario> listarPorUsuario(String username) {
        return formularioRepository.findByUsuario(username);
    }

    public Formulario buscarPorId(String id) {
        return formularioRepository.findById(id);
    }

    public boolean actualizar(String id, Formulario formulario) {
        return formularioRepository.update(id, formulario);
    }

    public List<Formulario> listarConCoordenadas() {
        return formularioRepository.findWithCoords();
    }
}
