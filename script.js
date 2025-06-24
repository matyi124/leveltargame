// script.js – ORB verzió (Lazy init + progress + tuning)

console.log('📝 script.js (ORB) betöltve');

let video, canvas, context, result, startButton;
let streamReady = false;

// ORB és BFMatcher global
let orb, bf;

// sablonok referencia
let sablonok = [];

// ORB init státusz + progress
let orbInited = false;

cv['onRuntimeInitialized'] = () => {
  console.log('🥳 OpenCV ready (ORB)');
  setupUI();
  initCamera();
};

function setupUI() {
  video       = document.getElementById('video');
  canvas      = document.getElementById('canvas');
  context     = canvas.getContext('2d');
  result      = document.getElementById('result');
  startButton = document.getElementById('startButton');

  startButton.disabled = true;
  startButton.addEventListener('click', captureAndMatch);

  // sablonok feltöltése
  sablonok = Array.from(
    document.querySelectorAll('#templateContainer img')
  ).map(img => {
    const parts = img.id.split('_'); // ['tmpl','RootName','i']
    parts.shift();
    const raw = parts.slice(0,-1).join('_');
    const name = raw.replace(/([A-Z])/g,' $1').replace(/^./, c=>c.toUpperCase());
    return { name, element: img };
  });
}

function initCamera() {
  navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' }})
    .then(stream=>{
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play(); streamReady = true;
        startButton.disabled = false;
        result.textContent = '✓ Kamera kész, kattints a gombra.';
      };
    })
    .catch(err=>{
      console.error('🚨 Kamera hiba:', err);
      result.textContent = '🚨 Nem sikerült a kamera.';
    });
}

async function ensureORBInit() {
  if (orbInited) return;
  // mutatunk progress elemet
  const bar = document.getElementById('initProgress');
  bar.max = sablonok.length;
  result.innerHTML = '<em>⏳ Template-adatbázis építése…</em>';
  await new Promise(r=>setTimeout(r,0));

  orb = new cv.ORB(300 /*nFeatures*/,1.2,8,31,0,2,cv.ORB_HARRIS_SCORE,31,20);
  bf  = new cv.BFMatcher(cv.NORM_HAMMING, false);

  let i = 0;
  for (const s of sablonok) {
    const imgEl = s.element;
    let tpl = cv.imread(imgEl);
    cv.cvtColor(tpl, tpl, cv.COLOR_RGBA2GRAY);
    let kp = new cv.KeyPointVector(), desc = new cv.Mat();
    orb.detectAndCompute(tpl, new cv.Mat(), kp, desc);
    tpl.delete();
    tplKeypoints[s.name] = kp;
    tplDescriptors[s.name] = desc;
    bar.value = ++i;
  }
  orbInited = true;
  result.textContent = '✅ Template DB kész, kattints a gombra.';
  startButton.disabled = false;
}

async function captureAndMatch() {
  if (!streamReady) return;
  startButton.disabled = true;

  if (!orbInited) {
    await ensureORBInit();
    return;
  }

  // előkészítés
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video,0,0);
  result.innerHTML = '<em>⏳ Feldolgozás…</em>';

  let src = cv.imread(canvas);
  cv.cvtColor(src,src,cv.COLOR_RGBA2GRAY);

  let kpSrc = new cv.KeyPointVector(), descSrc = new cv.Mat();
  orb.detectAndCompute(src, new cv.Mat(), kpSrc, descSrc);

  let best = { name:null, score:0 };
  for (const s of sablonok) {
    const descTpl = tplDescriptors[s.name];
    if (!descTpl || descSrc.empty()) continue;
    let matches = new cv.DMatchVectorVector();
    bf.knnMatch(descTpl, descSrc, matches, 2);
    let good = 0;
    for (let i=0;i<matches.size();i++){
      const m = matches.get(i).get(0), n = matches.get(i).get(1);
      if (m.distance < 0.7 * n.distance) good++;
    }
    const ratio = good/descTpl.rows;
    if (good>5 && ratio>0.1 && good>best.score) {
      best = { name:s.name, score:good };
    }
    matches.delete();
  }

  if (best.name) {
    result.innerHTML = `✅ Felismert hangszer: <b>${best.name}</b> (${best.score} match)`;
  } else {
    result.innerHTML = '❌ Nem található hangszer.';
  }

  src.delete(); kpSrc.delete(); descSrc.delete();
  startButton.disabled = false;
}
