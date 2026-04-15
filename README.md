# AppEncuesta — Proyecto Final ICC-352

**Programación Web — PUCMM**  
**Profesor:** Ing. Carlos Camacho

Sistema web para la Oficina de Planeamiento de la PUCMM, diseñado para realizar encuestas de campo en la zona norte del país. Los encuestadores pueden capturar datos incluso sin conexión a internet, y la información se sincroniza automáticamente al recuperar conectividad.

---

## Tabla de Contenido

- [Credenciales de Acceso](#credenciales-de-acceso)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Requisitos Previos](#requisitos-previos)
- [Instalación y Ejecución](#instalación-y-ejecución)
- [Flujo de la Aplicación](#flujo-de-la-aplicación)
- [API REST](#api-rest)
- [Servicio gRPC](#servicio-grpc)
- [Clientes](#clientes)
- [Arquitectura](#arquitectura)
- [Variables de Entorno](#variables-de-entorno)
- [Requerimientos Cubiertos](#requerimientos-cubiertos)

---

## Credenciales de Acceso

| Usuario | Contraseña | Rol | Descripción |
|---------|-----------|-----|-------------|
| `admin` | `admin` | ADMIN | Acceso total: gestión de usuarios, plantillas y encuestas |
| `encuestador1` | `admin` | ENCUESTADOR | Solo puede crear y ver sus encuestas |

> **Nota:** Las contraseñas están hasheadas con BCrypt (rounds=10) en MongoDB. Para cambiar una contraseña, actualícela desde la sección de Usuarios como ADMIN o modifique el hash directamente en la colección `usuarios` de MongoDB Atlas.

---

## Estructura del Proyecto

```
ProyectoFinalWeb/
├── AppEncuesta/                  # Servidor principal
│   ├── src/main/java/            # Código fuente Java
│   │   └── org/CSTI5488/edu/
│   │       ├── Main.java         # Punto de entrada
│   │       ├── controller/       # Controladores HTTP y WebSocket
│   │       │   ├── AuthController.java
│   │       │   ├── FormularioController.java
│   │       │   ├── PlantillaController.java
│   │       │   ├── SyncController.java         # WebSocket /sync
│   │       │   └── UsuarioController.java
│   │       ├── service/          # Lógica de negocio
│   │       │   ├── AuthService.java            # JWT + BCrypt
│   │       │   ├── FormularioService.java
│   │       │   └── PlantillaService.java
│   │       ├── repository/       # Acceso a datos MongoDB
│   │       │   ├── FormularioRepository.java
│   │       │   ├── UsuarioRepository.java
│   │       │   └── PlantillaRepository.java
│   │       ├── model/            # Modelos de datos
│   │       │   ├── Formulario.java
│   │       │   ├── Usuario.java
│   │       │   ├── Plantilla.java
│   │       │   ├── CampoExtra.java
│   │       │   └── NivelEscolar.java           # Enum
│   │       ├── db/               # Configuración MongoDB
│   │       │   └── MongoConfig.java
│   │       └── grpc/             # Servidor gRPC
│   │           ├── GrpcServer.java
│   │           └── EncuestaServiceImpl.java
│   ├── src/main/proto/
│   │   └── encuesta.proto        # Definición de servicios gRPC
│   ├── src/main/resources/public/  # Frontend HTML5
│   │   ├── index.html            # Página principal + listado
│   │   ├── crear-encuesta.html   # Crear formulario (cámara + GPS)
│   │   ├── encuesta.html         # Detalle de encuesta
│   │   ├── mapa.html             # Mapa Leaflet con marcadores
│   │   ├── usuarios.html         # CRUD de usuarios (solo ADMIN)
│   │   ├── admin-plantillas.html # Gestión de plantillas
│   │   ├── js/
│   │   │   ├── encuestas.js      # Lógica principal + sync
│   │   │   ├── sync-worker.js    # Web Worker para sincronización
│   │   │   ├── models.js         # Modelos JS
│   │   │   └── mapa.js           # Lógica del mapa Leaflet
│   │   └── css/, images/, fonts/ # Assets CSS/Bootstrap
│   ├── init-db.js                # Script de inicialización MongoDB
│   ├── Dockerfile                # Build multi-stage (JDK 21 → JRE)
│   ├── docker-compose.yml        # Orquestación de servicios
│   └── build.gradle              # Dependencias y configuración
│
├── ClienteREST/                  # Cliente REST (Javalin :8080)
│   └── AppEncuesta/src/main/java/
│       └── org/CSTI5488/edu/cliente/
│           ├── ClienteRestApp.java
│           ├── ClienteRestController.java
│           └── ClienteRestService.java
│
└── ClienteGrpc/                  # Cliente gRPC (JavaFX)
    └── AppEncuesta/src/main/java/
        └── org/CSTI5488/edu/clientegrpc/
            ├── MainApp.java
            ├── MainWindow.java
            ├── GrpcClientService.java
            ├── CrearFormularioTab.java
            └── ListarFormulariosTab.java
```

---

## Tecnologías Utilizadas

| Capa | Tecnología |
|------|-----------|
| **Servidor** | Javalin 7.1.0 (Java 21) |
| **Base de datos** | MongoDB Atlas (MongoDB 7) |
| **Frontend** | HTML5, CSS3, JavaScript ES5, Bootstrap 3 |
| **Sincronización** | WebSocket + Web Workers + localStorage |
| **Mapa** | Leaflet.js |
| **Cámara** | Webcam-easy (captura en Base64) |
| **Seguridad** | JWT (java-jwt 4.4) + BCrypt (jBCrypt) |
| **API REST** | Endpoints JSON + JWT Bearer auth |
| **gRPC** | Protocol Buffers 3 + gRPC Java 1.64 |
| **Docker** | Multi-stage build (eclipse-temurin:21) |
| **SSL** | Nginx + Certbot (Let's Encrypt) |
| **Cloud** | AWS EC2 + MongoDB Atlas |

---

## Requisitos Previos

- **Java 21+** (para ejecución local)
- **Docker y Docker Compose** (para ejecución containerizada)
- **MongoDB Atlas** (cuenta configurada — ya incluida en las variables de entorno)
- **mongosh** (opcional, para ejecutar `init-db.js` manualmente)

---

## Instalación y Ejecución

### Opción 1: Docker Compose (recomendado)

```bash
cd AppEncuesta

# Crear archivo .env (o .env.local) con las variables necesarias
cat > .env <<EOF
MONGO_URL=mongodb+srv://usuario:password@cluster.mongodb.net/encuestadb
JWT_SECRET=TuSecretoJWT
PUERTO=7000
GRPC_PORT=9090
EOF

# Levantar todo
docker-compose up --build -d

# Verificar que está corriendo
docker-compose ps
docker-compose logs -f javalin-app
```

La aplicación estará disponible en:
- **Web:** `http://localhost:7000`
- **gRPC:** `localhost:9090`

### Opción 2: Ejecución local con Gradle

```bash
cd AppEncuesta

# Exportar variables de entorno
export MONGO_URL="mongodb+srv://usuario:password@cluster.mongodb.net/encuestadb"
export JWT_SECRET="TuSecretoJWT"
export PUERTO=7000
export GRPC_PORT=9090

# Compilar y ejecutar
./gradlew run
```

### Inicialización de la Base de Datos

El script `init-db.js` crea las colecciones con validación de esquema e inserta datos iniciales. Se ejecuta automáticamente en Docker Compose, o manualmente con:

```bash
mongosh "mongodb+srv://usuario:password@cluster.mongodb.net/encuestadb" init-db.js
```

El script es **idempotente** — puede ejecutarse múltiples veces sin duplicar datos.

**Crea automáticamente:**
- Colección `usuarios` con índice único en `username`
- Colección `formularios` con índices en `usuarioRegistro`, `fechaRegistro` y coordenadas
- Colección `plantillas` con validación de esquema
- 2 usuarios seed: `admin` (ADMIN) y `encuestador1` (ENCUESTADOR)
- 3 plantillas seed: Encuesta Básica (DEFAULT), Encuesta Salud, Encuesta Educación

---

## Flujo de la Aplicación

### 1. Autenticación

```
Usuario abre la app → Modal de login → POST /api/auth/login
→ Servidor verifica BCrypt → Genera JWT (válido 24h)
→ Token se guarda en localStorage (Web Storage)
→ Sesión sobrevive recargas y desconexiones
```

### 2. Crear Encuesta (Online)

```
Usuario navega a "Nueva Encuesta" → Se solicita GPS automáticamente
→ Llena: Nombre, Sector, Nivel Escolar + campos de plantilla
→ Toma foto con cámara (convertida a Base64)
→ Submit → Se guarda en localStorage → Se envía al servidor vía REST
→ Servidor guarda en MongoDB con coordenadas y timestamp
```

### 3. Crear Encuesta (Offline)

```
Sin internet → Formulario funciona igual (sesión en localStorage)
→ Submit → Se guarda en localStorage con sincronizado=false
→ [Usuario puede editar o borrar antes de enviar]
→ Se reconecta WiFi → Event 'online' detectado
→ Web Worker (sync-worker.js) abre WebSocket a /sync
→ Envía encuestas pendientes en JSON
→ Servidor aplica deduplicación por localId
→ Responde con IDs guardados → Se marcan como sincronizadas ✅
```

### 4. Consultar Encuestas

```
Página principal → Lista de encuestas del usuario autenticado
→ Muestra nombre, sector, nivel, fecha, foto (si existe)
→ Opción para ver encuesta en detalle
```

### 5. Mapa Georeferencial

```
mapa.html → GET /api/formularios/mapa → Devuelve encuestas con coordenadas
→ Leaflet renderiza marcadores en el mapa
→ Clic en marcador → Popup con datos de la encuesta
```

### 6. Gestión de Usuarios (solo ADMIN)

```
usuarios.html → GET /api/usuarios → Lista de usuarios
→ Crear nuevo usuario (nombre, username, password, rol)
→ Cambiar rol (ADMIN ↔ ENCUESTADOR)
→ Bloquear/desbloquear usuarios
```

### 7. Gestión de Plantillas (solo ADMIN)

```
admin-plantillas.html → Lista de plantillas con campos extra
→ Crear nueva plantilla → Agregar campos (text, number, select, date, checkbox, textarea)
→ Marcar plantilla como DEFAULT → Se usa automáticamente en crear-encuesta.html
```

---

## API REST

Todos los endpoints (excepto login) requieren header `Authorization: Bearer <JWT>`.

### Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login. Body: `{"username":"...","password":"..."}`. Retorna `{"token":"JWT"}` |

### Formularios

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/formularios` | Crear formulario. Body: `{nombre, sector, nivelEscolar, fotoBase64, latitud, longitud}` |
| `GET` | `/api/formularios/usuario/{username}` | Listar formularios de un usuario |
| `PUT` | `/api/formularios/{id}` | Actualizar formulario |
| `GET` | `/api/formularios/mapa` | Listar formularios con coordenadas (para el mapa) |

### Usuarios

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/usuarios` | Listar todos (solo ADMIN) |
| `POST` | `/api/usuarios` | Crear usuario |
| `PUT` | `/api/usuarios/{id}/rol` | Cambiar rol |
| `PUT` | `/api/usuarios/{id}/bloqueado` | Bloquear/desbloquear |
| `GET` | `/api/session` | Obtener sesión actual del token |

### Plantillas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/plantillas` | Listar todas |
| `POST` | `/api/plantillas` | Crear plantilla (solo ADMIN) |
| `GET` | `/api/plantillas/{id}` | Obtener una plantilla |
| `DELETE` | `/api/plantillas/{id}` | Eliminar plantilla (solo ADMIN, no puede ser la default) |
| `POST` | `/api/plantillas/{id}/default` | Marcar como default (solo ADMIN) |
| `POST` | `/api/plantillas/{id}/campos` | Agregar campo extra |
| `PUT` | `/api/plantillas/{id}/campos/{cid}` | Editar campo |
| `DELETE` | `/api/plantillas/{id}/campos/{cid}` | Eliminar campo |

### WebSocket

| Ruta | Descripción |
|------|-------------|
| `ws://.../sync?token=JWT` | Sincronización de encuestas offline. Recibe JSON con array de formularios. |

---

## Servicio gRPC

Definido en `src/main/proto/encuesta.proto`. Puerto por defecto: **9090**.

```protobuf
service EncuestaService {
  rpc CrearFormulario (FormularioRequest) returns (FormularioResponse);
  rpc ListarFormulariosPorUsuario (UsuarioRequest) returns (ListaFormulariosResponse);
}
```

### Mensajes

- **FormularioRequest:** nombre, sector, nivel_escolar, usuario_registro, latitud, longitud, foto_base64
- **FormularioResponse:** exito (bool), mensaje (string)
- **UsuarioRequest:** username
- **ListaFormulariosResponse:** lista de FormularioRequest

---

## Clientes

### Cliente REST (Puerto 8080)

Aplicación web independiente construida con Javalin. Se conecta al servidor principal mediante `java.net.http.HttpClient`.

```bash
cd ClienteREST
export SERVIDOR_URL=http://localhost:7000
gradle run
```

**Funcionalidades:**
- Login con JWT
- Listar formularios por usuario
- Crear formularios con imagen en base64

### Cliente gRPC (JavaFX)

Aplicación de escritorio con interfaz gráfica JavaFX.

```bash
cd ClienteGrpc/AppEncuesta
./gradlew run
```

**Funcionalidades:**
- Conectar/desconectar al servidor gRPC
- Tab "Crear Formulario": enviar encuesta con todos los campos
- Tab "Listar Formularios": consultar encuestas por usuario

---

## Arquitectura

```
┌─────────────────────────────────┐
│   Frontend HTML5 (Offline-First)│
│   index.html, crear-encuesta,   │
│   mapa.html, usuarios.html      │
│   ┌──────────┐ ┌──────────────┐ │
│   │localStorage│ │sync-worker.js│ │
│   └──────────┘ └─────┬────────┘ │
└───────────┬──────────┼──────────┘
            │ REST/JWT │ WebSocket
            ▼          ▼
┌──────────────────────────────────┐
│     Servidor Javalin (:7000)     │
│  ┌────────────────────────────┐  │
│  │ Controllers                │  │
│  │  Auth │ Formulario │ Sync  │  │
│  │  Usuario │ Plantilla       │  │
│  ├────────────────────────────┤  │
│  │ Services (lógica negocio)  │  │
│  │  AuthService (JWT+BCrypt)  │  │
│  │  FormularioService         │  │
│  │  PlantillaService          │  │
│  ├────────────────────────────┤  │
│  │ Repositories (MongoDB)     │  │
│  └────────────────────────────┘  │
│           │                      │
│     ┌─────┴─────┐               │
│     │ MongoConfig│               │
│     └─────┬─────┘               │
└───────────┼──────────────────────┘
            │
            ▼
   ┌────────────────┐     ┌──────────────────┐
   │  MongoDB Atlas  │     │  gRPC Server     │
   │  (encuestadb)   │     │  (:9090)         │
   │                 │     │  Protobuf/HTTP2  │
   │  - usuarios     │     └────────┬─────────┘
   │  - formularios  │              │
   │  - plantillas   │              │
   └────────────────┘              │
                          ┌────────┴─────────┐
                          │                  │
                   ┌──────┴──┐        ┌──────┴──────┐
                   │ Cliente │        │ Cliente     │
                   │ REST    │        │ gRPC        │
                   │ (:8080) │        │ (JavaFX)    │
                   └─────────┘        └─────────────┘
```

---

## Variables de Entorno

| Variable | Valor por defecto | Descripción |
|----------|-------------------|-------------|
| `MONGO_URL` | `mongodb://localhost:27017` | URI de conexión a MongoDB |
| `MONGO_DB_NAME` | `encuestadb` | Nombre de la base de datos |
| `JWT_SECRET` | *(requerido)* | Secreto para firmar tokens JWT |
| `PUERTO` | `7000` | Puerto del servidor HTTP (Javalin) |
| `GRPC_PORT` | `9090` | Puerto del servidor gRPC |
| `SERVIDOR_URL` | `http://localhost:7000` | URL del servidor (usado por ClienteREST) |

---

## Requerimientos Cubiertos

| # | Requerimiento | Estado | Implementación |
|---|--------------|--------|----------------|
| 1 | Aplicación Web | ✅ | Frontend HTML5 servido por Javalin |
| 2 | Javalin en el servidor | ✅ | Javalin 7.1.0, Main.java |
| 3 | Diseño responsive + plantilla CSS | ✅ | Bootstrap 3 + plantilla personalizada |
| 4 | MongoDB NoSQL | ✅ | MongoDB Atlas en la nube |
| 5 | Motor de persistencia MongoDB | ✅ | MongoDB Java Sync Driver 5.1.0 |
| 6 | Formulario: Nombre, Sector, Nivel Escolar, usuario | ✅ | crear-encuesta.html + FormularioController |
| 7 | Geolocalización (lat/long) | ✅ | API Geolocation HTML5, guardado automático |
| 8 | Almacenamiento local + WebSocket + Web Workers | ✅ | localStorage + sync-worker.js + SyncController |
| 9 | Listado + mapa con marcadores | ✅ | index.html + mapa.html (Leaflet) |
| 10 | Usuarios, roles, auth, Web Storage | ✅ | usuarios.html + AuthService + localStorage |
| 11 | Editar/borrar antes de enviar | ✅ | Gestión local pre-sincronización |
| 12 | URL pública + dominio + HTTPS | ✅ | AWS EC2 + Nginx + Certbot |
| 13 | Prueba desde teléfono/tableta | ✅ | Diseño responsive, probado en móvil |
| 14 | Foto con cámara en base64 | ✅ | Webcam-easy, almacenada como Base64 |
| 15 | Docker + Docker Compose | ✅ | Dockerfile multi-stage + docker-compose.yml |
| 16 | Servicio REST y gRPC | ✅ | Endpoints REST + encuesta.proto |
| 17 | JWT en REST | ✅ | Bearer token en header Authorization |
| 18 | Cliente REST elaborado | ✅ | ClienteREST/ (Javalin web, no consola) |
| 19 | Cliente gRPC elaborado | ✅ | ClienteGrpc/ (JavaFX, no consola) |
