package org.CSTI5488.edu.repository;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import org.CSTI5488.edu.db.MongoConfig;
import org.CSTI5488.edu.model.Usuario;
import org.bson.Document;
import org.bson.types.ObjectId;

public class UsuarioRepository {

    private final MongoCollection<Document> collection;

    public UsuarioRepository() {
        this.collection = MongoConfig.getDatabase().getCollection("usuarios");
    }

    public Usuario findByUsername(String username) {
        Document doc = collection.find(Filters.eq("username", username)).first();
        if (doc == null) return null;

        return new Usuario(
            doc.getObjectId("_id").toHexString(),
            doc.getString("username"),
            doc.getString("password"),
            doc.getString("nombre"),
            doc.getString("rol")
        );
    }

    public void save(Usuario usuario) {
        Document doc = new Document()
            .append("_id", new ObjectId())
            .append("username", usuario.getUsername())
            .append("password", usuario.getPassword())
            .append("nombre", usuario.getNombre())
            .append("rol", usuario.getRol());
        collection.insertOne(doc);
    }
}
