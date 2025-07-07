let currentTrack = null;

const thresholdTop = window.innerHeight * 0.4;
const thresholdBottom = window.innerHeight * 0.6;

const audioTracks = [
  new Audio("hangok/Canon_in_D__Pachelbel-Cello.mp3"),
  new Audio("hangok/Canon_in_D__Pachelbel-Fiolin.mp3"),
  new Audio("hangok/Canon_in_D__Pachelbel-Fiolin_(1).mp3"),
];
const volumes = [1, 1, 1];

const cellBounds = [
  { xMin: 0, xMax: 350, yMin: 0, yMax: 1080 },
  { xMin: 350, xMax: 750, yMin: 0, yMax: 1080 },
  { xMin: 750, xMax: 1920, yMin: 0, yMax: 1080 },
];

let knnClassifier = ml5.KNNClassifier();

async function loadKNN() {
  knnClassifier = ml5.KNNClassifier();
  try {
    const res = await fetch("hand_gestures.csv");
    if (!res.ok)
      throw new Error(
        `Nem találom a hand_gestures.csv-t! (HTTP ${res.status})`
      );
    const txt = await res.text();
    const lines = txt.trim().split("\n");

    if (lines.length === 0) throw new Error("CSV üres!");

    lines.forEach((line) => {
      const parts = line.split(",");
      const label = parts.pop().trim();
      const features = parts.map(Number);

      if (features.some(isNaN)) {
        console.warn("Találtam hibás számot ebben a sorban:", line);
        return;
      }

      knnClassifier.addExample(features, label);
    });

    const labels = Object.keys(knnClassifier.mapStringToIndex);
    if (labels.length === 0)
      throw new Error("Nem sikerült betölteni egyetlen osztályt sem!");

    console.log(`KNN betöltve: osztályok: ${labels.join(", ")}`);
  } catch (err) {
    console.error("Hiba a KNN betöltése közben:", err);
  }
}

function classifyHand(handLandmarks, callback) {
  const sample = [];
  for (const p of handLandmarks) {
    sample.push(p.x, p.y);
  }
  knnClassifier.classify(sample, (err, result) => {
    if (err) {
      console.error(err);
      callback(null);
      return;
    }
    callback(result.label);
  });
}

// elindítja a zenéket
audioTracks.forEach((track) => {
  track.loop = true;
  track.play();
});

function adjustVolume(index, delta) {
  volumes[index] = Math.max(0, Math.min(1, volumes[index] + delta));
  audioTracks[index].volume = volumes[index];
  const fill = document.getElementById(`volume-fill-${index}`);
  if (fill) {
    fill.style.width = `${volumes[index] * 100}%`;
  }
  // console.log(`${index + 1} hangerő: ${(volumes[index] * 100).toFixed(0)}%`);
}

function highlightCell(index) {
  const cells = document.querySelectorAll(".cell");

  if (index === "all") {
    cells.forEach((cell) => cell.classList.add("active"));
  } else {
    cells.forEach((cell, i) => {
      if (i === index) cell.classList.add("active");
      else cell.classList.remove("active");
    });
  }
}

function hoveredCell(x, y) {
  for (let i = 0; i < cellBounds.length; i++) {
    const b = cellBounds[i];
    if (x >= b.xMin && x <= b.xMax && y >= b.yMin && y <= b.yMax) {
      return i;
    }
  }
  return null;
}

let hasStarted = false;

async function start() {
  await loadKNN();

  if (hasStarted) {
    console.warn("start() már lefutott, nem fut újra.");
    return;
  }
  hasStarted = true;

  console.log("start() meghívva");

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { frameRate: { ideal: 60, max: 60 } },
  });

  const video = document.getElementById("camera");
  video.srcObject = stream;

  video.addEventListener("loadeddata", function onceLoaded() {
    console.log("video.loadeddata esemény lefutott");

    startMediapipe(video);

    video.removeEventListener("loadeddata", onceLoaded);
  });
}

start();

function startMediapipe(video) {
  const hands = new Hands({
    locateFile: (file) => `mediapipe/hands/${file}`,
  });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 0,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  let previousLeftIndex = null;
  hands.onResults((results) => {
    if (results.multiHandLandmarks?.length >= 1) {
      let leftIndex = 0;
      let rightIndex = null;

      if (results.multiHandLandmarks.length === 2) {
        const x0 = results.multiHandLandmarks[0][8].x;
        const x1 = results.multiHandLandmarks[1][8].x;

        const x0px = (1 - x0) * window.innerWidth;
        const x1px = (1 - x1) * window.innerWidth;

        const diff = Math.abs(x0px - x1px);

        if (previousLeftIndex !== null && diff < 50) {
          leftIndex = previousLeftIndex;
          rightIndex = previousLeftIndex === 0 ? 1 : 0;
        } else {
          if (x0 < x1) {
            leftIndex = 0;
            rightIndex = 1;
          } else {
            leftIndex = 1;
            rightIndex = 0;
          }
          previousLeftIndex = leftIndex;
        }
      } else {
        previousLeftIndex = 0;
      }

      const left = results.multiHandLandmarks[leftIndex];
      const lx = (1 - left[8].x) * window.innerWidth;
      const ly = left[8].y * window.innerHeight;

      const right =
        rightIndex !== null ? results.multiHandLandmarks[rightIndex] : null;
      const rx = right ? (1 - right[8].x) * window.innerWidth : null;
      const ry = right ? right[8].y * window.innerHeight : null;

      // logoljuk
      // console.log(`✋ Bal kéz: x=${lx.toFixed(0)}, y=${ly.toFixed(0)}`);
      // if (right) console.log(`🤚 Jobb kéz: x=${rx.toFixed(0)}, y=${ry.toFixed(0)}`);

      classifyHand(left, (leftLabel) => {
        if (!leftLabel) return;

        if (right) {
          classifyHand(right, (rightLabel) => {
            if (!rightLabel) return;

            //  console.log(`Bal kéz: ${leftLabel}, Jobb kéz: ${rightLabel}`);

            if (leftLabel === "open_palm" && rightLabel === "open_palm") {
              if (ly < thresholdTop && ry < thresholdTop) {
                audioTracks.forEach((_, i) => adjustVolume(i, +0.05));
                highlightCell("all");
                // console.log("Mindkét kéz open_palm FENT → minden hangerő NŐ");
              } else if (ly > thresholdBottom && ry > thresholdBottom) {
                audioTracks.forEach((_, i) => adjustVolume(i, -0.05));
                highlightCell("all");
                //  console.log("Mindkét kéz open_palm LENT → minden hangerő CSÖKKEN");
              }
            } else {
              // normál pointing logika
              const hovered = hoveredCell(lx, ly);
              if (hovered !== null) {
                currentTrack = hovered;
                highlightCell(currentTrack);
              } else {
                currentTrack = null;
              }

              if (rightIndex !== null && currentTrack !== null) {
                // console.log(
                //  `ry: ${ry}, thresholdTop: ${thresholdTop}, thresholdBottom: ${thresholdBottom}`
                // );

                if (ry < thresholdTop) {
                  // console.log("🔼 Fent, növelem a hangerőt");
                  adjustVolume(currentTrack, +0.05);
                } else if (ry > thresholdBottom) {
                  //  console.log("🔽 Lent, csökkentem a hangerőt");
                  adjustVolume(currentTrack, -0.05);
                } else {
                  //  console.log("⏸ Középen, nem csinálok semmit");
                }
              }
            }
          });
        }
      });
    }
  });

  const cam = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480,
  });
  cam.start();
}
