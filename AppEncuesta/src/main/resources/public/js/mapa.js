(function () {
  'use strict';

  var LS_AUTH = 'appencuesta.auth';
  var map = null;
  var markers = [];

  function getToken() {
    try {
      var raw = localStorage.getItem(LS_AUTH);
      if (!raw) return null;
      var a = JSON.parse(raw);
      return (a && a.token) ? a.token : null;
    } catch (e) {
      return null;
    }
  }

  function parseJwt(token) {
    try {
      var parts = String(token).split('.');
      if (parts.length < 2) return null;
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder('utf-8').decode(bytes));
    } catch (e) {
      return null;
    }
  }

  function getAuth() {
    var token = getToken();
    if (!token) return null;
    var payload = parseJwt(token);
    if (!payload || !payload.sub) return null;
    var now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp <= now) return null;
    return { token: token, username: payload.sub, rol: payload.rol || null };
  }

  function setStatus(msg, isError) {
    var el = document.getElementById('mapa-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'alert ' + (isError ? 'alert-danger' : 'alert-info');
    el.style.display = msg ? '' : 'none';
  }

  function clearMarkers() {
    for (var i = 0; i < markers.length; i++) {
      map.removeLayer(markers[i]);
    }
    markers = [];
  }

  function nivelLabel(nivel) {
    var labels = {
      BASICO: 'Basico',
      MEDIO: 'Medio',
      GRADO_UNIVERSITARIO: 'Grado universitario',
      POSTGRADO: 'Postgrado',
      DOCTORADO: 'Doctorado'
    };
    return labels[nivel] || nivel || '';
  }

  function renderMarkers(formularios) {
    clearMarkers();

    var conCoords = formularios.filter(function (f) {
      return f.latitud != null && f.longitud != null;
    });

    document.getElementById('mapa-count').textContent =
      conCoords.length + ' registro' + (conCoords.length !== 1 ? 's' : '') + ' con coordenadas';

    if (conCoords.length === 0) {
      setStatus('No hay encuestas con coordenadas para mostrar.', false);
      return;
    }

    setStatus('', false);

    var bounds = [];
    for (var i = 0; i < conCoords.length; i++) {
      var f = conCoords[i];
      var lat = parseFloat(f.latitud);
      var lng = parseFloat(f.longitud);
      if (!isFinite(lat) || !isFinite(lng)) continue;

      var popupHtml =
        '<div style="min-width:180px">' +
        (f.fotoBase64 ? '<img src="' + f.fotoBase64 + '" style="width:100%;max-height:120px;object-fit:cover;border-radius:4px;margin-bottom:6px">' : '') +
        '<strong>' + escHtml(f.nombre || '') + '</strong><br>' +
        '<span class="text-muted">Sector:</span> ' + escHtml(f.sector || '') + '<br>' +
        '<span class="text-muted">Nivel:</span> ' + escHtml(nivelLabel(f.nivelEscolar)) + '<br>' +
        '<span class="text-muted">Encuestador:</span> ' + escHtml(f.usuarioRegistro || '') + '<br>' +
        '<span class="text-muted">Coords:</span> ' + lat.toFixed(5) + ', ' + lng.toFixed(5) +
        '</div>';

      var marker = L.marker([lat, lng]).bindPopup(popupHtml);
      marker.addTo(map);
      markers.push(marker);
      bounds.push([lat, lng]);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function loadFormularios() {
    var auth = getAuth();
    if (!auth) {
      setStatus('Inicia sesion para ver el mapa.', true);
      return;
    }

    setStatus('Cargando encuestas...', false);

    fetch('/api/formularios/mapa', {
      headers: { 'Authorization': 'Bearer ' + auth.token }
    })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) {
          setStatus('Sesion expirada. Inicia sesion nuevamente.', true);
          return null;
        }
        if (!r.ok) {
          setStatus('Error al cargar encuestas (' + r.status + ').', true);
          return null;
        }
        return r.json();
      })
      .then(function (data) {
        if (!data) return;
        renderMarkers(data);
      })
      .catch(function () {
        setStatus('No se pudo conectar al servidor.', true);
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    map = L.map('leaflet-map').setView([18.4861, -69.9312], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    var auth = getAuth();
    var authBtn = document.getElementById('auth-button');
    if (authBtn) authBtn.textContent = auth ? 'Log out' : 'Log in';

    var badge = document.getElementById('auth-badge');
    if (badge) {
      badge.style.display = auth ? '' : 'none';
      if (auth) badge.textContent = auth.username + (auth.rol ? ' (' + auth.rol + ')' : '');
    }

    var reloadBtn = document.getElementById('mapa-reload');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', loadFormularios);
    }

    loadFormularios();
  });
})();
