// =============================================================================
// init-db.js — Script de inicializacion de base de datos
// Proyecto Final - Programacion Web ICC-352, PUCMM
//
// Uso:
//   mongosh "mongodb+srv://usuario:password@cluster0.xxx.mongodb.net/encuestadb" init-db.js
// =============================================================================

// En mongosh/mongo shell, `db` ya existe como variable global.
// No la redeclares con `const db = ...` porque produce error por shadowing (TDZ).
db = db.getSiblingDB("encuestadb");

print("=== Iniciando configuracion de encuestadb ===\n");

// Hacer el script idempotente: si se corre otra vez, no debe fallar por colecciones ya creadas.
const existingCollections = db.getCollectionNames();

// -----------------------------------------------------------------------------
// COLECCION: usuarios
// Campos: username (unico), password (BCrypt), nombre, rol, bloqueado
// Roles posibles: ADMIN, ENCUESTADOR
// -----------------------------------------------------------------------------
if (!existingCollections.includes("usuarios")) {
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
                },
                bloqueado: {
                    bsonType: "bool",
                    description: "Si el usuario esta bloqueado"
                }
            }
        }
    }
});
print("Coleccion 'usuarios' creada.");
} else {
print("Coleccion 'usuarios' ya existe, omitida.");
}

db.usuarios.createIndex({ username: 1 }, { unique: true, name: "idx_username_unique" });
print("Indice unico sobre 'username' verificado.");

// -----------------------------------------------------------------------------
// COLECCION: formularios
// Campos: nombre, sector, nivelEscolar, usuarioRegistro, latitud, longitud,
//         fotoBase64, fechaRegistro, localId, camposExtra
// -----------------------------------------------------------------------------
if (!existingCollections.includes("formularios")) {
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
                },
                localId: {
                    bsonType: ["string", "null"],
                    description: "ID local del cliente para deduplicacion en sincronizacion"
                },
                camposExtra: {
                    bsonType: ["object", "null"],
                    description: "Campos adicionales definidos por la plantilla activa"
                }
            }
        }
    }
});
print("Coleccion 'formularios' creada.");
} else {
print("Coleccion 'formularios' ya existe, omitida.");
}

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
// Indice para deduplicacion en sincronizacion offline
db.formularios.createIndex(
    { localId: 1, usuarioRegistro: 1 },
    { name: "idx_formulario_localid_dedup" }
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
const adminHash = "$2a$10$SoW7IeTtwHDbb7X.72myWuOzNVpr7QJwyb57OfiwKIKb1ItkKJS3e";  // Admin123!

const usuariosSeed = [
    {
        username: "admin",
        password: adminHash,
        nombre: "Administrador",
        rol: "ADMIN",
        bloqueado: false
    },
    {
        username: "encuestador1",
        password: adminHash,
        nombre: "Encuestador Ejemplo",
        rol: "ENCUESTADOR",
        bloqueado: false
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
// COLECCION: plantillas
// Campos: nombre, descripcion, esDefault, creadoPor, fechaCreacion, camposExtra[]
// -----------------------------------------------------------------------------
if (!existingCollections.includes("plantillas")) {
db.createCollection("plantillas", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["nombre", "creadoPor", "fechaCreacion"],
            properties: {
                nombre: {
                    bsonType: "string",
                    description: "Nombre de la plantilla — requerido"
                },
                descripcion: {
                    bsonType: ["string", "null"],
                    description: "Descripcion opcional"
                },
                esDefault: {
                    bsonType: "bool",
                    description: "Si es la plantilla por defecto"
                },
                creadoPor: {
                    bsonType: "string",
                    description: "Username del creador — requerido"
                },
                fechaCreacion: {
                    bsonType: "date",
                    description: "Fecha de creacion — requerido"
                },
                camposExtra: {
                    bsonType: "array",
                    description: "Campos adicionales definidos por el admin"
                }
            }
        }
    }
});
print("Coleccion 'plantillas' creada.");
} else {
print("Coleccion 'plantillas' ya existe, omitida.");
}

// --- Plantillas pre-hechas ---
const plantillasSeed = [
    {
        nombre: "Encuesta Basica",
        descripcion: "Plantilla por defecto con campos de ocupacion e ingresos.",
        esDefault: true,
        creadoPor: "admin",
        fechaCreacion: new Date(),
        camposExtra: [
            {
                id: "campo-ocupacion",
                label: "Ocupacion",
                tipo: "text",
                opciones: [],
                requerido: true,
                orden: 1
            },
            {
                id: "campo-ingresos",
                label: "Rango de ingresos mensuales",
                tipo: "select",
                opciones: [
                    "Menos de RD$15,000",
                    "RD$15,000 - RD$30,000",
                    "RD$30,000 - RD$60,000",
                    "RD$60,000 - RD$100,000",
                    "Mas de RD$100,000"
                ],
                requerido: true,
                orden: 2
            },
            {
                id: "campo-observaciones",
                label: "Observaciones",
                tipo: "textarea",
                opciones: [],
                requerido: false,
                orden: 3
            }
        ]
    },
    {
        nombre: "Encuesta Salud",
        descripcion: "Plantilla para levantamientos de salud comunitaria.",
        esDefault: false,
        creadoPor: "admin",
        fechaCreacion: new Date(),
        camposExtra: [
            {
                id: "campo-seguro-medico",
                label: "Tiene seguro medico",
                tipo: "select",
                opciones: ["Si - ARS publica", "Si - ARS privada", "No"],
                requerido: true,
                orden: 1
            },
            {
                id: "campo-condicion-cronica",
                label: "Condicion cronica diagnosticada",
                tipo: "checkbox",
                opciones: [],
                requerido: false,
                orden: 2
            },
            {
                id: "campo-ultima-visita",
                label: "Fecha de ultima visita medica",
                tipo: "date",
                opciones: [],
                requerido: false,
                orden: 3
            },
            {
                id: "campo-num-dependientes",
                label: "Numero de dependientes en el hogar",
                tipo: "number",
                opciones: [],
                requerido: true,
                orden: 4
            }
        ]
    },
    {
        nombre: "Encuesta Educacion",
        descripcion: "Plantilla para evaluacion del acceso educativo en la zona norte.",
        esDefault: false,
        creadoPor: "admin",
        fechaCreacion: new Date(),
        camposExtra: [
            {
                id: "campo-institucion",
                label: "Institucion educativa",
                tipo: "text",
                opciones: [],
                requerido: true,
                orden: 1
            },
            {
                id: "campo-modalidad",
                label: "Modalidad de estudio",
                tipo: "select",
                opciones: ["Presencial", "Virtual", "Semipresencial", "No estudia actualmente"],
                requerido: true,
                orden: 2
            },
            {
                id: "campo-acceso-internet",
                label: "Tiene acceso a internet en el hogar",
                tipo: "select",
                opciones: ["Si - fibra optica", "Si - datos moviles", "Si - satelital", "No"],
                requerido: true,
                orden: 3
            },
            {
                id: "campo-comentario-educacion",
                label: "Comentarios adicionales sobre educacion",
                tipo: "textarea",
                opciones: [],
                requerido: false,
                orden: 4
            }
        ]
    }
];

// Insertar plantillas solo si la coleccion esta vacia
const plantillasCount = db.plantillas.countDocuments();
if (plantillasCount === 0) {
    db.plantillas.insertMany(plantillasSeed);
    print("3 plantillas seed insertadas (Encuesta Basica [DEFAULT], Salud, Educacion).");
} else {
    print("Plantillas ya existen (" + plantillasCount + "), omitidas.");
}

// -----------------------------------------------------------------------------
// RESUMEN
// -----------------------------------------------------------------------------
print("\n=== Inicializacion completada ===");
print("Base de datos : encuestadb");
print("Colecciones   : usuarios, formularios, plantillas");
print("Usuarios seed : admin / Admin123!   |   encuestador1 / Admin123!");
print("Plantillas    : Encuesta Basica (DEFAULT), Encuesta Salud, Encuesta Educacion");
print("IMPORTANTE    : Cambia el hash de passwords antes de produccion.");
print("                Genera un nuevo hash en: https://bcrypt-generator.com (rounds=10)");

