let video, canvas, context, result, startButton;
let streamReady = false; 
const foundInstruments = new Set(); 
const negativeLabels = ["rossz1", "rossz2", "rossz3", "rossz4", "rossz5", "rossz6", "rossz7", "rossz8", "rossz9", "rossz10", "rossz11", "rossz12", "rossz13"];
let totalInstruments = 0;

function setTotalInstruments(count) {
  totalInstruments = count;
}

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
  startButton.disabled = true;
  result.textContent = "Feldolgozás...";

  img.onload = async () => {
  startButton.disabled = true;
  result.textContent = "Feldolgozás...";

  const prediction = await predictFromImage(img);
  console.log("Predikció eredménye:", prediction);

  if (prediction.probability >= 0.8 && !negativeLabels.includes(prediction.className)) {
  if (!foundInstruments.has(prediction.className)) {
    foundInstruments.add(prediction.className);
    result.textContent = `Találat: ${prediction.className}`;

    const matchedCell = document.getElementById(prediction.className);
    if (matchedCell) {
      matchedCell.classList.add("table-success");
    }
    if (foundInstruments.size === totalInstruments) {
      const congratsModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('congratsModal'));
      congratsModal.show();
    }
  } else {
    result.textContent = `Már megtaláltad: ${prediction.className}`;
  }
} else {
  result.textContent = `Nem sikerült felismerni hangszert`;
}

  startButton.disabled = false;
};
}

window.addEventListener("DOMContentLoaded",async () => {
  await loadModel();
  setTotalInstruments(document.querySelectorAll("#instrument-list tr").length);
  document.getElementById("restartButton").addEventListener("click", () => {
  foundInstruments.clear();
  document.querySelectorAll("#instrument-list tr").forEach(row => {
  row.classList.remove("table-success");
  });

  const resultElement = document.getElementById("result");
  resultElement.textContent = "";
  resultElement.className = "";

  document.getElementById("startButton").disabled = false;

  const congratsModal = bootstrap.Modal.getInstance(document.getElementById('congratsModal'));
  congratsModal.hide();
});

  setupUI();
  initCamera();
   const popup = document.getElementById('popup');
  const okButton = document.getElementById('popup-ok');
  okButton.addEventListener('click', () => {
    popup.style.display = 'none'; 
  });
});

let mode = "normal";
let timeLeft = 120;
let countdownInterval = null;

function startTimer() {
  const display = document.getElementById("timeLeft");
  timeLeft = 120;
  display.textContent = timeLeft;

  countdownInterval = setInterval(() => {
    timeLeft--;
    display.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      handleTimeout();
    }
  }, 1000);
}

function handleTimeout() {
  clearInterval(countdownInterval);

  foundInstruments.clear();
  document.querySelectorAll("#instrument-list tr").forEach(row => {
    row.classList.remove("table-success");
  });

  document.getElementById("startButton").disabled = false;

  mode = "normal";
  document.getElementById("difficulty").value = "normal";
  document.getElementById("timerDisplay").style.display = "none";
  
  const failedModal = new bootstrap.Modal(document.getElementById('failedModal'));
  failedModal.show();
}

document.addEventListener("DOMContentLoaded", () => {
  if (mode === "hard") {
    startTimer();
  }
});
document.getElementById("difficulty").addEventListener("change", (e) => {
  mode = e.target.value;

  const timerDisplay = document.getElementById("timerDisplay");
  if (mode === "hard") {
    timerDisplay.style.display = "block";
    startTimer();
  } else {
    timerDisplay.style.display = "none";
    clearInterval(countdownInterval);
  }
});

