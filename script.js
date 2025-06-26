
console.log('📝 script.js (ORB) betöltve');


let video, canvas, context, result, startButton;
let streamReady = false;
let orbInited = false;

let orb, bf;

let tplKeypoints = {};   
let tplDescriptors = {};  

cv['onRuntimeInitialized'] = () => {
  console.log('🥳 OpenCV ready (ORB)');
  document.getElementById('loader').style.display = 'none'; 
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
}

function initCamera() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        streamReady = true;
        startButton.disabled = false;
      };
    })
    .catch(err => {
      console.error('Kamera hiba:', err);
      result.textContent = 'Nem sikerült a kamerát elérni.';
    });
}

async function initORB() {
  console.log('🔧 init ORB + BFMatcher');
  orb = new cv.ORB();
  bf  = new cv.BFMatcher(cv.NORM_HAMMING, false);

  const progressText = document.getElementById('progressText');
  const progressBar  = document.getElementById('progressBar');
  const startButton  = document.getElementById('startButton');

  let total = sablonok.length;
  for (let i = 0; i < total; i++) {
    const s = sablonok[i];
    const imgEl = s.element;

    if (!imgEl || !imgEl.complete) {
      console.warn(`⚠️ Sablon nem betöltve: ${s.name}`);
      continue;
    }

    let tpl = cv.imread(imgEl);
    cv.cvtColor(tpl, tpl, cv.COLOR_RGBA2GRAY);
    let kp = new cv.KeyPointVector(), desc = new cv.Mat();
    orb.detectAndCompute(tpl, new cv.Mat(), kp, desc);
    tpl.delete();

    tplKeypoints[s.name] = kp;
    tplDescriptors[s.name] = desc;

    const percent = Math.round(((i + 1) / total) * 100);
    progressBar.style.width = percent + '%';
    progressText.textContent = `${percent}%`;

    await new Promise(resolve => setTimeout(resolve, 50)); // hogy a UI is frissüljön
  }

  // Rejtsük el a betöltő sávot
  document.getElementById('progressBarContainer').style.display = 'none';
  progressText.style.display = 'none';


  // Kamera gomb engedélyezése
  startButton.disabled = false;

  orbInited = true;
  console.log('✅ ORB sablonok inicializálva');
}



async function captureAndMatch() {
  if (!streamReady) return;

  let bestOverall = { name: null, matches: 0 };

  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => setTimeout(resolve, 150)); // 150ms szünet a képkockák között

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    result.innerHTML = `<em>⏳ Feldolgozás (${i + 1}/3)…</em>`;

    let src = cv.imread(canvas);
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);

    let kpSrc = new cv.KeyPointVector(), descSrc = new cv.Mat();
    orb.detectAndCompute(src, new cv.Mat(), kpSrc, descSrc);

    let best = { name: null, matches: 0 };
    sablonok.forEach(s => {
      const name = s.name;
      const descTpl = tplDescriptors[name];
      if (!descTpl || descTpl.empty() || descSrc.empty()) return;

      let matches = new cv.DMatchVectorVector();
      bf.knnMatch(descTpl, descSrc, matches, 2);

      let good = 0;
      for (let i = 0; i < matches.size(); i++) {
        const m = matches.get(i).get(0);
        const n = matches.get(i).get(1);
        if (m.distance < 0.7 * n.distance) good++;
      }

      if (good > best.matches) {
        best = { name, matches: good };
      }

      matches.delete();
    });

    if (best.matches > bestOverall.matches) {
      bestOverall = best;
    }

    src.delete();
    kpSrc.delete();
    descSrc.delete();
  }

  if (bestOverall.name) {
    result.innerHTML = `✅ Felismert hangszer: <b>${bestOverall.name}</b> (${bestOverall.matches} match)`;
  } else {
    result.innerHTML = `❌ Nem található hangszer.`;
  }
}
