let model, maxPredictions;

async function loadModel() {
  const URL = "./tm-model/";
  model = await tmImage.load(URL + "model.json", URL + "metadata.json");
  maxPredictions = model.getTotalClasses();
  console.log("TM modell betöltve");
}

async function predictFromImage(imgElement) {
  const prediction = await model.predict(imgElement);
  prediction.sort((a, b) => b.probability - a.probability);
  return prediction[0]; 
}
