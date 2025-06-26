let video, canvas, context, result, startButton;
let streamReady = false; 

function setupUI() {
  video       = document.getElementById('video');
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

async function captureAndMatch() {
  const video = document.getElementById("video");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const img = new Image();
  img.src = canvas.toDataURL("image/jpeg");

  // Várunk, amíg az <img> betöltődik
  img.onload = async () => {
    const result = await predictFromImage(img);
    console.log("Predikció eredménye:", result);
    // Itt akár DOM-ba is kiírhatod, pl. egy <div id="result">-be
    document.getElementById("result").textContent = `Találat: ${result.className} (${(result.probability * 100).toFixed(1)}%)`;
  };
}

window.addEventListener("DOMContentLoaded", () => {
  loadModel();
  setupUI();
  initCamera();
});

