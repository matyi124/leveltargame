let canvas, ctx, gestureEstimator;

async function initMediapipe() {
  const hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    },
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  hands.onResults(onResults);

  const videoElement = document.createElement("video");
  videoElement.width = 640;
  videoElement.height = 480;
  videoElement.autoplay = true;
  videoElement.muted = true;
  videoElement.playsInline = true;

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  videoElement.srcObject = stream;
  await videoElement.play();

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480,
  });
  camera.start();

  canvas = document.getElementById("webcam");
  canvas.width = 640;
  canvas.height = 480;
  ctx = canvas.getContext("2d");

  // 👇 itt definiáljuk az új gesztust
 const openPalm = new fp.GestureDescription('open_palm');

for (let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
  openPalm.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);// megengedjük kicsit hajolva is
  openPalm.addDirection(finger, fp.FingerDirection.VerticalUp, 0.75);
}


const fist = new fp.GestureDescription('fist');

for (let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
  fist.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
}


  gestureEstimator = new fp.GestureEstimator([
    openPalm,
    fist
  ]);
}

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.multiHandLandmarks) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      const handLabel = results.multiHandedness[i].label;

      drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
      drawLandmarks(ctx, landmarks, {color: '#FF0000', lineWidth: 1});

      const prediction = gestureEstimator.estimate(landmarks, 4.0);

      if (prediction.gestures.length > 0) {
        const best = prediction.gestures.reduce((p, c) => p.score > c.score ? p : c);
        console.log(`Kéz ${i + 1} (${handLabel}): ${best.name} (${best.score.toFixed(2)})`);
      } else {
        console.log(`Kéz ${i + 1} (${handLabel}): nincs felismerhető gesztus`);
      }
    }
  }

  ctx.restore();
}

initMediapipe();
