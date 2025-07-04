let canvas, ctx, landmarks = null, knnClassifier;
const resultDiv = document.getElementById("result");

async function loadCSVandTrain() {
  knnClassifier = ml5.KNNClassifier();

  const response = await fetch("hand_gestures.csv");
  const text = await response.text();
  const lines = text.trim().split("\n");

  lines.forEach(line => {
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
    }
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

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480
  });
  camera.start();

  canvas = document.getElementById("webcam");
  canvas.width = 640;
  canvas.height = 480;
  ctx = canvas.getContext("2d");
}

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    landmarks = results.multiHandLandmarks[0];
    drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
    drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1 });

   const sample = [];
for (const point of landmarks) {
  sample.push(point.x);
  sample.push(point.y);
}


    if (knnClassifier.getNumLabels() > 0) {
      knnClassifier.classify(sample, (err, result) => {
        if (err) {
          console.error(err);
          resultDiv.textContent = "❌ Hiba";
          return;
        }
        resultDiv.textContent = `🔷 ${result.label} (${(result.confidencesByLabel[result.label]*100).toFixed(1)}%)`;
      });
    } else {
      resultDiv.textContent = "⏳ Modell még töltődik...";
    }
  } else {
    landmarks = null;
    resultDiv.textContent = "👋 Kéz nem látható";
  }

  ctx.restore();
}

loadCSVandTrain();
initMediapipe();
