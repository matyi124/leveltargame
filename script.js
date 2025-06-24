
    // 1) OpenCV callback
    cv['onRuntimeInitialized'] = () => {
      initCameraAndUI();
    };

    // Globális változók
    let video, canvas, context, result, captureBtn;
    const sablonok = [];

    // 2) Kamera inicializáció + gomb bekapcsolása
    function initCameraAndUI() {
      video      = document.getElementById('video');
      canvas     = document.getElementById('canvas');
      context    = canvas.getContext('2d');
      result     = document.getElementById('result');
      captureBtn = document.getElementById('captureBtn');

      // sablonok feltöltése
      const ids = [
        'templateCiterakicsi','templateCiterakicsi1','templateCiterakicsi2',
        'templateCiteranagy','templateCiteranagy1','templateCiteranagy2',
        'templateCiteranagy3','templateCiteranagy4',
        'templateGitar',
        'templateHarmonika','templateHarmonika1','templateHarmonika2',
        'templateKurt','templateKurt1','templateKurt2'
      ];
      for (let id of ids) {
        const el = document.getElementById(id);
        if (el) sablonok.push(el);
      }

      // kamerához jutás
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          video.srcObject = stream;
          captureBtn.disabled = false;
          captureBtn.addEventListener('click', captureAndMatch);
          result.textContent = 'Kamera készen, kattints a gombra!';
        })
        .catch(err => {
          console.error(err);
          result.textContent = 'Nem sikerült elérni a kamerát.';
        });
    }

    // 3) Capture & match
    async function captureAndMatch() {
      captureBtn.style.display = 'none';
      result.textContent = '⏳ Feldolgozás…';

      const t0 = performance.now();
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // kép előkészítése
      let src = cv.imread(canvas);
      cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(src, src, new cv.Size(5,5), 0);

      let best = { nev: '', pont: 0 };

      // végigmérjük a sablonokat
      for (let el of sablonok) {
        let tpl = cv.imread(el);
        if (!tpl || tpl.empty()) { tpl.delete?.(); continue; }

        cv.cvtColor(tpl, tpl, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(tpl, tpl, new cv.Size(5,5), 0);

        let dst = new cv.Mat();
        cv.matchTemplate(src, tpl, dst, cv.TM_CCOEFF_NORMED);
        const { maxVal } = cv.minMaxLoc(dst);

        if (maxVal > 0.5 && maxVal > best.pont) {
          best = { nev: el.id.replace('template',''), pont: maxVal };
        }

        tpl.delete(); dst.delete();
      }
      src.delete();

      const dt = Math.round(performance.now() - t0);
      if (best.nev) {
        result.innerHTML = `✅ Megtalált: <b>${best.nev}</b><br>Egyezés: ${(best.pont*100).toFixed(1)}%<br>⏱️ ${dt} ms`;
      } else {
        result.innerHTML = `❌ Nem található ismert hangszer.<br>⏱️ ${dt} ms`;
      }

      captureBtn.style.display = 'inline-block';
    }

