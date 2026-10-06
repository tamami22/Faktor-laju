/* ============================================================
   SIMULASI SUHU — Animasi + Maxwell-Boltzmann + Laju vs Suhu
   Prinsip:
   - Setiap partikel punya kecepatan v ~ MB 2D pada suhu T_sim
   - Partikel dengan v ≥ v_a (batas Ea) → "energik" (warna terang + glow)
   - Reaksi hanya terjadi jika A dan B keduanya energik
   - Suhu 0..100 °C → T_K = 273..373
   - T_sim (satuan simulasi) = 0.5 + (T_C/100) * 1.5
     (supaya efek visual distribusi dramatis tanpa melanggar arah tren)
   ============================================================ */
(function () {

  // ---------- DOM ----------
  const cvAnim   = document.getElementById('kanvas-animasi');
  const cvMB     = document.getElementById('kanvas-mb');
  const cvGrafik = document.getElementById('kanvas-grafik');
  const ctxAnim  = cvAnim.getContext('2d');
  const ctxMB    = cvMB.getContext('2d');
  const ctxGrafik = cvGrafik.getContext('2d');

  const btnPlay    = document.getElementById('btn-play');
  const btnReset   = document.getElementById('btn-reset');
  const slider     = document.getElementById('slider-suhu');
  const labelSuhu  = document.getElementById('label-suhu');
  const labelKelvin = document.getElementById('label-kelvin');

  const statEnergik = document.getElementById('stat-energik');
  const statEfektif = document.getElementById('stat-efektif');
  const statLaju    = document.getElementById('stat-laju');
  const statSisa    = document.getElementById('stat-sisa');

  // ---------- Konstanta ----------
  const WARNA_A        = '#FF6B6B';
  const WARNA_B        = '#45B7D1';
  const WARNA_A_LEMAH  = '#FFD0D0';
  const WARNA_B_LEMAH  = '#CDE9EF';
  const WARNA_AB       = '#7BC96F';

  const R_PARTIKEL = 7;
  const N_PARTIKEL = 30;      // jumlah A + B (dibagi rata)

    const EA_SIM     = 1.2;
  const VA_BATAS   = Math.sqrt(2 * EA_SIM);

  const T_SIM_MIN  = 0.4;
  const T_SIM_MAX  = 4.0;

  const FAKTOR_VISUAL = 2.5;   // 100 °C ≈ 425 px/detik — lintas kanvas < 1 detik
  const JENDELA_LAJU  = 3000;
  const DURASI_SAMPEL = 2500;

  // Bucket suhu untuk grafik
  const BUCKET = [0, 25, 50, 75, 100];

  let berjalan = true;
  let suhuC    = 25;

  // ---------- Utilitas ----------
  function suhuKeTsim(tC) {
    return T_SIM_MIN + (tC / 100) * (T_SIM_MAX - T_SIM_MIN);
  }

  // Sampling kecepatan dari MB 2D: v = sqrt(2E), E ~ Exp(T)
  function sampleV(Tsim) {
    const E = -Tsim * Math.log(Math.random() + 1e-9);
    let v = Math.sqrt(2 * E);
    // batasi outlier agar tidak melompat
    const vMax = 3.2 * Math.sqrt(Tsim);
    if (v > vMax) v = vMax;
    return v;
  }

  // ---------- Partikel ----------
  function buatPartikel(jenis, Tsim) {
    const sudut = Math.random() * Math.PI * 2;
    const v = sampleV(Tsim);
    return {
      x: 20 + Math.random() * Math.max(1, lebarAnim - 40),
      y: 20 + Math.random() * Math.max(1, tinggiAnim - 40),
      vx: Math.cos(sudut) * v,
      vy: Math.sin(sudut) * v,
      jenis,        // 'A' atau 'B' atau 'AB'
      sudutIkatan: 0
    };
  }

  function isiUlang() {
    partikel = [];
    const Tsim = suhuKeTsim(suhuC);
    const half = Math.floor(N_PARTIKEL / 2);
    for (let i = 0; i < half; i++) partikel.push(buatPartikel('A', Tsim));
    for (let i = 0; i < N_PARTIKEL - half; i++) partikel.push(buatPartikel('B', Tsim));
    totalEfektif = 0;
    riwayat = [];
    kilatan = [];
  }

  // ---------- State ----------
  let partikel = [];
  let totalEfektif = 0;
  let riwayat = [];
  let kilatan = [];
  let lebarAnim = 0, tinggiAnim = 0;
  let lebarMB = 0, tinggiMB = 0;
  let lebarGrafik = 0, tinggiGrafik = 0;
  let countdownReset = 0;      // > 0 artinya sedang menunggu reset

  // ---------- Ukuran canvas ----------
  function aturUkuran() {
    const dpr = window.devicePixelRatio || 1;
    [
      [cvAnim, 'anim'],
      [cvMB, 'mb'],
      [cvGrafik, 'grafik']
    ].forEach(([cv]) => {
      const rect = cv.getBoundingClientRect();
      cv.width  = rect.width  * dpr;
      cv.height = rect.height * dpr;
      cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    const r1 = cvAnim.getBoundingClientRect();
    lebarAnim = r1.width; tinggiAnim = r1.height;
    const r2 = cvMB.getBoundingClientRect();
    lebarMB = r2.width; tinggiMB = r2.height;
    const r3 = cvGrafik.getBoundingClientRect();
    lebarGrafik = r3.width; tinggiGrafik = r3.height;
  }

  // ---------- Update partikel ----------
  function updatePartikel(skala) {
    const Tsim = suhuKeTsim(suhuC);
    const pxPerFrame = FAKTOR_VISUAL;

    // Gerak + bounce
    for (const p of partikel) {
      p.x += p.vx * pxPerFrame * skala;
      p.y += p.vy * pxPerFrame * skala;
      if (p.x - R_PARTIKEL < 0)         { p.x = R_PARTIKEL;         p.vx =  Math.abs(p.vx); }
      if (p.x + R_PARTIKEL > lebarAnim) { p.x = lebarAnim - R_PARTIKEL; p.vx = -Math.abs(p.vx); }
      if (p.y - R_PARTIKEL < 0)         { p.y = R_PARTIKEL;         p.vy =  Math.abs(p.vy); }
      if (p.y + R_PARTIKEL > tinggiAnim){ p.y = tinggiAnim - R_PARTIKEL; p.vy = -Math.abs(p.vy); }
      if (p.jenis === 'AB') p.sudutIkatan += 0.02 * skala;
    }

    // Deteksi tumbukan
    const hapus = new Set();
    const tambah = [];

    for (let i = 0; i < partikel.length; i++) {
      const a = partikel[i];
      if (hapus.has(a)) continue;

      for (let j = i + 1; j < partikel.length; j++) {
        const b = partikel[j];
        if (hapus.has(b)) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const jarakMin = R_PARTIKEL * 2;

        if (d < jarakMin && d > 0.001) {
          const pasanganAB =
            (a.jenis === 'A' && b.jenis === 'B') ||
            (a.jenis === 'B' && b.jenis === 'A');

          // Cek apakah keduanya energik
          const vA = Math.hypot(a.vx, a.vy);
          const vB = Math.hypot(b.vx, b.vy);
          const keduanyaEnergik = (vA >= VA_BATAS) && (vB >= VA_BATAS);

          if (pasanganAB && keduanyaEnergik) {
            // REAKSI!
            hapus.add(a);
            hapus.add(b);
            const ab = {
              x: (a.x + b.x) / 2,
              y: (a.y + b.y) / 2,
              vx: (a.vx + b.vx) / 2,
              vy: (a.vy + b.vy) / 2,
              jenis: 'AB',
              sudutIkatan: Math.atan2(b.y - a.y, b.x - a.x)
            };
            tambah.push(ab);
            totalEfektif++;
            riwayat.push(performance.now());
            kilatan.push({ x: ab.x, y: ab.y, umur: 1 });
            break;
          }

          // Tumbukan elastis biasa (baik karena bukan A-B, atau bukan energik)
          const nx = dx / d, ny = dy / d;
          const tumpang = (jarakMin - d) / 2;
          a.x -= nx * tumpang; a.y -= ny * tumpang;
          b.x += nx * tumpang; b.y += ny * tumpang;

          const p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (p > 0) {
            a.vx -= p * nx; a.vy -= p * ny;
            b.vx += p * nx; b.vy += p * ny;
          }

          // Jika A-B bertemu tapi tidak energik → kilatan putih kecil (opsional)
          if (pasanganAB && !keduanyaEnergik) {
            // tampilkan "tumbukan gagal" kecil
            kilatan.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, umur: 0.6, gagal: true });
          }
        }
      }
    }

    if (hapus.size || tambah.length) {
      partikel = partikel.filter(p => !hapus.has(p)).concat(tambah);
    }

    // Cek kondisi selesai → countdown reset
    const tersisa = partikel.filter(p => p.jenis !== 'AB').length;
    if (tersisa === 0 && countdownReset === 0) {
      countdownReset = 60;   // ~1 detik
    }

    // Trim riwayat
    const batas = performance.now() - JENDELA_LAJU;
    while (riwayat.length && riwayat[0] < batas) riwayat.shift();

    // Update kilatan
    for (let i = kilatan.length - 1; i >= 0; i--) {
      kilatan[i].umur -= skala * 0.03;
      if (kilatan[i].umur <= 0) kilatan.splice(i, 1);
    }
  }

  // ---------- Gambar animasi ----------
  function gambarAnimasi() {
    const ctx = ctxAnim;
    ctx.clearRect(0, 0, lebarAnim, tinggiAnim);

    for (const p of partikel) {
      if (p.jenis === 'AB') {
        gambarAB(ctx, p);
        continue;
      }
      const v = Math.hypot(p.vx, p.vy);
      const energik = v >= VA_BATAS;
      const warnaDasar = p.jenis === 'A'
        ? (energik ? WARNA_A : WARNA_A_LEMAH)
        : (energik ? WARNA_B : WARNA_B_LEMAH);

      // glow bila energik
      if (energik) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, R_PARTIKEL + 6, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(p.x, p.y, R_PARTIKEL, p.x, p.y, R_PARTIKEL + 6);
        grad.addColorStop(0, 'rgba(251, 191, 36, 0.55)');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, R_PARTIKEL, 0, Math.PI * 2);
      ctx.fillStyle = warnaDasar;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x - 2, p.y - 2, R_PARTIKEL * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fill();
    }

    // kilatan
    for (const k of kilatan) {
      if (k.gagal) {
        // tumbukan gagal: kilatan putih pucat kecil
        const r = 6 + 8 * (1 - k.umur / 0.6);
        ctx.beginPath();
        ctx.arc(k.x, k.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(148, 163, 184, ${k.umur * 0.8})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        const r = 8 + 22 * (1 - k.umur);
        ctx.beginPath();
        ctx.arc(k.x, k.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(123, 201, 111, ${k.umur * 0.55})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(k.x, k.y, r * 1.3, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(123, 201, 111, ${k.umur * 0.9})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  function gambarAB(ctx, p) {
    const cosR = Math.cos(p.sudutIkatan);
    const sinR = Math.sin(p.sudutIkatan);
    const off = 5;

    const xa = p.x - cosR * off;
    const ya = p.y - sinR * off;
    const xb = p.x + cosR * off;
    const yb = p.y + sinR * off;

    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(123, 201, 111, 0.18)';
    ctx.fill();

    // bola A
    ctx.beginPath();
    ctx.arc(xa, ya, 6, 0, Math.PI * 2);
    ctx.fillStyle = WARNA_A;
    ctx.fill();
    // bola B
    ctx.beginPath();
    ctx.arc(xb, yb, 6, 0, Math.PI * 2);
    ctx.fillStyle = WARNA_B;
    ctx.fill();

    // cincin
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.strokeStyle = WARNA_AB;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // ---------- Grafik Maxwell-Boltzmann ----------
  // f(v) = (v/T) * exp(-v²/(2T))  — distribusi kecepatan 2D
  function fMB(v, T) {
    return (v / T) * Math.exp(-(v * v) / (2 * T));
  }

  function gambarMB() {
    const ctx = ctxMB;
    const W = lebarMB, H = tinggiMB;
    const pad = { kiri: 40, kanan: 20, atas: 20, bawah: 40 };
    const plotW = W - pad.kiri - pad.kanan;
    const plotH = H - pad.atas - pad.bawah;

    ctx.clearRect(0, 0, W, H);

    // Sumbu
    ctx.strokeStyle = '#8A8AA3';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.kiri, pad.atas);
    ctx.lineTo(pad.kiri, pad.atas + plotH);
    ctx.lineTo(pad.kiri + plotW, pad.atas + plotH);
    ctx.stroke();

    // Grid horizontal (ringan)
    ctx.strokeStyle = '#F0F0F0';
    for (let i = 1; i <= 3; i++) {
      const y = pad.atas + (i / 4) * plotH;
      ctx.beginPath();
      ctx.moveTo(pad.kiri, y);
      ctx.lineTo(pad.kiri + plotW, y);
      ctx.stroke();
    }

    const vMax = 3.2;   // rentang kecepatan yang ditampilkan
    const yMax = 1.1;   // puncak maksimum (untuk T terkecil)

    // Konversi
    const xOf = v => pad.kiri + (v / vMax) * plotW;
    const yOf = y => pad.atas + plotH - (y / yMax) * plotH;

    // Kurva pada suhu SEKARANG
    const Tsekarang = suhuKeTsim(suhuC);

    // 1. Area di kanan batas Ea (fraksi efektif)
    ctx.beginPath();
    ctx.moveTo(xOf(VA_BATAS), pad.atas + plotH);
    for (let v = VA_BATAS; v <= vMax; v += 0.03) {
      ctx.lineTo(xOf(v), yOf(fMB(v, Tsekarang)));
    }
    ctx.lineTo(xOf(vMax), pad.atas + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.fill();

    // 2. Kurva suhu sekarang
    ctx.beginPath();
    let started = false;
    for (let v = 0; v <= vMax; v += 0.02) {
      const y = fMB(v, Tsekarang);
      const px = xOf(v), py = yOf(y);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 3. Garis batas Ea (vertikal)
    ctx.beginPath();
    ctx.moveTo(xOf(VA_BATAS), pad.atas);
    ctx.lineTo(xOf(VA_BATAS), pad.atas + plotH);
    ctx.strokeStyle = '#D9534F';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // Label "Ea"
    ctx.fillStyle = '#D9534F';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Ea', xOf(VA_BATAS), pad.atas - 4);

    // Label sumbu
    ctx.fillStyle = '#5A5A75';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Kecepatan partikel (v)', pad.kiri + plotW / 2, pad.atas + plotH + 10);

    // Label sumbu Y
    ctx.save();
    ctx.translate(14, pad.atas + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Jumlah partikel', 0, 0);
    ctx.restore();

    // Persentase efektif
    const fraksi = Math.exp(-EA_SIM / Tsekarang);   // P(E ≥ Ea) = exp(-Ea/kT)
    const persen = (fraksi * 100).toFixed(1);
    ctx.fillStyle = '#B45309';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`Partikel efektif: ${persen}%`, pad.kiri + plotW - 6, pad.atas + 6);
  }

  // ---------- Grafik Laju vs Suhu ----------
  const dataSuhu = [];    // {x: suhu, y: laju}

  function gambarGrafik() {
    const ctx = ctxGrafik;
    const W = lebarGrafik, H = tinggiGrafik;
    const pad = { kiri: 60, kanan: 25, atas: 20, bawah: 50 };
    const plotW = W - pad.kiri - pad.kanan;
    const plotH = H - pad.atas - pad.bawah;

    ctx.clearRect(0, 0, W, H);

    const maxData = dataSuhu.length ? Math.max(...dataSuhu.map(d => d.y)) : 0;
    const maxY = Math.max(3, Math.ceil(maxData * 1.2));

    // grid + label Y
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const y = pad.atas + plotH - (i / 5) * plotH;
      ctx.strokeStyle = '#EEE';
      ctx.beginPath();
      ctx.moveTo(pad.kiri, y);
      ctx.lineTo(pad.kiri + plotW, y);
      ctx.stroke();
      ctx.fillStyle = '#5A5A75';
      ctx.fillText((maxY * i / 5).toFixed(0), pad.kiri - 8, y);
    }

    // sumbu
    ctx.strokeStyle = '#8A8AA3';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.kiri, pad.atas);
    ctx.lineTo(pad.kiri, pad.atas + plotH);
    ctx.lineTo(pad.kiri + plotW, pad.atas + plotH);
    ctx.stroke();

    // label X — bucket 0, 25, 50, 75, 100 °C
    ctx.fillStyle = '#2B2B3C';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const t of BUCKET) {
      const x = pad.kiri + (t / 100) * plotW;
      ctx.fillText(t + '°C', x, pad.atas + plotH + 8);
    }
    ctx.fillText('Suhu', pad.kiri + plotW / 2, H - 22);

    // label Y
    ctx.save();
    ctx.translate(15, pad.atas + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Laju awal (reaksi/detik)', 0, 0);
    ctx.restore();

    // garis penghubung antar titik (jika ada ≥ 2 titik)
    if (dataSuhu.length >= 2) {
      const terurut = [...dataSuhu].sort((a, b) => a.x - b.x);
      ctx.beginPath();
      terurut.forEach((d, i) => {
        const x = pad.kiri + (d.x / 100) * plotW;
        const y = pad.atas + plotH - (d.y / maxY) * plotH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(255, 107, 107, 0.5)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // titik data
    dataSuhu.forEach(d => {
      const x = pad.kiri + (d.x / 100) * plotW;
      const y = pad.atas + plotH - (d.y / maxY) * plotH;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#4ECDC4';
      ctx.fill();
      ctx.strokeStyle = '#2AA79F';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#2B2B3C';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(d.y.toFixed(1), x, y - 10);
    });
  }

  // ---------- Laju ----------
  function hitungLaju() {
    return riwayat.length / (JENDELA_LAJU / 1000);
  }

  // ---------- Statistik ----------
  function hitungEnergik() {
    let n = 0, total = 0;
    for (const p of partikel) {
      if (p.jenis === 'AB') continue;
      total++;
      const v = Math.hypot(p.vx, p.vy);
      if (v >= VA_BATAS) n++;
    }
    return total === 0 ? 0 : (n / total) * 100;
  }
  function hitungSisa() {
    let n = 0;
    for (const p of partikel) if (p.jenis !== 'AB') n++;
    return n;
  }

  // ---------- Loop ----------
  let waktuSebelumnya = performance.now();
  let akumulatorUI = 0;
  let waktuSampelMulai = performance.now();
  let lajuMaksimum = 0;
  let sudahSampel = false;

  function mulaiSampelBaru() {
    waktuSampelMulai = performance.now();
    lajuMaksimum = 0;
    sudahSampel = false;
  }

  // Cari bucket terdekat dari suhuC
  function bucketTerdekat(tC) {
    let terdekat = BUCKET[0];
    let minD = Math.abs(tC - BUCKET[0]);
    for (const b of BUCKET) {
      const d = Math.abs(tC - b);
      if (d < minD) { minD = d; terdekat = b; }
    }
    return terdekat;
  }

  function loop(now) {
    const dt = Math.min(60, now - waktuSebelumnya);
    waktuSebelumnya = now;

    if (berjalan) {
      const skala = dt / 16.67;
      updatePartikel(skala);

      // countdown reset
      if (countdownReset > 0) {
        countdownReset -= skala;
        if (countdownReset <= 0) {
          countdownReset = 0;
          isiUlang();
          mulaiSampelBaru();
        }
      }

      // Rekam laju maksimum
      const lajuSaatIni = hitungLaju();
      if (lajuSaatIni > lajuMaksimum) lajuMaksimum = lajuSaatIni;

      if (!sudahSampel && (now - waktuSampelMulai) > DURASI_SAMPEL) {
        const b = bucketTerdekat(suhuC);
        const idx = dataSuhu.findIndex(d => d.x === b);
        if (idx >= 0) dataSuhu[idx].y = lajuMaksimum;
        else dataSuhu.push({ x: b, y: lajuMaksimum });
        sudahSampel = true;
      }
    }

    gambarAnimasi();
    gambarMB();
    gambarGrafik();

    // Update UI statistik
    akumulatorUI += dt;
    if (akumulatorUI > 100) {
      akumulatorUI = 0;
      statEnergik.textContent = hitungEnergik().toFixed(0) + '%';
      statEfektif.textContent = totalEfektif;
      statLaju.textContent    = hitungLaju().toFixed(1);
      statSisa.textContent    = hitungSisa();
    }

    requestAnimationFrame(loop);
  }

  // ---------- Event ----------
  btnPlay.addEventListener('click', () => {
    berjalan = !berjalan;
    btnPlay.textContent = berjalan ? '⏸ Pause' : '▶ Play';
  });

  btnReset.addEventListener('click', () => {
    dataSuhu.length = 0;
    isiUlang();
    mulaiSampelBaru();
    countdownReset = 0;
  });

  slider.addEventListener('input', () => {
    suhuC = parseInt(slider.value, 10);
    const T_K = suhuC + 273;
    labelSuhu.textContent = suhuC + ' °C';
    labelKelvin.textContent = '(' + T_K + ' K)';

    // Resample kecepatan semua partikel
    const Tsim = suhuKeTsim(suhuC);
    for (const p of partikel) {
      if (p.jenis === 'AB') continue;
      const sudut = Math.atan2(p.vy, p.vx);
      const v = sampleV(Tsim);
      p.vx = Math.cos(sudut) * v;
      p.vy = Math.sin(sudut) * v;
    }

    mulaiSampelBaru();
  });

  // ---------- Mulai ----------
  function mulai() {
    aturUkuran();
    isiUlang();
    mulaiSampelBaru();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => {
    aturUkuran();
    isiUlang();
    mulaiSampelBaru();
  });

  window.addEventListener('load', mulai);
})();
