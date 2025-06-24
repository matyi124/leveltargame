// script.js
console.log('📝 script.js betöltve');

let startButton;

class HangszerSablon {
  constructor(name, elementId) {
    this.name    = name;
    this.element = document.getElementById(elementId);
    if (!this.element) {
      console.error(`❌ Hiányzó kép sablonhoz: id="${elementId}"`);
    }
  }
  beolvasottMatrix() {
    const el = this.element;
    if (!el.complete) {
      throw new Error(`Kép nem töltődött be: ${el.id}`);
    }
    let mat = cv.imread(el);
    cv.cvtColor(mat, mat, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(mat, mat, new cv.Size(5,5), 0);
    return mat;
  }
}

// Globális változók
let video, canvas, context, result, wait;
const sablonok = [
  new HangszerSablon("Citera Kicsi",   "templateCiterakicsi"),
  new HangszerSablon("Citera Kicsi1",  "templateCiterakicsi1"),
  new HangszerSablon("Citera Kicsi2",  "templateCiterakicsi2"),
  new HangszerSablon("Citera Nagy",    "templateCiteranagy"),
  new HangszerSablon("Citera Nagy1",   "templateCiteranagy1"),
  new HangszerSablon("Citera Nagy2",   "templateCiteranagy2"),
  new HangszerSablon("Citera Nagy3",   "templateCiteranagy3"),
  new HangszerSablon("Citera Nagy4",   "templateCiteranagy4"),
  new HangszerSablon("Gitár",          "templateGitar"),
  new HangszerSablon("Harmonika",      "templateHarmonika"),
  new HangszerSablon("Harmonika1",     "templateHarmonika1"),
  new HangszerSablon("Harmonika2",     "templateHarmonika2"),
  new HangszerSablon("Kürt",           "templateKurt"),
  new HangszerSablon("Kürt1",          "templateKurt1"),
  new HangszerSablon("Kürt2",          "templateKurt2"),
];

let streamReady = false;
const THRESHOLD = 0.5;

// Ez a callback jön be, amikor az opencv.js runtime készen áll
cv['onRuntimeInitialized'] = () => {
  console.log('🥳 OpenCV ready');
  setupUI();
  initCamera();
};

function setupUI() {
  console.log('⚙️ setupUI');
  video       = document.getElementById('video');
  canvas      = document.getElementById('canvas');
  context     = canvas.getContext('2d', { willReadFrequently:true });
  result      = document.getElementById('result');
  startButton = document.getElementById('startButton');
  wait        = document.getElementById('wait');

  if (!startButton) {
    console.error('❌ Nincs startButton!');
    return;
  }

  startButton.disabled = true; 
  startButton.addEventListener('click', captureAndMatch);
}

function initCamera() {
  console.log('📸 initCamera');
  startButton.disabled = true;
  navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment' }})
    .then(stream => {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        console.log('▶️ Kamera elindult');
        streamReady = true;
        startButton.disabled = false;
        result.textContent = 'Kamera készen, kattints a gombra!';
      };
    })
    .catch(err => {
      console.error('🚨 Kamera hiba:', err);
      result.textContent = '🚨 Nem sikerült a kamera.';
    });
}

async function captureAndMatch() {
  console.log('🕵️ captureAndMatch invoked, streamReady=', streamReady);
  if (streamReady) {
    startButton.disabled = true;
    result.innerHTML = '<em>⏳ feldolgozás…</em>';
    console.log("feldolgozás");
  }
  if (!streamReady) {
    result.innerHTML = '<em>⏳ Kamera még nem állt készen.</em>';
    startButton.disabled = false;
    return;
  }

await new Promise(resolve => setTimeout(resolve, 0));

  // veszi a képet
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0);

  let src = cv.imread(canvas);
  cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(src, src, new cv.Size(5,5), 0);

  let found = null;
  result.innerHTML = '';  // ürítjük, ha részleteket is kiírnál

  for (let sablon of sablonok) {
    try {
      let tpl = sablon.beolvasottMatrix();
      let dst = new cv.Mat();
      cv.matchTemplate(src, tpl, dst, cv.TM_CCOEFF_NORMED);
      let { maxVal } = cv.minMaxLoc(dst);
      console.log(`💡 ${sablon.name}:`, maxVal.toFixed(3));

      // opcionálisan részletek:
      // result.innerHTML += `${sablon.name}: ${maxVal.toFixed(3)}<br>`;

      if (maxVal > THRESHOLD && !found) {
        found = sablon.name;
      }
      tpl.delete(); dst.delete();
    } catch (err) {
      console.warn(`⚠️ Sablon hiba (${sablon.name}):`, err.message);
    }
  }
  src.delete();

  if (found) {
    result.innerHTML = `<strong>✅ Felismert hangszer: ${found}!</strong>`;
  } else {
    result.innerHTML = `<strong>❌ Nem található hangszer.</strong>`;
  }

result.style.display = 'block';
result.scrollIntoView({ behavior: 'smooth' });

  startButton.disabled = false;
  console.log('✅ captureAndMatch done');
}
