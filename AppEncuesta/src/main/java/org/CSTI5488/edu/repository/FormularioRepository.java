package org.CSTI5488.edu.repository;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Accumulators;
import com.mongodb.client.model.Aggregates;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Sorts;
import org.CSTI5488.edu.db.MongoConfig;
import org.CSTI5488.edu.model.Formulario;
import org.CSTI5488.edu.model.NivelEscolar;
import org.bson.Document;
import org.bson.types.ObjectId;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
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
            .append("localId", formulario.getId())
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

    public Formulario findById(String id) {
        try {
            ObjectId oid = new ObjectId(id);
            Document doc = collection.find(Filters.eq("_id", oid)).first();
            return doc != null ? docToFormulario(doc) : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public boolean update(String id, Formulario formulario) {
        try {
            ObjectId oid = new ObjectId(id);
            Document setDoc = new Document()
                .append("nombre",      formulario.getNombre())
                .append("sector",      formulario.getSector())
                .append("nivelEscolar", formulario.getNivelEscolar().name())
                .append("latitud",     formulario.getLatitud())
                .append("longitud",    formulario.getLongitud());
            if (formulario.getFotoBase64() != null) {
                setDoc.append("fotoBase64", formulario.getFotoBase64());
            }
            var result = collection.updateOne(
                Filters.eq("_id", oid),
                new Document("$set", setDoc)
            );
            return result.getMatchedCount() > 0;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * Verifica si ya existe un formulario con el mismo ID local del cliente
     * para un usuario dado. Se usa para deduplicar al sincronizar.
     */
    public boolean existsByLocalId(String localId, String username) {
        var filter = Filters.and(
            Filters.eq("localId", localId),
            Filters.eq("usuarioRegistro", username)
        );
        return collection.countDocuments(filter) > 0;
    }

    /** Elimina todos los formularios de un usuario. Retorna cuantos se eliminaron. */
    public long deleteByUsuario(String username) {
        var result = collection.deleteMany(Filters.eq("usuarioRegistro", username));
        return result.getDeletedCount();
    }

    /** Elimina un formulario por su ObjectId. Retorna true si se eliminó. */
    public boolean deleteById(String id) {
        try {
            ObjectId oid = new ObjectId(id);
            var result = collection.deleteOne(Filters.eq("_id", oid));
            return result.getDeletedCount() > 0;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    public List<Formulario> findWithCoords() {
        List<Formulario> resultado = new ArrayList<>();
        var filter = Filters.and(
            Filters.exists("latitud"), Filters.ne("latitud", null),
            Filters.exists("longitud"), Filters.ne("longitud", null)
        );
        for (Document doc : collection.find(filter)) {
            resultado.add(docToFormulario(doc));
        }
        return resultado;
    }

    public Map<String, Object> getStats() {
        Map<String, Object> result = new LinkedHashMap<>();

        // Total de formularios
        result.put("total", collection.countDocuments());

        // Por sector (top 10)
        List<Map<String, Object>> porSector = new ArrayList<>();
        collection.aggregate(List.of(
            Aggregates.group("$sector", Accumulators.sum("count", 1)),
            Aggregates.sort(Sorts.descending("count")),
            Aggregates.limit(10)
        )).forEach(doc -> {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("sector", doc.getString("_id") != null ? doc.getString("_id") : "(sin sector)");
            entry.put("count", doc.getInteger("count", 0));
            porSector.add(entry);
        });
        result.put("porSector", porSector);

        // Por nivel escolar
        List<Map<String, Object>> porNivel = new ArrayList<>();
        collection.aggregate(List.of(
            Aggregates.group("$nivelEscolar", Accumulators.sum("count", 1)),
            Aggregates.sort(Sorts.descending("count"))
        )).forEach(doc -> {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("nivel", doc.getString("_id") != null ? doc.getString("_id") : "(sin nivel)");
            entry.put("count", doc.getInteger("count", 0));
            porNivel.add(entry);
        });
        result.put("porNivel", porNivel);

        // Por día (últimos 30 días)
        Date thirtyDaysAgo = new Date(System.currentTimeMillis() - 30L * 24 * 60 * 60 * 1000);
        List<Map<String, Object>> porDia = new ArrayList<>();
        collection.aggregate(List.of(
            Aggregates.match(Filters.gte("fechaRegistro", thirtyDaysAgo)),
            Aggregates.group(
                new Document("$dateToString",
                    new Document("format", "%Y-%m-%d").append("date", "$fechaRegistro")),
                Accumulators.sum("count", 1)
            ),
            Aggregates.sort(Sorts.ascending("_id"))
        )).forEach(doc -> {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("fecha", doc.getString("_id"));
            entry.put("count", doc.getInteger("count", 0));
            porDia.add(entry);
        });
        result.put("porDia", porDia);

        return result;
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
