/* global Formulario, Webcam */

(function () {
  'use strict';

  var LS_AUTH = 'appencuesta.auth';
  var LS_FORMULARIOS = 'appencuesta.formularios';

  var syncWorker = null;
  var isSyncing = false;

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
    if (listWrap) show(listWrap, !!auth);
    renderSyncBadge();
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
        
        var latNum = (f.latitud != null && f.latitud !== '') ? Number(f.latitud) : NaN;
        var lngNum = (f.longitud != null && f.longitud !== '') ? Number(f.longitud) : NaN;
        var hasCoords = isFinite(latNum) && isFinite(lngNum);

        var mapBtn = hasCoords
          ? '<button type="button" class="btn btn-xs btn-info mu-form-map"><i class="fa fa-map-marker"></i> Visualizar en el mapa</button>'
          : '<button type="button" class="btn btn-xs btn-info mu-form-map" disabled title="Sin coordenadas GPS"><i class="fa fa-map-marker"></i> Visualizar en el mapa</button>';

        var editBtn = '<button type="button" class="btn btn-xs btn-warning mu-form-edit">Editar</button>';
        var delBtn = !f.sincronizado
          ? '<button type="button" class="btn btn-xs btn-danger mu-form-del">Eliminar</button>'
          : '';

        out += '<tr'
          + ' data-id="'     + escapeHtml(String(f.id || '')) + '"'
          + ' data-synced="' + (f.sincronizado ? 'true' : 'false') + '"'
          + ' data-nombre="' + escapeHtml(f.nombre || '') + '"'
          + ' data-sector="' + escapeHtml(f.sector || '') + '"'
          + ' data-nivel="'  + escapeHtml(f.nivelEscolar || '') + '"'
          + ' data-lat="'    + (f.latitud  != null ? String(f.latitud)  : '') + '"'
          + ' data-lng="'    + (f.longitud != null ? String(f.longitud) : '') + '"'
          + '>'
          + '<td style="white-space:nowrap;">' + String(f.id || '').slice(0, 8) + '</td>'
          + '<td>' + (img ? (img + ' ') : '') + escapeHtml(f.nombre || '') + '</td>'
          + '<td>' + escapeHtml(f.sector || '') + '</td>'
          + '<td>' + escapeHtml(f.nivelEscolar || '') + '</td>'
          + '<td style="white-space:nowrap;">' + escapeHtml((f.latitud != null ? String(f.latitud) : '') + (f.longitud != null ? (', ' + String(f.longitud)) : '')) + '</td>'
          + '<td style="white-space:nowrap;" style="text-align:center;">' + estadoBadge + '</td>'
          + '<td style="white-space:nowrap;">'
          + mapBtn + ' ' + editBtn + (delBtn ? (' ' + delBtn) : '')
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

  function getWsUrl() {
    return (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/sync';
  }

  function renderSyncBadge() {
    var badge = $('sync-badge');
    if (!badge) return;
    var auth = getAuth();
    if (!auth) {
      setText(badge, '');
      show(badge, false);
      return;
    }
    var all = readFormularios();
    var pending = all.filter(function (f) {
      return String(f.usuarioRegistro || '').toLowerCase() === String(auth.username).toLowerCase()
        && f.sincronizado === false;
    });
    if (pending.length === 0) {
      setText(badge, '');
      show(badge, false);
    } else {
      setText(badge, String(pending.length) + ' pendiente' + (pending.length === 1 ? '' : 's'));
      show(badge, true);
    }
  }

  function triggerSync() {
    if (!navigator.onLine) return;
    var auth = getAuth();
    if (!auth) return;
    if (!syncWorker) return;
    if (isSyncing) return;

    var all = readFormularios();
    var unsynced = all.filter(function (f) {
      return String(f.usuarioRegistro || '').toLowerCase() === String(auth.username).toLowerCase()
        && f.sincronizado === false;
    });
    if (unsynced.length === 0) return;

    isSyncing = true;
    syncWorker.postMessage({
      type: 'SYNC',
      formularios: unsynced,
      token: auth.token,
      wsUrl: getWsUrl()
    });
  }

  function handleWorkerMessage(e) {
    var data = e.data;
    if (!data) { isSyncing = false; return; }

    if (data.type === 'SYNC_RESULT') {
      var result = data.result || {};
      var ids = result.idsGuardados;
      if (Array.isArray(ids) && ids.length > 0) {
        var savedSet = {};
        for (var i = 0; i < ids.length; i++) {
          savedSet[String(ids[i])] = true;
        }
        var all = readFormularios();
        for (var j = 0; j < all.length; j++) {
          if (savedSet[String(all[j].id)]) {
            all[j].sincronizado = true;
          }
        }
        writeFormularios(all);
        // Marcar como no-sincronizando DESPUÉS de actualizar localStorage
        // para evitar que triggerSync() re-envíe los mismos formularios
        isSyncing = false;
        renderList();
        renderSyncBadge();
      } else {
        isSyncing = false;
      }
    } else if (data.type === 'SYNC_ERROR') {
      isSyncing = false;
      console.warn('[Sync] Error de sincronizacion:', data.message);
    } else {
      isSyncing = false;
    }
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

    var photoPreview = $('form-foto-preview');
    var photoBase64 = $('form-foto-base64');
    var geoBtn = $('form-geo-btn');

    // Webcam-easy integration
    var webcamVideo = $('webcam');
    var webcamCanvas = $('webcam-canvas');
    var webcamStartBtn = $('webcam-start-btn');
    var webcamCaptureBtn = $('webcam-capture-btn');
    var webcamSwitchBtn = $('webcam-switch-btn');
    var webcamRetakeBtn = $('webcam-retake-btn');
    var webcamClearBtn = $('webcam-clear-btn');
    var webcamInstance = null;

    function getWebcam() {
      if (!webcamInstance && webcamVideo && webcamCanvas) {
        webcamInstance = new Webcam(webcamVideo, 'user', webcamCanvas);
      }
      return webcamInstance;
    }

    if (webcamStartBtn) {
      webcamStartBtn.addEventListener('click', function () {
        setText($('form-photo-msg'), '');
        var wc = getWebcam();
        if (!wc) return;
        wc.start()
          .then(function () {
            show(webcamVideo, true);
            show(webcamStartBtn, false);
            show(webcamCaptureBtn, true);
            show(webcamSwitchBtn, true);
          })
          .catch(function (err) {
            setText($('form-photo-msg'), 'No se pudo acceder a la cámara: ' + (err && err.message ? err.message : err));
          });
      });
    }

    if (webcamCaptureBtn) {
      webcamCaptureBtn.addEventListener('click', function () {
        var wc = getWebcam();
        if (!wc) return;
        var picture = wc.snap();
        wc.stop();
        if (photoBase64) photoBase64.value = picture;
        if (photoPreview) {
          photoPreview.src = picture;
          show(photoPreview, true);
        }
        show(webcamVideo, false);
        show(webcamCaptureBtn, false);
        show(webcamSwitchBtn, false);
        show(webcamRetakeBtn, true);
        show(webcamClearBtn, true);
        setText($('form-photo-msg'), '');
      });
    }

    if (webcamSwitchBtn) {
      webcamSwitchBtn.addEventListener('click', function () {
        var wc = getWebcam();
        if (wc) wc.flip();
      });
    }

    if (webcamRetakeBtn) {
      webcamRetakeBtn.addEventListener('click', function () {
        if (photoBase64) photoBase64.value = '';
        show(photoPreview, false);
        show(webcamRetakeBtn, false);
        show(webcamClearBtn, false);
        var wc = getWebcam();
        if (!wc) return;
        wc.start()
          .then(function () {
            show(webcamVideo, true);
            show(webcamCaptureBtn, true);
            show(webcamSwitchBtn, true);
          })
          .catch(function (err) {
            setText($('form-photo-msg'), 'No se pudo acceder a la cámara: ' + (err && err.message ? err.message : err));
            show(webcamStartBtn, true);
          });
      });
    }

    if (webcamClearBtn) {
      webcamClearBtn.addEventListener('click', function () {
        var wc = getWebcam();
        if (wc) wc.stop();
        if (photoBase64) photoBase64.value = '';
        show(photoPreview, false);
        show(webcamRetakeBtn, false);
        show(webcamClearBtn, false);
        show(webcamStartBtn, true);
        setText($('form-photo-msg'), '');
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
        setText(msgEl, 'Obteniendo ubicacion...');
        navigator.geolocation.getCurrentPosition(function (pos) {
          var lat = pos && pos.coords ? pos.coords.latitude : null;
          var lng = pos && pos.coords ? pos.coords.longitude : null;
          if (latEl) latEl.value = lat != null ? String(lat) : '';
          if (lngEl) lngEl.value = lng != null ? String(lng) : '';
          setText(msgEl, 'Ubicacion capturada.');
          geoBtn.disabled = false;
        }, function (err) {
          var reasons = {
            1: 'Permiso denegado. Permite el acceso a la ubicacion en tu navegador.',
            2: 'Ubicacion no disponible. Verifica que el GPS este activo.',
            3: 'Tiempo de espera agotado. Intenta de nuevo.'
          };
          var msg = reasons[err && err.code] || ('Error desconocido: ' + (err && err.message ? err.message : ''));
          setText(msgEl, msg);
          geoBtn.disabled = false;
        }, { enableHighAccuracy: true, timeout: 15000 });
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
      renderSyncBadge();
      if (navigator.onLine) { triggerSync(); }
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
        // Abrir modal para elegir qué encuestas eliminar.
        showClearModal();
        return;

        clearBtn.disabled = true;

        // Eliminar del servidor primero, luego limpiar localStorage
        fetch('/api/formularios/usuario/' + encodeURIComponent(auth.username), {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer ' + auth.token
          }
        }).then(function (r) {
          if (!r.ok) {
            return r.json().catch(function () { return {}; }).then(function (d) {
              throw new Error((d && d.error) ? d.error : 'Error del servidor (' + r.status + ')');
            });
          }
          // Servidor limpiado — ahora limpiar localStorage
          var all = readFormularios();
          var rest = all.filter(function (f) {
            return String(f.usuarioRegistro || '').toLowerCase() !== String(auth.username).toLowerCase();
          });
          writeFormularios(rest);
          renderList();
          renderSyncBadge();
        }).catch(function (err) {
          alert('Error al limpiar encuestas: ' + (err && err.message ? err.message : err));
        }).finally(function () {
          clearBtn.disabled = false;
        });
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
          syncBtn.innerHTML = '<i class="fa fa-cloud-upload"></i> Sincronizar pendientes';
          if (success) {
            // Marcar como sincronizados los IDs confirmados por el servidor
            var savedIds = (result && Array.isArray(result.idsGuardados)) ? result.idsGuardados : [];
            var savedSet = {};
            for (var i = 0; i < savedIds.length; i++) savedSet[String(savedIds[i])] = true;
            for (var j = 0; j < all.length; j++) {
              if (savedSet[String(all[j].id)]) all[j].sincronizado = true;
            }
            writeFormularios(all);
            renderList();
            renderSyncBadge();
            alert('Encuestas sincronizadas exitosamente (' + savedIds.length + ').');
          } else {
            var msg = typeof result === 'string' ? result
              : (result && result.errores ? result.errores + ' error(es) al sincronizar.' : 'Error desconocido');
            alert('Error en la sincronizacion: ' + msg);
          }
        });
      });
    }
  }

  // Modal para elegir que encuestas borrar al usar "Limpiar mis encuestas".
  var _clearModalWired = false;
  var _clearEls = null;

  function wireClearModal() {
    if (_clearModalWired) return;

    var modalEl = $('clearModal');
    var tbody = $('clear-tbody');
    var selectAll = $('clear-select-all');
    var delBtn = $('clear-delete-btn');
    var errBox = $('clear-error');
    var selectedCount = $('clear-selected-count');
    if (!modalEl || !tbody || !selectAll || !delBtn) return;

    _clearModalWired = true;
    _clearEls = {
      modalEl: modalEl,
      tbody: tbody,
      selectAll: selectAll,
      delBtn: delBtn,
      errBox: errBox,
      selectedCount: selectedCount
    };

    function setError(msg) {
      if (!errBox) return;
      setText(errBox, msg || '');
      show(errBox, !!msg);
    }

    function updateSelectedCount() {
      if (!selectedCount) return;
      var checks = tbody.querySelectorAll('input[type="checkbox"].clear-item');
      var n = 0;
      for (var i = 0; i < checks.length; i++) if (checks[i].checked) n++;
      setText(selectedCount, String(n));
    }

    selectAll.addEventListener('change', function () {
      var checks = tbody.querySelectorAll('input[type="checkbox"].clear-item');
      for (var i = 0; i < checks.length; i++) checks[i].checked = !!selectAll.checked;
      updateSelectedCount();
    });

    tbody.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains('clear-item')) return;
      updateSelectedCount();
    });

    delBtn.addEventListener('click', function () {
      var auth = getAuth();
      if (!auth) {
        showLoginModal();
        return;
      }

      setError('');

      var checks = tbody.querySelectorAll('input[type="checkbox"].clear-item');
      var serverIds = [];
      var localIds = [];
      for (var i = 0; i < checks.length; i++) {
        if (!checks[i].checked) continue;
        var tr = checks[i].closest ? checks[i].closest('tr') : null;
        if (!tr) continue;
        var id = tr.getAttribute('data-id') || '';
        var source = tr.getAttribute('data-source') || '';
        if (!id) continue;
        if (source === 'server') serverIds.push(id);
        else if (source === 'local') localIds.push(id);
      }

      if (serverIds.length === 0 && localIds.length === 0) {
        setError('Selecciona al menos una encuesta.');
        return;
      }

      if (!confirm('Eliminar ' + String(serverIds.length + localIds.length) + ' encuesta(s) seleccionada(s)?')) return;

      delBtn.disabled = true;
      delBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Eliminando...';

      function deleteLocalSelected() {
        if (localIds.length === 0) return;
        var kill = {};
        for (var i = 0; i < localIds.length; i++) kill[String(localIds[i])] = true;

        var all = readFormularios();
        var next = all.filter(function (f) {
          var mine = String(f.usuarioRegistro || '').toLowerCase() === String(auth.username).toLowerCase();
          if (!mine) return true;
          return !kill[String(f.id)];
        });
        writeFormularios(next);
      }

      function deleteServerSelected() {
        if (serverIds.length === 0) return Promise.resolve();
        var reqs = serverIds.map(function (id) {
          return fetch('/api/formularios/' + encodeURIComponent(id), {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + auth.token }
          }).then(function (r) {
            if (r.ok) return;
            return r.json().catch(function () { return {}; }).then(function (d) {
              throw new Error((d && d.error) ? d.error : 'Error del servidor (' + r.status + ')');
            });
          });
        });
        return Promise.all(reqs);
      }

      deleteServerSelected().then(function () {
        deleteLocalSelected();
        if (window.jQuery && window.jQuery.fn.modal) window.jQuery('#clearModal').modal('hide');
        renderList();
        renderSyncBadge();
      }).catch(function (err) {
        deleteLocalSelected();
        renderList();
        renderSyncBadge();
        setError('Error eliminando del servidor: ' + (err && err.message ? err.message : err));
      }).finally(function () {
        delBtn.disabled = false;
        delBtn.innerHTML = '<i class="fa fa-trash"></i> Eliminar seleccionadas';
      });
    });

    if (window.jQuery) {
      window.jQuery('#clearModal').on('hidden.bs.modal', function () {
        setError('');
        tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
        selectAll.checked = true;
        updateSelectedCount();
      });
    }
  }

  function showClearModal() {
    wireClearModal();
    if (!_clearEls) return;

    var auth = getAuth();
    if (!auth) {
      showLoginModal();
      return;
    }

    var tbody = _clearEls.tbody;
    var selectAll = _clearEls.selectAll;
    var errBox = _clearEls.errBox;
    var selectedCount = _clearEls.selectedCount;

    if (errBox) show(errBox, false);
    tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
    selectAll.checked = true;
    if (selectedCount) setText(selectedCount, '0');

    function renderRows(items) {
      if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No hay encuestas para limpiar.</td></tr>';
        if (selectedCount) setText(selectedCount, '0');
        return;
      }

      var out = '';
      for (var i = 0; i < items.length; i++) {
        var it = items[i] || {};
        var id = String(it.id || '');
        var nombre = it.nombre || '';
        var estado = it.sincronizado ? 'Sincronizado' : 'Pendiente';
        var estadoCls = it.sincronizado ? 'label-success' : 'label-warning';
        var origen = it.source === 'server' ? 'Servidor' : 'Local';
        var origenCls = it.source === 'server' ? 'label-primary' : 'label-default';

        out += '<tr data-id="' + escapeHtml(id) + '" data-source="' + escapeHtml(it.source || '') + '">'
          + '<td style="text-align:center;"><input class="clear-item" type="checkbox" checked></td>'
          + '<td style="white-space:nowrap;">' + escapeHtml(id.slice(0, 8)) + '</td>'
          + '<td>' + escapeHtml(nombre) + '</td>'
          + '<td style="white-space:nowrap;"><span class="label ' + estadoCls + '">' + estado + '</span></td>'
          + '<td style="white-space:nowrap;"><span class="label ' + origenCls + '">' + origen + '</span></td>'
          + '</tr>';
      }
      tbody.innerHTML = out;
      if (selectedCount) setText(selectedCount, String(items.length));
    }

    function loadItems(done) {
      var all = readFormularios();
      var localMine = all.filter(function (f) {
        return String(f.usuarioRegistro || '').toLowerCase() === String(auth.username).toLowerCase();
      });

      var items = [];
      for (var i = 0; i < localMine.length; i++) {
        var lf = localMine[i] || {};
        items.push({
          id: lf.id,
          nombre: lf.nombre || '',
          sincronizado: !!lf.sincronizado,
          source: 'local'
        });
      }

      loadServerFormularios(auth.username, auth.token, function (serverFormularios) {
        if (serverFormularios && serverFormularios.length) {
          for (var j = 0; j < serverFormularios.length; j++) {
            var sf = serverFormularios[j] || {};
            items.push({
              id: sf.id,
              nombre: sf.nombre || '',
              sincronizado: true,
              source: 'server'
            });
          }
        }

        items.sort(function (a, b) {
          if (a.source !== b.source) return a.source === 'server' ? -1 : 1;
          return String(a.nombre || '').localeCompare(String(b.nombre || ''));
        });
        done(items);
      });
    }

    loadItems(function (items) {
      renderRows(items);
      selectAll.checked = true;
    });

    if (window.jQuery && window.jQuery.fn.modal) {
      window.jQuery('#clearModal').modal('show');
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
      type: 'SYNC',
      token: token,
      formularios: pendingFormularios,
      wsUrl: wsUrl
    });

    // Recibir respuesta del worker
    worker.onmessage = function (event) {
      var response = event.data;
      worker.terminate();
      if (response.type === 'SYNC_RESULT') {
        var ok = response.result && response.result.exito;
        callback(!!ok, response.result);
      } else {
        callback(false, (response && response.message) || 'Error desconocido');
      }
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
    var wsUrl = wsProtocol + '//' + window.location.host + '/sync?token=' + encodeURIComponent(token);
    var ws;

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error('Error creando WebSocket:', err);
      callback(false, 'No se pudo conectar al servidor de sincronización.');
      return;
    }

    ws.onopen = function () {
      // El servidor espera directamente el array de formularios
      ws.send(JSON.stringify(pendingFormularios));
    };

    ws.onmessage = function (event) {
      try {
        var response = JSON.parse(event.data);
        if (response.exito) {
          callback(true, response);
        } else {
          callback(false, response.error || 'Error en la sincronizacion');
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

  function wireEditModal() {
    var tbody   = $('formularios-tbody');
    var form    = $('edit-form');
    if (!tbody || !form) return;

    // Abrir modal al hacer click en Editar
    tbody.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains('mu-form-edit')) return;

      var tr = t.closest('tr');
      if (!tr) return;

      $('edit-id').value     = tr.getAttribute('data-id')     || '';
      $('edit-synced').value = tr.getAttribute('data-synced') || 'false';
      $('edit-nombre').value = tr.getAttribute('data-nombre') || '';
      $('edit-sector').value = tr.getAttribute('data-sector') || '';
      $('edit-nivel').value  = tr.getAttribute('data-nivel')  || '';
      $('edit-latitud').value  = tr.getAttribute('data-lat')  || '';
      $('edit-longitud').value = tr.getAttribute('data-lng')  || '';

      setText($('edit-error'), '');
      show($('edit-error'), false);

      if (window.jQuery && window.jQuery.fn.modal) {
        window.jQuery('#editModal').modal('show');
      }
    });

    // Submit modal
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var id     = $('edit-id').value;
      var synced = $('edit-synced').value === 'true';
      var nombre = $('edit-nombre').value.trim();
      var sector = $('edit-sector').value.trim();
      var nivel  = $('edit-nivel').value;
      var lat    = $('edit-latitud').value.trim();
      var lng    = $('edit-longitud').value.trim();

      if (!nombre || !sector || !nivel) {
        setText($('edit-error'), 'Nombre, sector y nivel son requeridos.');
        show($('edit-error'), true);
        return;
      }

      var latNum = lat !== '' ? Number(lat) : null;
      var lngNum = lng !== '' ? Number(lng) : null;
      if (lat !== '' && !isFinite(latNum)) {
        setText($('edit-error'), 'Latitud invalida.');
        show($('edit-error'), true);
        return;
      }
      if (lng !== '' && !isFinite(lngNum)) {
        setText($('edit-error'), 'Longitud invalida.');
        show($('edit-error'), true);
        return;
      }

      var submitBtn = $('edit-submit');
      if (submitBtn) submitBtn.disabled = true;

      if (synced) {
        // Registro del servidor: llamar PUT
        var auth = getAuth();
        if (!auth) {
          setText($('edit-error'), 'Sesion expirada. Inicia sesion nuevamente.');
          show($('edit-error'), true);
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
        fetch('/api/formularios/' + encodeURIComponent(id), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + auth.token
          },
          body: JSON.stringify({
            nombre: nombre,
            sector: sector,
            nivelEscolar: nivel,
            latitud: latNum,
            longitud: lngNum
          })
        }).then(function (r) {
          if (r.ok) {
            if (window.jQuery && window.jQuery.fn.modal) window.jQuery('#editModal').modal('hide');
            renderList();
          } else {
            return r.json().then(function (d) {
              setText($('edit-error'), (d && d.error) ? d.error : 'Error al actualizar (' + r.status + ').');
              show($('edit-error'), true);
            });
          }
        }).catch(function () {
          setText($('edit-error'), 'No se pudo conectar al servidor.');
          show($('edit-error'), true);
        }).finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
      } else {
        // Registro local pendiente: actualizar localStorage
        var all = readFormularios();
        for (var i = 0; i < all.length; i++) {
          if (String(all[i].id) === String(id)) {
            all[i].nombre      = nombre;
            all[i].sector      = sector;
            all[i].nivelEscolar = nivel;
            all[i].latitud     = latNum;
            all[i].longitud    = lngNum;
            break;
          }
        }
        writeFormularios(all);
        if (window.jQuery && window.jQuery.fn.modal) window.jQuery('#editModal').modal('hide');
        if (submitBtn) submitBtn.disabled = false;
        renderList();
      }
    });
  }

  function wireMapModal() {
    var tbody = $('formularios-tbody');
    if (!tbody) return;

    function isValidLatLng(lat, lng) {
      return isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    }

    tbody.addEventListener('click', function (e) {
      var t = e.target;
      var btn = (t && t.closest) ? t.closest('button') : t;
      if (!btn || !btn.classList || !btn.classList.contains('mu-form-map')) return;

      var tr = btn.closest ? btn.closest('tr') : null;
      if (!tr) return;

      var latS = tr.getAttribute('data-lat') || '';
      var lngS = tr.getAttribute('data-lng') || '';
      var lat = latS !== '' ? Number(latS) : NaN;
      var lng = lngS !== '' ? Number(lngS) : NaN;
      if (!isValidLatLng(lat, lng)) {
        alert('Esta encuesta no tiene coordenadas validas (lat/lng).');
        return;
      }

      var nombre = tr.getAttribute('data-nombre') || 'Encuesta';
      var label = $('mapModalLabel');
      if (label) setText(label, 'Ubicacion: ' + nombre);

      var coordsEl = $('map-coords');
      if (coordsEl) setText(coordsEl, lat.toFixed(6) + ', ' + lng.toFixed(6));

      // Mantener la coma sin encodear mejora compatibilidad con el parsing de Google Maps.
      var q = encodeURIComponent(String(lat)) + ',' + encodeURIComponent(String(lng));
      var embedUrl = 'https://www.google.com/maps?q=' + q + '&z=16&output=embed';
      var openUrl = 'https://www.google.com/maps?q=' + q + '&z=16';

      var openLink = $('map-open-link');
      if (openLink) openLink.href = openUrl;

      var iframe = $('map-iframe');
      if (iframe) iframe.src = embedUrl;

      if (window.jQuery && window.jQuery.fn.modal) {
        window.jQuery('#mapModal').modal('show');
      }
    });

    // Detener carga del iframe al cerrar el modal (y liberar recursos)
    if (window.jQuery) {
      window.jQuery('#mapModal').on('hidden.bs.modal', function () {
        var iframe = $('map-iframe');
        if (iframe) iframe.src = 'about:blank';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // If auth is invalid/expired, drop it.
    if (!getAuth()) clearAuth();

    // Inicializar Web Worker de sincronizacion
    try {
      syncWorker = new Worker('js/sync-worker.js');
      syncWorker.onmessage = handleWorkerMessage;
      syncWorker.onerror = function (err) {
        console.error('[SyncWorker] Error inesperado:', err.message);
        isSyncing = false;
      };
    } catch (e) {
      console.warn('[SyncWorker] No se pudo iniciar el worker de sincronizacion:', e);
    }

    wireAuth();
    wireCreate();
    wireEditModal();
    wireListActions();
    wireClearModal();
    wireMapModal();
    renderAuth();
    renderList();
    renderSyncBadge();

    // Sincronizar al recuperar conexion
    window.addEventListener('online', triggerSync);

    // Intentar sync inicial si ya hay conexion
    triggerSync();
  });
})();
