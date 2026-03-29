# Plan de Acción y División del Proyecto Final

Este documento detalla la división del trabajo y los contratos compartidos para el desarrollo de la aplicación web de encuestas para la Oficina de Planeamiento (OP) de la PUCMM.

## 1. División del Trabajo

Para asegurar un desarrollo sin conflictos en el control de versiones (Git), el proyecto se divide arquitectónicamente en Frontend y Backend.

### 👤 Desarrollador A: Backend, APIs, Base de Datos e Infraestructura
**Responsabilidades:**
*   **Servidor Web:** Javalin.
*   **Base de Datos:** MongoDB Atlas (uso de ODM o driver nativo).
*   **Seguridad:** Autenticación y generación de JWT (JSON Web Tokens) para el API REST.
*   **Sincronización:** Implementación de WebSockets en el servidor para recibir datos masivos almacenados offline.
*   **Servicios Externos:**
    *   API REST (esquema de seguridad JWT).
    *   Servicio gRPC.
*   **DevOps:** Contenedores (`Dockerfile` y `docker-compose.yml`). Publicación en dominio configurado con certificado digital.

### 👤 Desarrollador B: Frontend, Capacidades Offline y Desarrollo de Clientes Externos
**Responsabilidades:**
*   **UI/UX:** Diseño responsivo con plantilla atractiva (HTML5, CSS).
*   **Lógica del Navegador (JS):**
    *   Captura de formulario (Nombre, Sector, Nivel escolar, etc.).
    *   Geolocalización (latitud y longitud de cada registro).
    *   Captura de foto codificada en Base64 (Librería `Webcam-easy`).
*   **Modo Offline:**
    *   Uso de Web Storage (LocalStorage/SessionStorage o IndexedDB) para guardar datos y validar sesión sin conexión.
    *   Sincronización mediante Web Workers conectándose al WebSocket.
    *   CRUD Local (modificar o borrar registros antes de enviar).
*   **Mapas:** Integración de Google Maps API o Leaflet.
*   **Clientes:** Cliente elaborado (Desktop o Móvil, no consola) para consumir APIs REST y gRPC.

---

## 2. Modelos de Datos (Contratos Base)

Ambos desarrolladores deben basarse en las siguientes estructuras para asegurar compatibilidad.

### Entidad: `Usuario`
```json
{
  "id": "String (ObjectId)",
  "username": "String",
  "password": "String",
  "nombre": "String",
  "rol": "String"
}
```

### Entidad: `Formulario` (Encuesta)
```json
{
  "id": "String",
  "nombre": "String",
  "sector": "String",
  "nivelEscolar": "String (Basico, Medio, Grado Universitario, Postgrado, Doctorado)",
  "usuarioRegistro": "String",
  "latitud": "Number",
  "longitud": "Number",
  "fotoBase64": "String",
  "fechaRegistro": "String (ISO 8601)"
}
```

---

## 3. Contratos de APIs y Servicios

**A. API REST:**
*   `POST /api/auth/login` : Retorna JWT.
*   `POST /api/formularios` : Recibe JSON del Formulario (Protegido con JWT).
*   `GET /api/formularios/usuario/{username}` : Lista formularios por usuario.

**B. WebSockets (Sincronización):**
*   `ws://[dominio]/sync` : Endpoint para envío masivo de formularios desde el Web Worker al recuperar conexión.

**C. Definición gRPC (`encuesta.proto`):**
```protobuf
syntax = "proto3";

message FormularioRequest {
  string nombre = 1;
  string sector = 2;
  string nivel_escolar = 3;
  string usuario_registro = 4;
  double latitud = 5;
  double longitud = 6;
  string foto_base64 = 7;
}

message FormularioResponse {
  bool exito = 1;
  string mensaje = 2;
}

message ListaFormulariosResponse {
  repeated FormularioRequest formularios = 1;
}

message UsuarioRequest {
  string username = 1;
}

service EncuestaService {
  rpc CrearFormulario (FormularioRequest) returns (FormularioResponse);
  rpc ListarFormulariosPorUsuario (UsuarioRequest) returns (ListaFormulariosResponse);
}
```
