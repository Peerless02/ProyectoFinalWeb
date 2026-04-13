/* sync-worker.js — Web Worker para sincronizacion offline→online */
/* Recibe: { type: 'SYNC', formularios: [...], token: '...', wsUrl: '...' } */
/* Envia:  { type: 'SYNC_RESULT', result: {...} } | { type: 'SYNC_ERROR', message: '...' } */

(function () {
  'use strict';

  var messageReceived = false;
  var syncTimeout = null;

  self.onmessage = function (e) {
    var data = e.data;
    if (!data || data.type !== 'SYNC') return;

    var formularios = data.formularios;
    var token = data.token;
    var wsUrl = data.wsUrl;

    if (!formularios || !formularios.length || !token || !wsUrl) {
      self.postMessage({ type: 'SYNC_ERROR', message: 'Parametros insuficientes para sincronizar.' });
      return;
    }

    var url = wsUrl + '?token=' + encodeURIComponent(token);
    var ws;

    try {
      ws = new WebSocket(url);
    } catch (err) {
      self.postMessage({ type: 'SYNC_ERROR', message: 'No se pudo abrir WebSocket: ' + String(err) });
      return;
    }

    messageReceived = false;

    syncTimeout = setTimeout(function () {
      if (!messageReceived) {
        self.postMessage({ type: 'SYNC_ERROR', message: 'Timeout: el servidor no respondio en 10 segundos.' });
        try { ws.close(); } catch (ignore) {}
      }
    }, 10000);

    ws.onopen = function () {
      try {
        ws.send(JSON.stringify(formularios));
      } catch (err) {
        clearTimeout(syncTimeout);
        self.postMessage({ type: 'SYNC_ERROR', message: 'Error al enviar datos: ' + String(err) });
        try { ws.close(); } catch (ignore) {}
      }
    };

    ws.onmessage = function (event) {
      messageReceived = true;
      clearTimeout(syncTimeout);

      var result;
      try {
        result = JSON.parse(event.data);
      } catch (err) {
        self.postMessage({ type: 'SYNC_ERROR', message: 'Respuesta del servidor no es JSON valido.' });
        ws.close();
        return;
      }

      self.postMessage({ type: 'SYNC_RESULT', result: result });
      ws.close();
    };

    ws.onerror = function () {
      if (!messageReceived) {
        clearTimeout(syncTimeout);
        self.postMessage({ type: 'SYNC_ERROR', message: 'Error de conexion WebSocket.' });
      }
    };

    ws.onclose = function (event) {
      if (!messageReceived) {
        clearTimeout(syncTimeout);
        var reason = event.reason ? (' Razon: ' + event.reason) : '';
        self.postMessage({
          type: 'SYNC_ERROR',
          message: 'Conexion cerrada antes de recibir respuesta (code ' + event.code + ').' + reason
        });
      }
    };
  };
})();
