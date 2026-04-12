package org.CSTI5488.edu.repository;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import org.CSTI5488.edu.db.MongoConfig;
import org.CSTI5488.edu.model.Formulario;
import org.CSTI5488.edu.model.NivelEscolar;
import org.bson.Document;
import org.bson.types.ObjectId;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

public class FormularioRepository {

    private final MongoCollection<Document> collection;

    public FormularioRepository() {
        this.collection = MongoConfig.getDatabase().getCollection("formularios");
    }

    public void save(Formulario formulario) {
        Document camposExtraDoc = null;
        Map<String, Object> camposExtra = formulario.getCamposExtra();
        if (camposExtra != null) {
            camposExtraDoc = new Document(camposExtra);
        }

        Document doc = new Document()
            .append("_id", new ObjectId())
            .append("nombre", formulario.getNombre())
            .append("sector", formulario.getSector())
            .append("nivelEscolar", formulario.getNivelEscolar().name())
            .append("usuarioRegistro", formulario.getUsuarioRegistro())
            .append("latitud", formulario.getLatitud())
            .append("longitud", formulario.getLongitud())
            .append("fotoBase64", formulario.getFotoBase64())
            .append("camposExtra", camposExtraDoc)
            .append("fechaRegistro", formulario.getFechaRegistro() != null ? formulario.getFechaRegistro() : new Date());
        collection.insertOne(doc);
    }

    public List<Formulario> findByUsuario(String username) {
        List<Formulario> resultado = new ArrayList<>();
        for (Document doc : collection.find(Filters.eq("usuarioRegistro", username))) {
            resultado.add(docToFormulario(doc));
        }
        return resultado;
    }

    private Formulario docToFormulario(Document doc) {
        Formulario f = new Formulario();
        f.setId(doc.getObjectId("_id").toHexString());
        f.setNombre(doc.getString("nombre"));
        f.setSector(doc.getString("sector"));
        f.setNivelEscolar(NivelEscolar.valueOf(doc.getString("nivelEscolar")));
        f.setUsuarioRegistro(doc.getString("usuarioRegistro"));
        f.setLatitud(doc.getDouble("latitud"));
        f.setLongitud(doc.getDouble("longitud"));
        f.setFotoBase64(doc.getString("fotoBase64"));
        Object rawExtra = doc.get("camposExtra");
        if (rawExtra instanceof Document) {
            f.setCamposExtra(((Document) rawExtra));
        }
        f.setFechaRegistro(doc.getDate("fechaRegistro"));
        return f;
    }
}
