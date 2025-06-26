const URL = "./tm-model/";
let model, webcam, labelContainer, maxPredictions;

async function initModel() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    console.log("✅ Teachable Machine modell betöltve");

    // csak egy próba predikció teszthez – ezt majd kiváltjuk, ha kész a kamera logika
    labelContainer = document.getElementById("result");
}

async function predictFromImage(imageElement) {
    const prediction = await model.predict(imageElement);
    prediction.sort((a, b) => b.probability - a.probability);
    const best = prediction[0];
    console.log(`🎯 Felismert: ${best.className} (${Math.round(best.probability * 100)}%)`);
    return best;
}
