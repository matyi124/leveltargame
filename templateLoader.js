const container = document.getElementById('templateContainer');
const templateConfig = {
  citeraAllo: 24,
  csengo:    23,
  dob:        21,
  furulya:    30,
  gitar:      30,
  harmonika:  37,
  kolomp:     31,
  szarvaskurt:  30
};

const totalImages = Object.values(templateConfig).reduce((sum, count) => sum + count, 0);
let loadedImages = 0;

const sablonok = [];

for (const [rootName, count] of Object.entries(templateConfig)) {
  for (let i = 1; i <= count; i++) {
    const img = document.createElement('img');
    img.crossOrigin = "anonymous"; 
    img.id  = `tmpl_${rootName}_${i}`;
    img.src = `https://pub-c41dc5fd9be94194a2a1403d44d25bc0.r2.dev/Hangszerek/${rootName}/${rootName}${i}.jpg`;
    img.alt = rootName;

    img.onload = () => {
      console.log(`📦 Sablon betöltve: ${rootName}${i}`);
      loadedImages++;
      const percent = Math.round((loadedImages / totalImages) * 100);
      document.getElementById('progressBar').style.width = percent + '%';
      document.getElementById('progressText').textContent = percent + '%';

      if (loadedImages === totalImages) {
        document.getElementById('progressBarContainer').style.display = 'none';
        document.getElementById('progressText').style.display = 'none';
      }
    };

    container.appendChild(img);
    sablonok.push({
      name: rootName,
      element: img
    });
  }
}