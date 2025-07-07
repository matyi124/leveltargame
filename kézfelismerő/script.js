let canvas,
  ctx,
  landmarks = null,
  knnClassifier;
const resultDiv = document.getElementById("result");

let currentGesture = null;

const objects = [
  { x: 200, y: 200, width: 80, height: 80, held: false, color: "blue" },
  { x: 400, y: 300, width: 80, height: 80, held: false, color: "green" },
];

async function loadCSVandTrain() {
  knnClassifier = ml5.KNNClassifier();

  const response = await fetch("hand_gestures.csv");
  const text = await response.text();
  const lines = text.trim().split("\n");

  lines.forEach((line) => {
    const parts = line.split(",");
    const label = parts.pop();
    const features = parts.map(Number);
    knnClassifier.addExample(features, label);
  });

  console.log(`✅ Tanítás kész, minták száma: ${lines.length}`);
}

async function initMediapipe() {
  const hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    },
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  hands.onResults(onResults);

  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await video.play();

  canvas = document.getElementById("webcam");
  canvas.width = 640;
  canvas.height = 480;
  ctx = canvas.getContext("2d");

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480,
  });
  camera.start();
}

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    landmarks = results.multiHandLandmarks[0];
    drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 2,
    });
    drawLandmarks(ctx, landmarks, { color: "#FF0000", lineWidth: 1 });

    const sample = [];
    landmarks.forEach((p) => {
      sample.push(p.x);
      sample.push(p.y);
    });

    // csak ha a classifier betöltött
    if (knnClassifier.getNumLabels() > 0) {
      knnClassifier.classify(sample, (err, result) => {
        if (err) {
          console.error(err);
          resultDiv.textContent = "❌ Hiba";
          return;
        }

        currentGesture = result.label?.trim().toLowerCase();
      });
    }

    let handX = 0,
      handY = 0;
    landmarks.forEach((p) => {
      handX += p.x * canvas.width;
      handY += p.y * canvas.height;
    });
    handX /= landmarks.length;
    handY /= landmarks.length;

    const tolerance = 50;

    console.log(`currentGesture: [${currentGesture}]`);

    objects.forEach((obj) => {
      if (currentGesture === "fist") {
        if (
          !obj.held &&
          handX > obj.x - tolerance &&
          handX < obj.x + obj.width + tolerance &&
          handY > obj.y - tolerance &&
          handY < obj.y + obj.height + tolerance
        ) {
          obj.held = true;
          console.log("🎯 Tárgy megfogva!");
        }
      }

      if (currentGesture === "open_palm") {
        if (obj.held) console.log("👐 Tárgy elengedve!");
        obj.held = false;
      }

      if (obj.held) {
        obj.x = handX - obj.width / 2;
        obj.y = handY - obj.height / 2;
      }
    });
ctx.fillStyle = "black";
ctx.font = "20px Arial";
ctx.fillText(`Gesture: ${currentGesture || 'nincs'}`, 10, 30);

    objects.forEach((obj) => {
      ctx.fillStyle = obj.held ? "red" : obj.color;
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    });
  }

  ctx.restore();
}

(async () => {
  await loadCSVandTrain();
  await initMediapipe();
})();
