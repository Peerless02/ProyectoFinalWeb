/**
 * Web Worker para sincronización de formularios vía WebSocket
 * Se ejecuta en background sin bloquear la UI
 */

self.onmessage = function (event) {
  var data = event.data;
  var token = data.token;
  var formularios = data.formularios;
  var wsUrl = data.wsUrl || 'ws://localhost:8080/sync';

  syncFormularios(token, formularios, wsUrl, function (success, result) {
    // Enviar resultado de vuelta al hilo principal
    self.postMessage({
      success: success,
      message: result
    });
  });
};

function syncFormularios(token, formularios, wsUrl, callback) {
  var ws;

  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    console.error('Error en Worker: no se pudo conectar a WebSocket:', err);
    callback(false, 'No se pudo conectar al servidor de sincronización.');
    return;
  }

  ws.onopen = function () {
    console.log('Worker: conectado al WebSocket');
    
    // Enviar los formularios al servidor
    var message = {
      token: token,
      action: 'sync',
      formularios: formularios
    };
    
    try {
      ws.send(JSON.stringify(message));
    } catch (err) {
      console.error('Worker: error al enviar al WebSocket:', err);
      callback(false, 'Error al enviar formularios.');
      ws.close();
    }
  };

  ws.onmessage = function (event) {
    console.log('Worker: mensaje recibido:', event.data);
    try {
      var response = JSON.parse(event.data);
      
      if (response.success) {
        console.log('Worker: sincronización exitosa');
        callback(true, response.message || 'Sincronización completada');
      } else {
        console.log('Worker: error en respuesta del servidor');
        callback(false, response.message || 'Error en la sincronización');
      }
    } catch (err) {
      console.error('Worker: error al procesar respuesta:', err);
      callback(false, 'Error al procesar respuesta del servidor');
    } finally {
      ws.close();
    }
  };

  ws.onerror = function (err) {
    console.error('Worker: error en WebSocket:', err);
    callback(false, 'Error de conexión con el servidor');
  };

  ws.onclose = function () {
    console.log('Worker: conexión cerrada');
  };

  // Timeout de 15 segundos
  setTimeout(function () {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('Worker: timeout, cerrando conexión');
      ws.close();
      callback(false, 'Tiempo de espera agotado');
    }
  }, 15000);
}
