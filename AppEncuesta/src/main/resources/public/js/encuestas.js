/* global Formulario */

(function () {
  'use strict';

  var LS_AUTH = 'appencuesta.auth';
  var LS_FORMULARIOS = 'appencuesta.formularios';

  function $(id) {
    return document.getElementById(id);
  }

  function b64UrlDecode(s) {
    // base64url -> base64
    var b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    // atob expects Latin1; JWT payload is typically UTF-8 JSON.
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // Decode UTF-8 safely
    try {
      return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      // Fallback: best-effort Latin1
      return bin;
    }
  }

  function parseJwt(token) {
    try {
      var parts = String(token).split('.');
      if (parts.length < 2) return null;
      return JSON.parse(b64UrlDecode(parts[1]));
    } catch (e) {
      return null;
    }
  }

  function nowSeconds() {
    return Math.floor(Date.now() / 1000);
  }

  function getAuth() {
    try {
      var raw = localStorage.getItem(LS_AUTH);
      if (!raw) return null;
      var a = JSON.parse(raw);
      if (!a || !a.token) return null;
      var payload = parseJwt(a.token);
      if (!payload || !payload.sub) return null;
      if (payload.exp && payload.exp <= nowSeconds()) return null;
      return {
        token: a.token,
        username: payload.sub,
        rol: payload.rol || payload.role || null,
        exp: payload.exp || null
      };
    } catch (e) {
      return null;
    }
  }

  function setAuth(token) {
    localStorage.setItem(LS_AUTH, JSON.stringify({ token: token }));
  }

  function clearAuth() {
    localStorage.removeItem(LS_AUTH);
  }

  function readFormularios() {
    try {
      var raw = localStorage.getItem(LS_FORMULARIOS);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeFormularios(arr) {
    localStorage.setItem(LS_FORMULARIOS, JSON.stringify(arr || []));
  }

  function show(el, on) {
    if (!el) return;
    el.style.display = on ? '' : 'none';
  }

  function setText(el, txt) {
    if (!el) return;
    el.textContent = txt == null ? '' : String(txt);
  }

  function uuidFallback() {
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function makeFormulario(data) {
    // Prefer usar la clase Formulario si existe (models.js), para reflejar el backend.
    if (typeof Formulario === 'function') {
      return new Formulario(
        data.id || null,
        data.nombre,
        data.sector,
        data.nivelEscolar,
        data.usuarioRegistro,
        data.latitud,
        data.longitud,
        data.fotoBase64 || ''
      );
    }
    return {
      id: data.id || uuidFallback(),
      nombre: data.nombre,
      sector: data.sector,
      nivelEscolar: data.nivelEscolar,
      usuarioRegistro: data.usuarioRegistro,
      latitud: data.latitud,
      longitud: data.longitud,
      fotoBase64: data.fotoBase64 || '',
      fechaRegistro: new Date().toISOString(),
      sincronizado: false
    };
  }

  function renderAuth() {
    var auth = getAuth();
    var btn = $('auth-button');
    var badge = $('auth-badge');
    if (btn) btn.textContent = auth ? 'Log out' : 'Log in';
    if (badge) {
      show(badge, !!auth);
      if (auth) setText(badge, auth.username + (auth.rol ? (' (' + auth.rol + ')') : ''));
    }

    var gate = $('auth-gate');
    if (gate) show(gate, !auth);

    var formularioForm = $('formulario-form');
    if (formularioForm) show(formularioForm, !!auth);

    var createWrap = $('mu-formulario-create');
    if (createWrap) show(createWrap, true);
    var listWrap = $('mu-formulario-list');
    if (listWrap) show(listWrap, true);
  }

  function renderList() {
    var auth = getAuth();
    var tbody = $('formularios-tbody');
    if (!tbody) return;

    if (!auth) {
      tbody.innerHTML = '<tr><td colspan="7">Inicia sesion para ver tus encuestas.</td></tr>';
      return;
    }

    // Cargar formularios locales del usuario
    var all = readFormularios();
    var localMine = all.filter(function (f) {
      return String(f.usuarioRegistro || '').toLowerCase() === String(auth.username).toLowerCase();
    });

    // Cargar formularios del servidor y combinar con locales
    loadServerFormularios(auth.username, auth.token, function (serverFormularios) {
      // Combinar: formularios del servidor + formularios locales pendientes
      var combined = [];

      // Agregar formularios del servidor (marcar como sincronizados)
      if (serverFormularios && serverFormularios.length > 0) {
        for (var i = 0; i < serverFormularios.length; i++) {
          var sf = serverFormularios[i];
          sf.fromServer = true;
          sf.sincronizado = true;
          combined.push(sf);
        }
      }

      // Agregar formularios locales pendientes (no sincronizados)
      for (var j = 0; j < localMine.length; j++) {
        var lf = localMine[j];
        if (!lf.sincronizado) {
          lf.fromServer = false;
          combined.push(lf);
        }
      }

      if (combined.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No hay encuestas registradas.</td></tr>';
        return;
      }

      // Ordenar por fecha (las del servidor sin fecha van al final)
      combined.sort(function (a, b) {
        var da = new Date(a.fechaRegistro || 0).getTime();
        var db = new Date(b.fechaRegistro || 0).getTime();
        return db - da;
      });

      var out = '';
      for (var k = 0; k < combined.length; k++) {
        var f = combined[k] || {};
        var img = f.fotoBase64 ? ('<img class="mu-form-avatar" src="' + f.fotoBase64 + '" alt="foto">') : '';
        
        // Estado: verde si sincronizado, amarillo si pendiente
        var estadoBadge = f.sincronizado 
          ? '<span class="label label-success">Sincronizado</span>'
          : '<span class="label label-warning">Pendiente</span>';
        
        // Solo permitir eliminar si es local pendiente
        var delBtn = !f.sincronizado
          ? '<button type="button" class="btn btn-xs btn-danger mu-form-del">Eliminar</button>'
          : '<button type="button" class="btn btn-xs btn-default" disabled>No editar</button>';

        out += '<tr data-id="' + String(f.id || '') + '" data-synced="' + (f.sincronizado ? 'true' : 'false') + '">'
          + '<td style="white-space:nowrap;">' + String(f.id || '').slice(0, 8) + '</td>'
          + '<td>' + (img ? (img + ' ') : '') + escapeHtml(f.nombre || '') + '</td>'
          + '<td>' + escapeHtml(f.sector || '') + '</td>'
          + '<td>' + escapeHtml(f.nivelEscolar || '') + '</td>'
          + '<td style="white-space:nowrap;">' + escapeHtml((f.latitud != null ? String(f.latitud) : '') + (f.longitud != null ? (', ' + String(f.longitud)) : '')) + '</td>'
          + '<td style="white-space:nowrap;" style="text-align:center;">' + estadoBadge + '</td>'
          + '<td style="white-space:nowrap;">'
          + delBtn
          + '</td>'
          + '</tr>';
      }
      tbody.innerHTML = out;

      // Mostrar/ocultar botón "Sincronizar pendientes" según hay formularios pendientes
      var syncBtn = $('formularios-sync');
      if (syncBtn) {
        var hasPending = localMine.filter(function (f) { return !f.sincronizado; }).length > 0;
        show(syncBtn, hasPending);
      }
    });
  }

  function loadServerFormularios(username, token, callback) {
    // Cargar formularios del servidor
    fetch('/api/formularios/usuario/' + encodeURIComponent(username), {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    }).then(function (r) {
      if (!r.ok) {
        // Si falla, simplemente continuar con locales
        console.warn('Error cargando formularios del servidor:', r.status);
        callback([]);
        return;
      }
      return r.json();
    }).then(function (data) {
      callback(Array.isArray(data) ? data : []);
    }).catch(function (err) {
      console.error('Error en loadServerFormularios:', err);
      callback([]);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showLoginModal() {
    var m = document.getElementById('authModal');
    if (!m) return;
    // Limpiar error anterior
    setLoginError('');
    try {
      if (window.jQuery && window.jQuery.fn && window.jQuery.fn.modal) {
        window.jQuery('#authModal').modal('show');
      } else {
        // Fallback manual Bootstrap 3: agregar clases y backdrop
        m.style.display = 'block';
        m.classList.add('in');
        document.body.classList.add('modal-open');
        var bd = document.createElement('div');
        bd.className = 'modal-backdrop fade in';
        bd.id = 'authModalBackdrop';
        document.body.appendChild(bd);
      }
    } catch (e) {
      m.style.display = 'block';
    }
  }

  function hideLoginModal() {
    var m = document.getElementById('authModal');
    if (!m) return;
    try {
      if (window.jQuery && window.jQuery.fn && window.jQuery.fn.modal) {
        window.jQuery('#authModal').modal('hide');
      } else {
        m.style.display = 'none';
        m.classList.remove('in');
        document.body.classList.remove('modal-open');
        var bd = document.getElementById('authModalBackdrop');
        if (bd) bd.remove();
      }
    } catch (e) {
      m.style.display = 'none';
    }
  }

  function setLoginError(msg) {
    var el = $('auth-error');
    if (!el) return;
    setText(el, msg || '');
    show(el, !!msg);
  }

  function login(username, password) {
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) {
        var msg = (d && d.error) ? d.error : ('No se pudo iniciar sesion. (' + r.status + ')');
        throw new Error(msg);
      });
      return r.json();
    }).then(function (data) {
      if (!data || !data.token) throw new Error('Respuesta invalida del servidor.');
      setAuth(data.token);
    });
  }

  function wireAuth() {
    var authBtn = $('auth-button');
    var loginForm = $('login-form');

    if (authBtn) {
      authBtn.addEventListener('click', function () {
        var auth = getAuth();
        if (auth) {
          clearAuth();
          renderAuth();
          renderList();
          return;
        }
        setLoginError('');
        showLoginModal();
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        setLoginError('');
        var u = $('login-username');
        var p = $('login-password');
        var username = u ? u.value.trim() : '';
        var password = p ? p.value : '';
        if (!username || !password) {
          setLoginError('Completa usuario y contrasena.');
          return;
        }
        var btn = $('login-submit');
        if (btn) btn.disabled = true;
        login(username, password)
          .then(function () {
            hideLoginModal();
            window.location.reload();
          })
          .catch(function (err) {
            setLoginError(err && err.message ? err.message : 'No se pudo iniciar sesion.');
          })
          .finally(function () {
            if (btn) btn.disabled = false;
          });
      });
    }
  }

  function wireCreate() {
    var form = $('formulario-form');
    if (!form) return;

    var photoInput = $('form-foto');
    var photoPreview = $('form-foto-preview');
    var photoBase64 = $('form-foto-base64');
    var geoBtn = $('form-geo-btn');

    if (photoInput) {
      photoInput.addEventListener('change', function () {
        setText($('form-photo-msg'), '');
        if (!photoInput.files || photoInput.files.length === 0) {
          if (photoBase64) photoBase64.value = '';
          if (photoPreview) show(photoPreview, false);
          return;
        }
        var file = photoInput.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          setText($('form-photo-msg'), 'La foto supera 2MB. Usa una imagen mas pequena.');
          if (photoBase64) photoBase64.value = '';
          if (photoPreview) show(photoPreview, false);
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var result = reader.result;
          if (typeof result !== 'string') return;
          if (photoBase64) photoBase64.value = result;
          if (photoPreview) {
            photoPreview.src = result;
            show(photoPreview, true);
          }
        };
        reader.readAsDataURL(file);
      });
    }

    if (geoBtn) {
      geoBtn.addEventListener('click', function () {
        var latEl = $('form-latitud');
        var lngEl = $('form-longitud');
        var msgEl = $('form-geo-msg');
        setText(msgEl, '');
        if (!navigator.geolocation) {
          setText(msgEl, 'Geolocalizacion no disponible en este navegador.');
          return;
        }
        geoBtn.disabled = true;
        navigator.geolocation.getCurrentPosition(function (pos) {
          var lat = pos && pos.coords ? pos.coords.latitude : null;
          var lng = pos && pos.coords ? pos.coords.longitude : null;
          if (latEl) latEl.value = lat != null ? String(lat) : '';
          if (lngEl) lngEl.value = lng != null ? String(lng) : '';
          setText(msgEl, 'Ubicacion capturada.');
        }, function () {
          setText(msgEl, 'No se pudo obtener la ubicacion.');
        }, { enableHighAccuracy: true, timeout: 10000 });
        setTimeout(function () { geoBtn.disabled = false; }, 1200);
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var auth = getAuth();
      if (!auth) {
        showLoginModal();
        return;
      }

      var nombre = ($('form-nombre') && $('form-nombre').value) ? $('form-nombre').value.trim() : '';
      var sector = ($('form-sector') && $('form-sector').value) ? $('form-sector').value.trim() : '';
      var nivel = ($('form-nivel') && $('form-nivel').value) ? $('form-nivel').value : '';
      var lat = ($('form-latitud') && $('form-latitud').value) ? $('form-latitud').value.trim() : '';
      var lng = ($('form-longitud') && $('form-longitud').value) ? $('form-longitud').value.trim() : '';
      var foto = photoBase64 ? (photoBase64.value || '') : '';

      var err = $('form-error');
      setText(err, '');
      show(err, false);

      if (!nombre || !sector || !nivel) {
        setText(err, 'Completa nombre, sector y nivel escolar.');
        show(err, true);
        return;
      }

      var latNum = lat !== '' ? Number(lat) : null;
      var lngNum = lng !== '' ? Number(lng) : null;
      if (lat !== '' && !isFinite(latNum)) {
        setText(err, 'Latitud invalida.');
        show(err, true);
        return;
      }
      if (lng !== '' && !isFinite(lngNum)) {
        setText(err, 'Longitud invalida.');
        show(err, true);
        return;
      }

      var f = makeFormulario({
        nombre: nombre,
        sector: sector,
        nivelEscolar: nivel,
        usuarioRegistro: auth.username,
        latitud: latNum,
        longitud: lngNum,
        fotoBase64: foto
      });

      var list = readFormularios();
      list.push(f);
      writeFormularios(list);

      var ok = $('form-success');
      setText(ok, 'Encuesta registrada localmente.');
      show(ok, true);
      setTimeout(function () { show(ok, false); }, 2500);

      form.reset();
      if (photoPreview) show(photoPreview, false);
      if (photoBase64) photoBase64.value = '';
      renderList();
    });
  }

  function wireListActions() {
    var tbody = $('formularios-tbody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.classList || !t.classList.contains('mu-form-del')) return;
        
        var tr = t.closest('tr');
        var id = tr ? tr.getAttribute('data-id') : null;
        var synced = tr ? tr.getAttribute('data-synced') : 'false';
        
        // Solo permitir eliminar si es pendiente (no sincronizado)
        if (synced === 'true') {
          alert('No se pueden eliminar encuestas sincronizadas con el servidor.');
          return;
        }
        
        if (!id) return;
        var all = readFormularios();
        var next = all.filter(function (x) { return String(x.id) !== String(id); });
        writeFormularios(next);
        renderList();
      });
    }

    var exportBtn = $('formularios-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var auth = getAuth();
        if (!auth) {
          showLoginModal();
          return;
        }
        var all = readFormularios().filter(function (f) {
          return String(f.usuarioRegistro || '').toLowerCase() === String(auth.username).toLowerCase();
        });
        var blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'encuestas_' + auth.username + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 500);
      });
    }

    var clearBtn = $('formularios-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        var auth = getAuth();
        if (!auth) {
          showLoginModal();
          return;
        }
        var all = readFormularios();
        var mine = all.filter(function (f) {
          return String(f.usuarioRegistro || '').toLowerCase() === String(auth.username).toLowerCase();
        });
        if (mine.length === 0) return;
        if (!confirm('Eliminar todas tus encuestas locales?')) return;
        var rest = all.filter(function (f) {
          return String(f.usuarioRegistro || '').toLowerCase() !== String(auth.username).toLowerCase();
        });
        writeFormularios(rest);
        renderList();
      });
    }

    var syncBtn = $('formularios-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', function () {
        var auth = getAuth();
        if (!auth) {
          showLoginModal();
          return;
        }

        var all = readFormularios();
        var pending = all.filter(function (f) {
          return String(f.usuarioRegistro || '').toLowerCase() === String(auth.username).toLowerCase() &&
                 !f.sincronizado;
        });

        if (pending.length === 0) {
          alert('No hay encuestas pendientes para sincronizar.');
          return;
        }

        // Deshabilitar botón durante la sincronización
        syncBtn.disabled = true;
        setText(syncBtn, '');
        syncBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Sincronizando...';

        // Iniciar sincronización vía WebSocket (sync-worker.js)
        initiateSyncViaWebSocket(auth.token, pending, function (success, result) {
          syncBtn.disabled = false;
          if (success) {
            // Actualizar formularios como sincronizados en localStorage
            for (var i = 0; i < pending.length; i++) {
              pending[i].sincronizado = true;
            }
            writeFormularios(all);
            setText(syncBtn, '');
            syncBtn.innerHTML = '<i class="fa fa-cloud-upload"></i> Sincronizar pendientes';
            renderList();
            alert('Encuestas sincronizadas exitosamente.');
          } else {
            setText(syncBtn, '');
            syncBtn.innerHTML = '<i class="fa fa-cloud-upload"></i> Sincronizar pendientes';
            alert('Error en la sincronización: ' + (result || 'Error desconocido'));
          }
        });
      });
    }
  }

  function initiateSyncViaWebSocket(token, pendingFormularios, callback) {
    // Usar Web Worker para sincronización (no bloquea la UI)
    if (typeof Worker === 'undefined') {
      // Fallback: sincronización directa si no soporta Web Workers
      syncDirectly(token, pendingFormularios, callback);
      return;
    }

    var worker;
    try {
      worker = new Worker('js/sync-worker.js');
    } catch (err) {
      console.warn('No se pudo crear Web Worker, usando sincronización directa:', err);
      syncDirectly(token, pendingFormularios, callback);
      return;
    }

    // Preparar URL del WebSocket
    var wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = wsProtocol + '//' + window.location.host + '/sync';

    // Enviar datos al worker
    worker.postMessage({
      token: token,
      formularios: pendingFormularios,
      wsUrl: wsUrl
    });

    // Recibir respuesta del worker
    worker.onmessage = function (event) {
      var response = event.data;
      worker.terminate();
      callback(response.success, response.message);
    };

    worker.onerror = function (err) {
      console.error('Error en Web Worker:', err);
      worker.terminate();
      callback(false, 'Error en el proceso de sincronización');
    };

    // Timeout de 20 segundos
    setTimeout(function () {
      if (worker) {
        try {
          worker.terminate();
        } catch (e) {}
        callback(false, 'Tiempo de espera agotado');
      }
    }, 20000);
  }

  function syncDirectly(token, pendingFormularios, callback) {
    // Fallback: sincronización directa vía WebSocket sin Web Worker
    var wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = wsProtocol + '//' + window.location.host + '/sync';
    var ws;

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error('Error creando WebSocket:', err);
      callback(false, 'No se pudo conectar al servidor de sincronización.');
      return;
    }

    ws.onopen = function () {
      var message = {
        token: token,
        action: 'sync',
        formularios: pendingFormularios
      };
      ws.send(JSON.stringify(message));
    };

    ws.onmessage = function (event) {
      try {
        var response = JSON.parse(event.data);
        if (response.success) {
          callback(true, response.message);
        } else {
          callback(false, response.message || 'Error en la sincronización');
        }
      } catch (err) {
        callback(false, 'Error al procesar respuesta del servidor');
      } finally {
        ws.close();
      }
    };

    ws.onerror = function (err) {
      console.error('Error en WebSocket:', err);
      callback(false, 'Error de conexión con el servidor');
    };

    // Timeout de 15 segundos
    setTimeout(function () {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
        callback(false, 'Tiempo de espera agotado');
      }
    }, 15000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    // If auth is invalid/expired, drop it.
    if (!getAuth()) clearAuth();

    wireAuth();
    wireCreate();
    wireListActions();
    renderAuth();
    renderList();
  });
})();