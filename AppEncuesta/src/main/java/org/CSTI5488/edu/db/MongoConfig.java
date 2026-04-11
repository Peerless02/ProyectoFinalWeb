package org.CSTI5488.edu.db;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;

public class MongoConfig {

    private static MongoClient client;
    private static MongoDatabase database;

    public static MongoDatabase getDatabase() {
        if (database == null) {
            String url = System.getenv("MONGO_URL");
            if (url == null || url.isEmpty()) {
                url = "mongodb://localhost:27017";
            }
            client = MongoClients.create(url);
            database = client.getDatabase("encuestadb");
        }
        return database;
    }
}
