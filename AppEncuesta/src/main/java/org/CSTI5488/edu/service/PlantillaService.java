package org.CSTI5488.edu.service;

import org.CSTI5488.edu.model.CampoExtra;
import org.CSTI5488.edu.model.Plantilla;
import org.CSTI5488.edu.repository.PlantillaRepository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.UUID;

public class PlantillaService {

    private final PlantillaRepository plantillaRepository;

    public PlantillaService() {
        this.plantillaRepository = new PlantillaRepository();
    }

    public void crearPlantilla(Plantilla p) {
        if (p == null) throw new IllegalArgumentException("Plantilla requerida");
        if (p.getNombre() == null || p.getNombre().trim().isEmpty()) {
            throw new IllegalArgumentException("nombre es requerido");
        }
        if (p.getFechaCreacion() == null) p.setFechaCreacion(new Date());
        if (p.getCamposExtra() == null) p.setCamposExtra(Collections.emptyList());
        // No permitir crear como default desde aqui; se gestiona via marcarDefault().
        p.setEsDefault(false);
        plantillaRepository.save(p);
    }

    public List<Plantilla> listar() {
        return plantillaRepository.findAll();
    }

    public Plantilla obtener(String id) {
        return plantillaRepository.findById(id);
    }

    public void actualizarCamposExtra(String id, List<CampoExtra> campos) {
        Plantilla p = plantillaRepository.findById(id);
        if (p == null) throw new IllegalArgumentException("Plantilla no encontrada");

        List<CampoExtra> safe = campos != null ? campos : new ArrayList<>();
        for (CampoExtra c : safe) {
            if (c == null || c.getId() == null || c.getId().trim().isEmpty()) {
                throw new IllegalArgumentException("Ningun campo puede tener id null");
            }
        }

        p.setCamposExtra(safe);
        plantillaRepository.update(p);
    }

    public CampoExtra agregarCampo(String id, CampoExtra campo) {
        Plantilla p = plantillaRepository.findById(id);
        if (p == null) throw new IllegalArgumentException("Plantilla no encontrada");
        if (campo == null) throw new IllegalArgumentException("Campo requerido");
        if (campo.getLabel() == null || campo.getLabel().trim().isEmpty()) {
            throw new IllegalArgumentException("label es requerido");
        }
        campo.setId(UUID.randomUUID().toString());

        List<CampoExtra> list = p.getCamposExtra() != null ? new ArrayList<>(p.getCamposExtra()) : new ArrayList<>();
        list.add(campo);
        p.setCamposExtra(list);
        plantillaRepository.update(p);
        return campo;
    }

    public void editarCampo(String plantillaId, String campoId, CampoExtra nuevo) {
        Plantilla p = plantillaRepository.findById(plantillaId);
        if (p == null) throw new IllegalArgumentException("Plantilla no encontrada");
        if (campoId == null || campoId.isEmpty()) throw new IllegalArgumentException("campoId requerido");
        if (nuevo == null) throw new IllegalArgumentException("Campo requerido");
        if (nuevo.getLabel() == null || nuevo.getLabel().trim().isEmpty()) {
            throw new IllegalArgumentException("label es requerido");
        }

        List<CampoExtra> list = p.getCamposExtra() != null ? new ArrayList<>(p.getCamposExtra()) : new ArrayList<>();
        boolean found = false;
        for (int i = 0; i < list.size(); i++) {
            CampoExtra c = list.get(i);
            if (c != null && campoId.equals(c.getId())) {
                nuevo.setId(campoId);
                list.set(i, nuevo);
                found = true;
                break;
            }
        }
        if (!found) throw new IllegalArgumentException("Campo no encontrado");

        p.setCamposExtra(list);
        plantillaRepository.update(p);
    }

    public void eliminarCampo(String plantillaId, String campoId) {
        Plantilla p = plantillaRepository.findById(plantillaId);
        if (p == null) throw new IllegalArgumentException("Plantilla no encontrada");
        if (campoId == null || campoId.isEmpty()) throw new IllegalArgumentException("campoId requerido");

        List<CampoExtra> list = p.getCamposExtra() != null ? new ArrayList<>(p.getCamposExtra()) : new ArrayList<>();
        int before = list.size();
        list.removeIf(c -> c != null && campoId.equals(c.getId()));
        if (list.size() == before) throw new IllegalArgumentException("Campo no encontrado");

        p.setCamposExtra(list);
        plantillaRepository.update(p);
    }

    public void marcarDefault(String id) {
        Plantilla p = plantillaRepository.findById(id);
        if (p == null) throw new IllegalArgumentException("Plantilla no encontrada");
        plantillaRepository.setDefault(id);
    }

    public void eliminarPlantilla(String id) {
        Plantilla p = plantillaRepository.findById(id);
        if (p == null) return;
        if (p.isEsDefault()) throw new IllegalStateException("No se puede eliminar la plantilla default");
        plantillaRepository.delete(id);
    }
}

