package org.CSTI5488.edu.repository;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Updates;
import org.CSTI5488.edu.db.MongoConfig;
import org.CSTI5488.edu.model.Usuario;
import org.bson.Document;
import org.bson.types.ObjectId;

import java.util.ArrayList;
import java.util.List;

public class UsuarioRepository {

    private final MongoCollection<Document> collection;

    public UsuarioRepository() {
        this.collection = MongoConfig.getDatabase().getCollection("usuarios");
    }

    public Usuario findByUsername(String username) {
        Document doc = collection.find(Filters.eq("username", username)).first();
        return doc != null ? docToUsuario(doc) : null;
    }

    public Usuario findById(String id) {
        try {
            Document doc = collection.find(Filters.eq("_id", new ObjectId(id))).first();
            return doc != null ? docToUsuario(doc) : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public List<Usuario> findAll() {
        List<Usuario> resultado = new ArrayList<>();
        for (Document doc : collection.find()) {
            resultado.add(docToUsuario(doc));
        }
        return resultado;
    }

    public boolean existsByUsername(String username) {
        return collection.find(Filters.eq("username", username)).first() != null;
    }

    public void save(Usuario usuario) {
        Document doc = new Document()
            .append("_id", new ObjectId())
            .append("username", usuario.getUsername())
            .append("password", usuario.getPassword())
            .append("nombre", usuario.getNombre())
            .append("rol", usuario.getRol())
            .append("bloqueado", usuario.isBloqueado());
        collection.insertOne(doc);
    }

    public void updateRol(String id, String rol) {
        collection.updateOne(
            Filters.eq("_id", new ObjectId(id)),
            Updates.set("rol", rol)
        );
    }

    public void updateBloqueado(String id, boolean bloqueado) {
        collection.updateOne(
            Filters.eq("_id", new ObjectId(id)),
            Updates.set("bloqueado", bloqueado)
        );
    }

    private Usuario docToUsuario(Document doc) {
        Usuario u = new Usuario();
        u.setId(doc.getObjectId("_id").toHexString());
        u.setUsername(doc.getString("username"));
        u.setPassword(doc.getString("password"));
        u.setNombre(doc.getString("nombre"));
        u.setRol(doc.getString("rol"));
        Boolean bloqueado = doc.getBoolean("bloqueado");
        u.setBloqueado(bloqueado != null && bloqueado);
        return u;
    }
}
