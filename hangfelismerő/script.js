let currentAudio = null;
let remainingQuestions = [];
let currentQuestion;
const resultDiv = document.getElementById("result");
const playBtn = document.getElementById("playBtn");
const optionsDiv = document.getElementById("options");

const questions = [
  {
    correct: "Hegedű",
    audios: ["violin1.mp3", "violin2.mp3", "violin3.mp3"],
    options: ["Hegedű", "Zongora", "Trombita", "Cselló"],
  },
  {
    correct: "Cselló",
    audios: ["cello1.mp3", "cello2.mp3", "cello3.mp3"],
    options: ["Szaxofon", "Tuba", "Dob", "Cselló"],
  },
  {
    correct: "Klarinét",
    audios: ["clarinet1.mp3", "clarinet2.mp3", "clarinet3.mp3"],
    options: ["Harsona", "Síp", "Oboa", "Klarinét"],
  },
  {
    correct: "Szaxofon",
    audios: ["saxophone1.mp3", "saxophone2.mp3", "saxophone3.mp3"],
    options: ["Kürt", "Tuba", "Trombita", "Szaxofon"],
  },
  {
    correct: "Trombita",
    audios: ["trumpet1.mp3", "trumpet2.mp3", "trumpet3.mp3"],
    options: ["Zongora", "Tuba", "Trombita", "Xilofon"],
  },
  {
    correct: "Tuba",
    audios: ["tuba1.mp3", "tuba2.mp3", "tuba3.mp3"],
    options: ["Dob", "Tuba", "Furulya", "Hárfa"],
  },
  {
    correct: "Fuvola",
    audios: ["flute1.mp3", "flute2.mp3", "flute3.mp3"],
    options: ["Dob", "Fuvola", "Furulya", "Gitár"],
  },
  {
    correct: "Gitár",
    audios: ["gitar1.mp3", "gitar2.mp3", "gitar3.mp3"],
    options: ["Gitár", "Zongora", "Furulya", "Hárfa"],
  },
  {
    correct: "Harangjáték",
    audios: ["harangjatek1.mp3", "harangjatek2.mp3", "harangjatek3.mp3"],
    options: ["Csörgődob", "Harangjáték", "Hárfa", "Orgona"],
  },
  {
    correct: "Zongora",
    audios: ["piano1.mp3", "piano2.mp3", "piano3.mp3"],
    options: ["Csörgődob", "Zongora", "Hárfa", "Orgona"],
  },
];

function startGame() {
  remainingQuestions = [...questions];
  playBtn.disabled = false;
  pickQuestion();
}

function pickQuestion() {
  resultDiv.textContent = "";
  optionsDiv.innerHTML = "";

  if (remainingQuestions.length === 0) {
    resultDiv.textContent = "🎉 Vége! Gratulálok!";
    playBtn.disabled = true;
    return;
  }

  const randomIndex = Math.floor(Math.random() * remainingQuestions.length);
  currentQuestion = remainingQuestions.splice(randomIndex, 1)[0];

  const shuffled = currentQuestion.options
    .map((val) => ({ val, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map((obj) => obj.val);

  shuffled.forEach((opt) => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.onclick = () => checkAnswer(opt);
    optionsDiv.appendChild(btn);
    btn.className = "btn btn-outline-secondary col-5 col-md-3";
    btn.onclick = () => checkAnswer(opt);
    optionsDiv.appendChild(btn);
  });
}

function playAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  const randomAudio =
    currentQuestion.audios[
      Math.floor(Math.random() * currentQuestion.audios.length)
    ];
  currentAudio = new Audio(`sounds/${randomAudio}`);
  currentAudio.play();
}

function checkAnswer(selected) {
if (selected === currentQuestion.correct) {
  resultDiv.textContent = "✅ Helyes!";
  resultDiv.style.color = "green";

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  playBtn.disabled = true;

  setTimeout(() => {
    playBtn.disabled = false;
    pickQuestion();
  }, 1500);
}
}

playBtn.onclick = () => playAudio();

pickQuestion();
startGame();
