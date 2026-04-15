/**
 * Modelos base de JavaScript para el Frontend.
 * Estos objetos reflejan las clases del Backend para trabajar de forma homologada.
 */

class Usuario {
  constructor(id, username, password, nombre, rol) {
    this.id = id;
    this.username = username;
    this.password = password;
    this.nombre = nombre;
    this.rol = rol;
  }
}

class Formulario {
  constructor(id, nombre, sector, nivelEscolar, usuarioRegistro, latitud, longitud, fotoBase64) {
    this.id =
      id ||
      ((typeof crypto !== 'undefined' && crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : ('id-' + Date.now() + '-' + Math.random().toString(16).slice(2))); // ID temporal para modo offline

    this.nombre = nombre;
    this.sector = sector;
    this.nivelEscolar = nivelEscolar;
    this.usuarioRegistro = usuarioRegistro;
    this.latitud = latitud;
    this.longitud = longitud;
    this.fotoBase64 = fotoBase64;
    this.fechaRegistro = new Date().toISOString();
    this.camposExtra = null;

    // Atributo interno del frontend para saber si ya se sincronizo
    this.sincronizado = false;
  }
}

// Exportar para que otros scripts (modulos ES6) puedan usarlo si es necesario
// export { Usuario, Formulario };

