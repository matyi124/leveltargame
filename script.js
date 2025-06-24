// script.js – ORB verzió

console.log('📝 script.js (ORB) betöltve');

let video, canvas, context, result, startButton;
let streamReady = false;
let orbInited = false;

let orb, bf;

let tplKeypoints = {};    // { name: cv.KeyPointVector }
let tplDescriptors = {};  // { name: cv.Mat }

cv['onRuntimeInitialized'] = () => {
  console.log('🥳 OpenCV ready (ORB)');
  setupUI();
  initCamera();
  initORB();
};

function setupUI() {
  video       = document.getElementById('video');
  canvas      = document.getElementById('canvas');
  context     = canvas.getContext('2d');
  result      = document.getElementById('result');
  startButton = document.getElementById('startButton');

  startButton.disabled = true;
  startButton.addEventListener('click', captureAndMatch);


  const sablonok = Array.from(
  document.querySelectorAll('#templateContainer img')
).map(img => {
  // img.id például 'tmpl_citeraAllo_1'
  const parts = img.id.split('_');        // ['tmpl','citeraAllo','1']
  parts.shift();                          // eltávolítjuk a 'tmpl' prefixet
  const rawName = parts.slice(0, -1).join('_'); // ['citeraAllo']
  // csinálunk belőle emberi nevet: 'citera Allo'
  const name = rawName
    .replace(/([A-Z])/g, ' $1')           // camelCase → szavak közé szóköz
    .replace(/^./, s => s.toUpperCase()); // nagybetű az elején

  return { name, element: img };
})
}

function initCamera() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        streamReady = true;
        startButton.disabled = false;
        result.textContent = '✓ Kamera kész, kattints a gombra.';
      };
    })
    .catch(err => {
      console.error('🚨 Kamera hiba:', err);
      result.textContent = '🚨 Nem sikerült a kamera.';
    });
}

function initORB() {
  console.log('🔧 init ORB + BFMatcher');
  orb = new cv.ORB();
  bf  = new cv.BFMatcher(cv.NORM_HAMMING, false);

  // Előfeldolgozás: minden sablonhoz kiszámoljuk a kp+descriptort
  sablonok.forEach(s => {
    const imgEl = s.element;
    if (!imgEl || !imgEl.complete) {
      console.warn(`⚠️ Sablon nem betöltve: ${s.name}`);
      return;
    }
    let tpl = cv.imread(imgEl);
    cv.cvtColor(tpl, tpl, cv.COLOR_RGBA2GRAY);
    let kp = new cv.KeyPointVector(), desc = new cv.Mat();
    orb.detectAndCompute(tpl, new cv.Mat(), kp, desc);
    tpl.delete();

    tplKeypoints[s.name] = kp;
    tplDescriptors[s.name] = desc;
    console.log(`📦 Sablon előfeldolgozva: ${s.name}, kp=${kp.size()}, desc=${desc.rows}×${desc.cols}`);
  });
}


async function captureAndMatch() {

  if (!streamReady) return;
  if (!orbInited) {
    await ensureORBInit();
    return;  // csak az init ment, most még ne csináljunk felismerést
  }

  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  result.innerHTML = '<em>⏳ Feldolgozás…</em>';

  // 2) frame előkészítés
  let src = cv.imread(canvas);
  cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);

  // 3) frame kp+desc
  let kpSrc = new cv.KeyPointVector(), descSrc = new cv.Mat();
  orb.detectAndCompute(src, new cv.Mat(), kpSrc, descSrc);

  // 4) minden sablonnal match
  let best = { name:null, matches:0 };
  sablonok.forEach(s => {
    const name = s.name;
    const descTpl = tplDescriptors[name];
    if (!descTpl || descTpl.empty() || descSrc.empty()) return;

    // KNN‐match, ratio‐test
    let matches = new cv.DMatchVectorVector();
    bf.knnMatch(descTpl, descSrc, matches, 2);

    let good = 0;
    for (let i = 0; i < matches.size(); i++) {
      const m = matches.get(i).get(0);
      const n = matches.get(i).get(1);
      if (m.distance < 0.75 * n.distance) good++;
    }

    console.log(`🔍 ${name}: good matches =`, good);
    if (good > best.matches) {
      best = { name, matches: good };
    }

    matches.delete();
  });

  // 5) eredmény kiírás
  if (best.name) {
    result.innerHTML = `✅ Felismert hangszer: <b>${best.name}</b> (${best.matches} match)`;
  } else {
    result.innerHTML = `❌ Nem található hangszer.`;
  }

  // 6) tisztítás
  src.delete();
  kpSrc.delete();
  descSrc.delete();
}

