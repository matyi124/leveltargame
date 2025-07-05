let knnClassifier, tmModel;
let currentTrack = null;
const audioTracks = [
  new Audio("hangok/Canon_in_D__Pachelbel-Cello.mp3"),
  new Audio("hangok/Canon_in_D__Pachelbel-Fiolin.mp3"),
  new Audio("hangok/Canon_in_D__Pachelbel-Fiolin_(1).mp3"),
];
const volumes = [1, 1, 1];

// elindítja a zenéket
audioTracks.forEach(track => { track.loop = true; track.play();});

function adjustVolume(index, delta) {
  volumes[index] = Math.max(0, Math.min(1, volumes[index] + delta));
  audioTracks[index].volume = volumes[index];
  const fill = document.getElementById(`volume-fill-${index}`);
  if (fill) {
    fill.style.width = `${volumes[index] * 100}%`;
  }
  console.log(`🎵 ${index+1} hangerő: ${(volumes[index]*100).toFixed(0)}%`);
}

function highlightCell(index) {
  document.querySelectorAll('.cell').forEach((cell, i) => {
    if (i === index) cell.classList.add('active');
    else cell.classList.remove('active');
  });
}

function hoveredCell(x, y) {
  const cells = document.querySelectorAll(".cell");
  for (let i = 0; i < cells.length; i++) {
    const rect = cells[i].getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return i;
    }
  }
  return null;
}

async function loadKNN() {
  knnClassifier = ml5.KNNClassifier();
  const res = await fetch("hand_gestures.csv");
  const txt = await res.text();
  txt.trim().split("\n").forEach(line => {
    const parts = line.split(",");
    const label = parts.pop();
    const features = parts.map(Number);
    knnClassifier.addExample(features, label);
  });
  console.log("✅ KNN betöltve");
}

async function loadTM() {
  tmModel = await tmPose.load("model/model.json", "model/metadata.json");
  console.log("✅ TM betöltve");
}

let hasStarted = false;

async function start() {
  if (hasStarted) {
    console.warn("🚨 start() már lefutott, nem fut újra.");
    return;
  }
  hasStarted = true;

  console.log("✅ start() meghívva");

  await loadKNN();
  await loadTM();

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  video.width = 640;
  video.height = 480;

  console.log("🎥 Új video elem létrejött:", video);

  document.body.appendChild(video);

  video.addEventListener("loadeddata", function onceLoaded() {
  console.log("🎬 video.loadeddata esemény lefutott");

  startMediapipe(video);
  tmLoop(video);

  video.removeEventListener("loadeddata", onceLoaded);
});
};

start();

function tmLoop(video) {
  requestAnimationFrame(async () => {
    const { pose, posenetOutput } = await tmModel.estimatePose(video);
    const prediction = await tmModel.predict(posenetOutput);
    const top = prediction.reduce((a, b) => a.probability > b.probability ? a : b);
    if (top.probability > 0.8 && currentTrack !== null) {
      if (top.className === "fent") adjustVolume(currentTrack, +0.02);
      else if (top.className === "lent") adjustVolume(currentTrack, -0.02);
    }
    console.log(top.className);
    tmLoop(video);
  });
}

function startMediapipe(video) {
const hands = new Hands({
  locateFile: (file) => `mediapipe/hands/${file}`
});
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
  });

  hands.onResults(results => {
    if (results.multiHandLandmarks?.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      console.log('a mediapipe fut');
      const sample = [];
      for (const p of landmarks) sample.push(p.x, p.y);

      knnClassifier.classify(sample, (err, result) => {
        if (err) return console.error(err);
        if (result.label === "mutato") {
          const x = landmarks[8].x * window.innerWidth;
          const y = landmarks[8].y * window.innerHeight;
          const hovered = hoveredCell(x, y);
          if (hovered !== null) {
            currentTrack = hovered;
            highlightCell(currentTrack);
            console.log(`👉 Kiválasztott hangszer: ${hovered+1}`);
          }
        }
      });
    }
  });

  const cam = new Camera(video, {
    onFrame: async () => { await hands.send({ image: video }); },
    width: 640, height: 480
  });
  cam.start();
}

start();
