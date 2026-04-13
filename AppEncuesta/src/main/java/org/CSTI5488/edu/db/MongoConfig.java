package org.CSTI5488.edu.db;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.Objects;

import com.mongodb.MongoClientException;
import com.mongodb.MongoSocketOpenException;
import com.mongodb.MongoTimeoutException;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;

public class MongoConfig {

    private static final Object INIT_LOCK = new Object();

    // Underlying client/db are created on-demand, not at getDatabase() time.
    private static volatile MongoClient client;
    private static volatile MongoDatabase database;

    // A stable proxy returned by getDatabase() so callers can keep references without forcing init.
    private static volatile MongoDatabase databaseProxy;

    public static MongoDatabase getDatabase() {
        MongoDatabase proxy = databaseProxy;
        if (proxy != null) return proxy;

        synchronized (INIT_LOCK) {
            if (databaseProxy == null) {
                databaseProxy = createDatabaseProxy();
            }
            return databaseProxy;
        }
    }

    public static String getMongoUrl() {
        String url = System.getenv("MONGO_URL");
        if (url == null || url.isEmpty()) {
            url = "mongodb://localhost:27017";
        }
        return url;
    }

    public static String getMongoDbName() {
        String dbName = System.getenv("MONGO_DB_NAME");
        if (dbName == null || dbName.isEmpty()) {
            dbName = "encuestadb";
        }
        return dbName;
    }

    public static String getMongoUrlRedacted() {
        return redactMongoUrl(getMongoUrl());
    }

    private static String redactMongoUrl(String url) {
        if (url == null) return null;
        int schemeIdx = url.indexOf("://");
        if (schemeIdx < 0) return url;

        int authStart = schemeIdx + 3;
        int atIdx = url.indexOf('@', authStart);
        if (atIdx < 0) return url; // no credentials segment

        String auth = url.substring(authStart, atIdx);
        int colonIdx = auth.indexOf(':');
        if (colonIdx < 0) {
            // username only
            return url.substring(0, authStart) + "***@" + url.substring(atIdx + 1);
        }

        String user = auth.substring(0, colonIdx);
        return url.substring(0, authStart) + user + ":***@" + url.substring(atIdx + 1);
    }

    private static MongoDatabase createDatabaseProxy() {
        InvocationHandler handler = new MongoDatabaseProxyHandler();
        return (MongoDatabase) Proxy.newProxyInstance(
            MongoDatabase.class.getClassLoader(),
            new Class<?>[]{MongoDatabase.class},
            handler
        );
    }

    private static MongoDatabase realDatabase() {
        MongoDatabase db = database;
        if (db != null) return db;

        synchronized (INIT_LOCK) {
            if (database != null) return database;

            String url = getMongoUrl();
            String dbName = getMongoDbName();
            try {
                client = MongoClients.create(url);
                database = client.getDatabase(dbName);
                return database;
            } catch (RuntimeException e) {
                // Don't poison state; allow a later retry if MongoDB comes up.
                client = null;
                database = null;
                throw new MongoUnavailableException(
                    "MongoDB no disponible (" + redactMongoUrl(url) + ", db=" + dbName + ")",
                    e
                );
            }
        }
    }

    private static RuntimeException wrapIfConnectivityIssue(RuntimeException e) {
        if (isConnectivityIssue(e)) {
            return new MongoUnavailableException(
                "MongoDB no disponible (" + getMongoUrlRedacted() + ", db=" + getMongoDbName() + ")",
                e
            );
        }
        return e;
    }

    private static boolean isConnectivityIssue(Throwable t) {
        for (Throwable cur = t; cur != null; cur = cur.getCause()) {
            if (cur instanceof MongoTimeoutException) return true;
            if (cur instanceof MongoSocketOpenException) return true;
            if (cur instanceof MongoClientException) {
                // Many connectivity failures are surfaced as MongoClientException with a net cause.
                Throwable cause = cur.getCause();
                if (cause instanceof ConnectException) return true;
                if (cause instanceof SocketTimeoutException) return true;
                if (cause instanceof UnknownHostException) return true;
            }
            if (cur instanceof ConnectException) return true;
            if (cur instanceof SocketTimeoutException) return true;
            if (cur instanceof UnknownHostException) return true;
        }
        return false;
    }

    private static final class MongoDatabaseProxyHandler implements InvocationHandler {
        @Override
        public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
            String name = method.getName();
            if (method.getDeclaringClass() == Object.class) {
                return handleObjectMethod(proxy, method, args);
            }

            // IMPORTANT: repository constructors call getDatabase().getCollection(...).
            // Returning a proxy collection keeps startup DB-free; the first real operation triggers init.
            if ("getCollection".equals(name) && args != null && args.length >= 1 && args[0] instanceof String) {
                String collectionName = (String) args[0];
                Class<?> documentClass = (args.length >= 2 && args[1] instanceof Class) ? (Class<?>) args[1] : null;
                return createCollectionProxy(collectionName, documentClass);
            }

            try {
                return method.invoke(realDatabase(), args);
            } catch (InvocationTargetException ite) {
                Throwable target = ite.getTargetException();
                if (target instanceof RuntimeException re) throw wrapIfConnectivityIssue(re);
                throw target;
            } catch (RuntimeException re) {
                throw wrapIfConnectivityIssue(re);
            }
        }

        private Object handleObjectMethod(Object proxy, Method method, Object[] args) {
            String name = method.getName();
            if ("toString".equals(name)) {
                return "MongoDatabaseProxy(" + getMongoUrlRedacted() + ", db=" + getMongoDbName() + ")";
            }
            if ("hashCode".equals(name)) {
                return System.identityHashCode(proxy);
            }
            if ("equals".equals(name)) {
                return proxy == (args != null && args.length == 1 ? args[0] : null);
            }
            throw new UnsupportedOperationException("Unsupported Object method: " + name);
        }
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static MongoCollection<?> createCollectionProxy(String collectionName, Class<?> documentClass) {
        Objects.requireNonNull(collectionName, "collectionName");

        InvocationHandler handler = new MongoCollectionProxyHandler(collectionName, documentClass);
        return (MongoCollection<?>) Proxy.newProxyInstance(
            MongoCollection.class.getClassLoader(),
            new Class<?>[]{MongoCollection.class},
            handler
        );
    }

    private static final class MongoCollectionProxyHandler implements InvocationHandler {
        private final String collectionName;
        private final Class<?> documentClass;

        private MongoCollectionProxyHandler(String collectionName, Class<?> documentClass) {
            this.collectionName = collectionName;
            this.documentClass = documentClass;
        }

        @Override
        public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
            if (method.getDeclaringClass() == Object.class) {
                String name = method.getName();
                if ("toString".equals(name)) return "MongoCollectionProxy(" + collectionName + ")";
                if ("hashCode".equals(name)) return System.identityHashCode(proxy);
                if ("equals".equals(name)) return proxy == (args != null && args.length == 1 ? args[0] : null);
                throw new UnsupportedOperationException("Unsupported Object method: " + name);
            }

            try {
                MongoCollection<?> realCollection = (documentClass == null)
                    ? realDatabase().getCollection(collectionName)
                    : realDatabase().getCollection(collectionName, (Class) documentClass);

                return method.invoke(realCollection, args);
            } catch (InvocationTargetException ite) {
                Throwable target = ite.getTargetException();
                if (target instanceof RuntimeException re) throw wrapIfConnectivityIssue(re);
                throw target;
            } catch (RuntimeException re) {
                throw wrapIfConnectivityIssue(re);
            }
        }
    }

    public static final class MongoUnavailableException extends RuntimeException {
        public MongoUnavailableException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
