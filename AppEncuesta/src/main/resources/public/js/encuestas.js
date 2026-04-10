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

    var createWrap = $('mu-formulario-create');
    if (createWrap) show(createWrap, !!auth);
    var listWrap = $('mu-formulario-list');
    if (listWrap) show(listWrap, !!auth);
  }

  function renderList() {
    var auth = getAuth();
    var tbody = $('formularios-tbody');
    if (!tbody) return;

    if (!auth) {
      tbody.innerHTML = '<tr><td colspan="6">Inicia sesion para ver tus encuestas.</td></tr>';
      return;
    }

    var all = readFormularios();
    var mine = all.filter(function (f) {
      return String(f.usuarioRegistro || '').toLowerCase() === String(auth.username).toLowerCase();
    });

    if (mine.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">No hay encuestas registradas.</td></tr>';
      return;
    }

    mine.sort(function (a, b) {
      var da = new Date(a.fechaRegistro || 0).getTime();
      var db = new Date(b.fechaRegistro || 0).getTime();
      return db - da;
    });

    var out = '';
    for (var i = 0; i < mine.length; i++) {
      var f = mine[i] || {};
      var img = f.fotoBase64 ? ('<img class="mu-form-avatar" src="' + f.fotoBase64 + '" alt="foto">') : '';
      out += '<tr data-id="' + String(f.id || '') + '">'
        + '<td style="white-space:nowrap;">' + String(f.id || '').slice(0, 8) + '</td>'
        + '<td>' + (img ? (img + ' ') : '') + escapeHtml(f.nombre || '') + '</td>'
        + '<td>' + escapeHtml(f.sector || '') + '</td>'
        + '<td>' + escapeHtml(f.nivelEscolar || '') + '</td>'
        + '<td style="white-space:nowrap;">' + escapeHtml((f.latitud != null ? String(f.latitud) : '') + (f.longitud != null ? (', ' + String(f.longitud)) : '')) + '</td>'
        + '<td style="white-space:nowrap;">'
        + '<button type="button" class="btn btn-xs btn-danger mu-form-del">Eliminar</button>'
        + '</td>'
        + '</tr>';
    }
    tbody.innerHTML = out;
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
    if (window.$ && $('#authModal').modal) {
      $('#authModal').modal('show');
      return;
    }
    // Fallback sin jQuery: mostrar el bloque.
    var modal = $('authModal');
    if (modal) modal.style.display = 'block';
  }

  function hideLoginModal() {
    if (window.$ && $('#authModal').modal) {
      $('#authModal').modal('hide');
      return;
    }
    var modal = $('authModal');
    if (modal) modal.style.display = 'none';
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
            renderAuth();
            renderList();
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

