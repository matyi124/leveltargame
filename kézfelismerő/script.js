let canvas, ctx, landmarks = null, knnClassifier;
const resultDiv = document.getElementById("result");

const puzzleImages = ["puzzle.png"];
let currentPuzzleIndex = 0;

let currentGesture = null;
const pieces = [];
let img;
const rows = 3, cols = 3;
const pieceSize = 100;
const tolerance = 70;
const canvasSize = 600;

let heldPiece = null;

const puzzleOffsetX = (canvasSize - cols * pieceSize) / 2;
const puzzleOffsetY = 50;

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

function setupPuzzle() {
img = new Image();
img.src = puzzleImages[currentPuzzleIndex];
img.onload = () => {
  pieces.length = 0;
const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext('2d');
tempCanvas.width = pieceSize;
tempCanvas.height = pieceSize;

for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {

    // ideiglenesen kirajzoljuk a darabot
    tempCtx.clearRect(0, 0, pieceSize, pieceSize);
    tempCtx.drawImage(img,
      c * pieceSize, r * pieceSize, pieceSize, pieceSize,
      0, 0, pieceSize, pieceSize);

    const imageData = tempCtx.getImageData(0, 0, pieceSize, pieceSize).data;

    let visible = false;
    for (let i = 3; i < imageData.length; i += 4) {
      if (imageData[i] > 0) {
        visible = true;
        break;
      }
    }

    pieces.push({
      sx: c * pieceSize,
      sy: r * pieceSize,
      sw: pieceSize,
      sh: pieceSize,
      x: Math.random() * (canvas.width - pieceSize),
      y: 350 + Math.random() * (canvas.height - 350 - pieceSize),
      correctX: puzzleOffsetX + c * pieceSize,
      correctY: puzzleOffsetY + r * pieceSize,
      held: false,
      locked: !visible
    });
  }
}
    requestAnimationFrame(draw);
  }
}

async function initMediapipe() {
  const hands = new Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
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
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  ctx = canvas.getContext("2d");

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480
  });
  camera.start();

  setupPuzzle();
}

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#eee";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Tükrözzük a kéz pontokat
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    landmarks = results.multiHandLandmarks[0];
    drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
    drawLandmarks(ctx, landmarks, { color: "#FF0000", lineWidth: 1 });

    const sample = [];
    landmarks.forEach(p => {
      sample.push(p.x);
      sample.push(p.y);
    });

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

    let handX = 0, handY = 0;
    landmarks.forEach(p => {
      handX += p.x * canvas.width;
      handY += p.y * canvas.height;
    });
    handX /= landmarks.length;
    handY /= landmarks.length;

    // Tükrözzük a logikában is
    handX = canvas.width - handX;

    if (currentGesture === "fist" && !heldPiece) {
      pieces.forEach(piece => {
        if (!heldPiece && !piece.locked &&
            handX > piece.x && handX < piece.x + pieceSize &&
            handY > piece.y && handY < piece.y + pieceSize) {
          piece.held = true;
          heldPiece = piece;
        }
      });
    }

    if (currentGesture === "open_palm" && heldPiece) {
      if (Math.abs(heldPiece.x - heldPiece.correctX) < tolerance &&
          Math.abs(heldPiece.y - heldPiece.correctY) < tolerance) {
        heldPiece.x = heldPiece.correctX;
        heldPiece.y = heldPiece.correctY;
        heldPiece.locked = true;
      }
      heldPiece.held = false;
      heldPiece = null;
    }

    if (heldPiece) {
      heldPiece.x = handX - pieceSize / 2;
      heldPiece.y = handY - pieceSize / 2;
    }
  }

  ctx.restore(); // a kéz pontok tükrözése vége

  draw();

  ctx.restore();
}

function draw() {
  pieces.forEach(piece => {
    ctx.drawImage(img, piece.sx, piece.sy, piece.sw, piece.sh,
                       piece.x, piece.y, pieceSize, pieceSize);
  });
  ctx.fillStyle = "black";
  ctx.font = "16px Arial";
  ctx.fillText(`Gesture: ${currentGesture || 'nincs'}`, 10, canvas.height - 10);

  // ellenőrzés: minden a helyén?
const allLocked = pieces.every(p => p.locked);
if (allLocked) {
  ctx.fillStyle = "green";
  ctx.font = "32px Arial";
  ctx.fillText("Kész vagy!", canvas.width / 2 - 100, canvas.height / 2);

  // várj egy kicsit, majd következő puzzle
  setTimeout(() => {
    currentPuzzleIndex++;
    if (currentPuzzleIndex < puzzleImages.length) {
      setupPuzzle();
    } else {
      ctx.fillStyle = "blue";
      ctx.fillText("Minden kész! Gratulálok!", canvas.width / 2 - 150, canvas.height / 2 + 50);
    }
  }, 2000);
}
}

(async () => {
  await loadCSVandTrain();
  await initMediapipe();
})();
