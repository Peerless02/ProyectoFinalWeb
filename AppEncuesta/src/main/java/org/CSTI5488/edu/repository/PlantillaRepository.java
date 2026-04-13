package org.CSTI5488.edu.repository;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Updates;
import org.CSTI5488.edu.db.MongoConfig;
import org.CSTI5488.edu.model.CampoExtra;
import org.CSTI5488.edu.model.Plantilla;
import org.bson.Document;
import org.bson.types.ObjectId;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;

public class PlantillaRepository {

    private final MongoCollection<Document> collection;

    public PlantillaRepository() {
        this.collection = MongoConfig.getDatabase().getCollection("plantillas");
    }

    public void save(Plantilla p) {
        Document doc = plantillaToDoc(p, true);
        collection.insertOne(doc);
        ObjectId id = doc.getObjectId("_id");
        if (id != null) p.setId(id.toHexString());
    }

    public List<Plantilla> findAll() {
        List<Plantilla> out = new ArrayList<>();
        for (Document doc : collection.find()) {
            out.add(docToPlantilla(doc));
        }
        return out;
    }

    public Plantilla findById(String id) {
        ObjectId oid = parseObjectId(id);
        if (oid == null) return null;
        Document doc = collection.find(Filters.eq("_id", oid)).first();
        return doc != null ? docToPlantilla(doc) : null;
    }

    public void update(Plantilla p) {
        ObjectId oid = parseObjectId(p != null ? p.getId() : null);
        if (oid == null) return;
        Document replacement = plantillaToDoc(p, false);
        replacement.put("_id", oid);
        collection.replaceOne(Filters.eq("_id", oid), replacement);
    }

    public void delete(String id) {
        ObjectId oid = parseObjectId(id);
        if (oid == null) return;
        collection.deleteOne(Filters.eq("_id", oid));
    }

    public void setDefault(String id) {
        ObjectId oid = parseObjectId(id);
        if (oid == null) return;
        collection.updateMany(new Document(), Updates.set("esDefault", false));
        collection.updateOne(Filters.eq("_id", oid), Updates.set("esDefault", true));
    }

    private static ObjectId parseObjectId(String id) {
        if (id == null || id.isEmpty()) return null;
        try {
            return new ObjectId(id);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static Document plantillaToDoc(Plantilla p, boolean assignId) {
        Document doc = new Document();
        if (assignId) doc.append("_id", new ObjectId());
        if (p == null) return doc;

        doc.append("nombre", p.getNombre());
        doc.append("descripcion", p.getDescripcion());
        doc.append("esDefault", p.isEsDefault());
        doc.append("creadoPor", p.getCreadoPor());
        doc.append("fechaCreacion", p.getFechaCreacion() != null ? p.getFechaCreacion() : new Date());

        List<Document> campos = new ArrayList<>();
        if (p.getCamposExtra() != null) {
            for (CampoExtra c : p.getCamposExtra()) {
                if (c == null) continue;
                Document cd = new Document()
                    .append("id", c.getId())
                    .append("label", c.getLabel())
                    .append("tipo", c.getTipo())
                    .append("opciones", c.getOpciones() != null ? c.getOpciones() : Collections.emptyList())
                    .append("requerido", c.isRequerido())
                    .append("orden", c.getOrden());
                campos.add(cd);
            }
        }
        doc.append("camposExtra", campos);
        return doc;
    }

    private static Plantilla docToPlantilla(Document doc) {
        if (doc == null) return null;
        Plantilla p = new Plantilla();
        ObjectId oid = doc.getObjectId("_id");
        if (oid != null) p.setId(oid.toHexString());
        p.setNombre(doc.getString("nombre"));
        p.setDescripcion(doc.getString("descripcion"));
        Boolean esDef = doc.getBoolean("esDefault");
        p.setEsDefault(esDef != null && esDef);
        p.setCreadoPor(doc.getString("creadoPor"));
        p.setFechaCreacion(doc.getDate("fechaCreacion"));

        List<CampoExtra> campos = new ArrayList<>();
        List<Document> rawCampos = (List<Document>) doc.get("camposExtra");
        if (rawCampos != null) {
            for (Document cd : rawCampos) {
                if (cd == null) continue;
                CampoExtra c = new CampoExtra();
                c.setId(cd.getString("id"));
                c.setLabel(cd.getString("label"));
                c.setTipo(cd.getString("tipo"));
                Object rawOps = cd.get("opciones");
                if (rawOps instanceof List) {
                    List<?> l = (List<?>) rawOps;
                    List<String> ops = new ArrayList<>();
                    for (Object o : l) {
                        if (o != null) ops.add(String.valueOf(o));
                    }
                    c.setOpciones(ops);
                } else {
                    c.setOpciones(Collections.emptyList());
                }
                Boolean req = cd.getBoolean("requerido");
                c.setRequerido(req != null && req);
                Integer ord = cd.getInteger("orden");
                c.setOrden(ord != null ? ord : 0);
                campos.add(c);
            }
        }
        p.setCamposExtra(campos);
        return p;
    }
}
