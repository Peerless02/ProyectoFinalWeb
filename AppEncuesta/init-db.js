// =============================================================================
// init-db.js — Script de inicializacion de base de datos
// Proyecto Final - Programacion Web ICC-352, PUCMM
//
// Uso:
//   mongosh "mongodb+srv://usuario:password@cluster0.xxx.mongodb.net/encuestadb" init-db.js
// =============================================================================

const db = db.getSiblingDB("encuestadb");

print("=== Iniciando configuracion de encuestadb ===\n");

// -----------------------------------------------------------------------------
// COLECCION: usuarios
// Campos: username (unico), password (BCrypt), nombre, rol
// Roles posibles: ADMIN, ENCUESTADOR
// -----------------------------------------------------------------------------
db.createCollection("usuarios", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["username", "password", "nombre", "rol"],
            properties: {
                username: {
                    bsonType: "string",
                    description: "Nombre de usuario unico — requerido"
                },
                password: {
                    bsonType: "string",
                    description: "Password hasheado con BCrypt — requerido"
                },
                nombre: {
                    bsonType: "string",
                    description: "Nombre completo del usuario — requerido"
                },
                rol: {
                    bsonType: "string",
                    enum: ["ADMIN", "ENCUESTADOR"],
                    description: "Rol del usuario — requerido"
                }
            }
        }
    }
});
print("Coleccion 'usuarios' creada.");

db.usuarios.createIndex({ username: 1 }, { unique: true, name: "idx_username_unique" });
print("Indice unico sobre 'username' creado.");

// -----------------------------------------------------------------------------
// COLECCION: formularios
// Campos: nombre, sector, nivelEscolar, usuarioRegistro, latitud, longitud,
//         fotoBase64, fechaRegistro
// -----------------------------------------------------------------------------
db.createCollection("formularios", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["nombre", "sector", "nivelEscolar", "usuarioRegistro", "fechaRegistro"],
            properties: {
                nombre: {
                    bsonType: "string",
                    description: "Nombre del encuestado — requerido"
                },
                sector: {
                    bsonType: "string",
                    description: "Sector geografico del encuestado — requerido"
                },
                nivelEscolar: {
                    bsonType: "string",
                    enum: ["BASICO", "MEDIO", "GRADO_UNIVERSITARIO", "POSTGRADO", "DOCTORADO"],
                    description: "Nivel escolar del encuestado — requerido"
                },
                usuarioRegistro: {
                    bsonType: "string",
                    description: "Username del encuestador que registro el formulario — requerido"
                },
                latitud: {
                    bsonType: ["double", "null"],
                    description: "Latitud georeferencial del registro"
                },
                longitud: {
                    bsonType: ["double", "null"],
                    description: "Longitud georeferencial del registro"
                },
                fotoBase64: {
                    bsonType: ["string", "null"],
                    description: "Foto del encuestado codificada en Base64"
                },
                fechaRegistro: {
                    bsonType: "date",
                    description: "Fecha y hora del registro — requerido"
                }
            }
        }
    }
});
print("Coleccion 'formularios' creada.");

db.formularios.createIndex(
    { usuarioRegistro: 1 },
    { name: "idx_formulario_usuario" }
);
db.formularios.createIndex(
    { fechaRegistro: -1 },
    { name: "idx_formulario_fecha" }
);
db.formularios.createIndex(
    { latitud: 1, longitud: 1 },
    { name: "idx_formulario_coords" }
);
db.formularios.createIndex(
    { usuarioRegistro: 1, fechaRegistro: -1 },
    { name: "idx_formulario_usuario_fecha" }
);
print("Indices de 'formularios' creados.");

// -----------------------------------------------------------------------------
// DATOS INICIALES: usuarios seed
//
// NOTA: Las passwords estan hasheadas con BCrypt (rounds=10).
//   Admin123!  -> hash abajo
//
// Para generar un hash propio usa una herramienta BCrypt online:
//   https://bcrypt-generator.com  (rounds = 10)
// O registra el usuario desde la app y copia el hash de Atlas.
// -----------------------------------------------------------------------------
const adminHash = "$2a$10$7EqJtq98hPqEX7fNZaFWoOe4p2NQjFkNBPSHjHpJBwqGlxF5zYOQa";  // Admin123!

const usuariosSeed = [
    {
        username: "admin",
        password: adminHash,
        nombre: "Administrador",
        rol: "ADMIN"
    },
    {
        username: "encuestador1",
        password: adminHash,
        nombre: "Encuestador Ejemplo",
        rol: "ENCUESTADOR"
    }
];

usuariosSeed.forEach(u => {
    const existe = db.usuarios.findOne({ username: u.username });
    if (!existe) {
        db.usuarios.insertOne(u);
        print("Usuario seed insertado: " + u.username + " (" + u.rol + ")");
    } else {
        print("Usuario '" + u.username + "' ya existe, omitido.");
    }
});

// -----------------------------------------------------------------------------
// RESUMEN
// -----------------------------------------------------------------------------
print("\n=== Inicializacion completada ===");
print("Base de datos : encuestadb");
print("Colecciones   : usuarios, formularios");
print("Usuarios seed : admin / Admin123!   |   encuestador1 / Admin123!");
print("IMPORTANTE    : Cambia el hash de passwords antes de produccion.");
print("                Genera un nuevo hash en: https://bcrypt-generator.com (rounds=10)");
