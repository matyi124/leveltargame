let leftModel, rightModel, webcam, ctx, canvas;
const volumes = [1, 1, 1];
const audioTracks = [
  new Audio("hangok/Canon_in_D__Pachelbel-Cello.mp3"),
  new Audio("hangok/Canon_in_D__Pachelbel-Fiolin.mp3"),
  new Audio("hangok/Canon_in_D__Pachelbel-Fiolin_(1).mp3"),
];
const leftModelURL = "model/left/model.json";
const leftMetadataURL = "model/left/metadata.json";
const rightModelURL = "model/right/model.json";
const rightMetadataURL = "model/right/metadata.json";

function checkMuteState() {
  const allMuted = audioTracks.every(s => s.volume === 0);

  if (allMuted) {
    audioTracks.forEach(s => s.pause());
  } else {
    audioTracks.forEach(s => {
      if (s.paused) s.play(); 
    });
  }
}

function adjustVolume(index, delta) {
  volumes[index] = Math.max(0, Math.min(1, volumes[index] + delta));
  audioTracks[index].volume = volumes[index];
  const bar = document.getElementById(`volume-bar-${index}`);
  if (bar) {
    bar.value = volumes[index];
    bar.style.width = `${volumes[index] * 100}%`;
  }
  checkMuteState();
  
  console.log(
    `🎵 Sáv ${index + 1} hangerő: ${(volumes[index] * 100).toFixed(0)}%`
  );
}

function handlePose(label) {
  console.log(label);
  const volStep = 0.05;

  switch (label) {
    // BAL KÉZ
    case "bal_lent":
      adjustVolume(2, -volStep);
      break;
    case "bal_fent":
      adjustVolume(2, volStep);
      break;
    case "bal_kozep_lent":
      adjustVolume(1, -volStep);
      break;
    case "bal_kozep_fent":
      adjustVolume(1, volStep);
      break;
    case "bal_semmi":
      break;  

    // JOBB KÉZ
    case "jobb_lent":
      adjustVolume(0, -volStep);
      break;
    case "jobb_fent":
      adjustVolume(0, volStep);
      break;
    case "jobb_kozep_lent":
      adjustVolume(1, -volStep);
      break;
    case "jobb_kozep_fent":
      adjustVolume(1, volStep);
      break;
    case "jobb_semmi":
      break;  
    default:
      console.log("Ismeretlen póz:", label);
  }
}

async function predict() {
  const { pose, posenetOutput } = await leftModel.estimatePose(webcam.canvas);

  const leftPrediction = await leftModel.predict(posenetOutput);
  const rightPrediction = await rightModel.predict(posenetOutput);

  const topLeft = leftPrediction.reduce((a, b) =>
    a.probability > b.probability ? a : b
  );
  const topRight = rightPrediction.reduce((a, b) =>
    a.probability > b.probability ? a : b
  );

  if (topLeft.probability > 0.8) handlePose(topLeft.className, true);
  if (topRight.probability > 0.8) handlePose(topRight.className, false);

  drawPose();
}

function drawPose() {
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(webcam.canvas, -canvas.width, 0, canvas.width, canvas.height);
  ctx.restore();
}

async function loop() {
  webcam.update?.();
  await predict();
  window.requestAnimationFrame(loop);
}

async function init() {
  leftModel = await tmPose.load(leftModelURL, leftMetadataURL);
  rightModel = await tmPose.load(rightModelURL, rightMetadataURL);

  const camWidth = 1280;
  const camHeight = 720;

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: {                                                               //ezeket kell kiszedni ha saját kamerát akarsz
        exact:                                                                  //  
          "7e2e9dda029ee775bd94bfadd3b9f065da4f816065c9649a8f79641e64707008",    // 
      },                                                                          //
      width: { ideal: camWidth },
      height: { ideal: camHeight },
    },
  });

  const video = document.createElement("video");
  video.width = camWidth;
  video.height = camHeight;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();

  webcam = { canvas: video, update: () => {} };

  canvas = document.getElementById("webcam");
  canvas.width = camWidth;
  canvas.height = camHeight;
  ctx = canvas.getContext("2d");

  audioTracks.forEach((track, idx) => {
    track.loop = true;
    track.volume = volumes[idx];
    track.play();
  });

  window.requestAnimationFrame(loop);
}

init();
