/* ============================================================
   SIMULASI KONSENTRASI — Revisi 2
   - A + B bertumbukan → membentuk molekul AB (produk muncul)
   - AB TIDAK dapat terurai kembali (reaksi satu arah)
   - Grafik merekam "laju awal" (laju maksimum pada detik awal)
     supaya tetap bermakna meskipun reaksi nanti selesai
   ============================================================ */
(function () {

  // ---------- DOM ----------
  const cvKiri    = document.getElementById('kanvas-kiri');
  const cvKanan   = document.getElementById('kanvas-kanan');
  const cvGrafik  = document.getElementById('kanvas-grafik');
  const ctxKiri   = cvKiri.getContext('2d');
  const ctxKanan  = cvKanan.getContext('2d');
  const ctxGrafik = cvGrafik.getContext('2d');

  const btnPlay      = document.getElementById('btn-play');
  const btnReset     = document.getElementById('btn-reset');
  const sliderKons   = document.getElementById('slider-konsentrasi');
  const labelKons    = document.getElementById('label-konsentrasi');
  const judulKanan   = document.getElementById('judul-kanan');
  const totalKiriEl  = document.getElementById('total-kiri');
  const totalKananEl = document.getElementById('total-kanan');
  const lajuKiriEl   = document.getElementById('laju-kiri');
  const lajuKananEl  = document.getElementById('laju-kanan');

  // ---------- Konstanta ----------
  const WARNA_A  = '#FF6B6B';
  const WARNA_B  = '#45B7D1';
  const WARNA_AB = '#7BC96F';

  const R_A  = 6;
  const R_B  = 6;
  const R_AB = 11;         // radius "bounding" AB (untuk tumbukan)

  const KEC_MIN = 1;    // diperlambat agar animasi tidak terlalu cepat selesai
  const KEC_MAX = 2;

  const JUMLAH_DASAR = 15;       // partikel di konsentrasi 1×
  const JENDELA_LAJU = 2500;    // rolling window (ms)
  const DURASI_SAMPEL = 3000;   // rekam laju maksimum selama 3 detik pertama

  let berjalan = true;

  // ---------- Wadah ----------
  function buatWadah(canvas, ctx) {
    return {
      canvas, ctx,
      lebar: 0, tinggi: 0,
      partikel: [],
      totalEfektif: 0,
      riwayat: [],
      kilatan: [],
      konsentrasi: 1
    };
  }
  const wKiri  = buatWadah(cvKiri,  ctxKiri);
  const wKanan = buatWadah(cvKanan, ctxKanan);

  // ---------- Ukuran canvas ----------
  function aturUkuran(w) {
    const rect = w.canvas.getBoundingClientRect();
    const dpr  = window.devicePixelRatio || 1;
    w.lebar  = rect.width;
    w.tinggi = rect.height;
    w.canvas.width  = w.lebar  * dpr;
    w.canvas.height = w.tinggi * dpr;
    w.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- Pabrik partikel ----------
  function radiusDari(p) {
    if (p.jenis === 'AB') return R_AB;
    return R_A;
  }

  function buatPartikel(w, jenis) {
    const sudut = Math.random() * Math.PI * 2;
    const kec   = KEC_MIN + Math.random() * (KEC_MAX - KEC_MIN);
    return {
      x: 20 + Math.random() * Math.max(1, w.lebar - 40),
      y: 20 + Math.random() * Math.max(1, w.tinggi - 40),
      vx: Math.cos(sudut) * kec,
      vy: Math.sin(sudut) * kec,
      jenis,
      rotasi: 0,
      vRotasi: 0
    };
  }

  function buatAB(w) {
    const p = buatPartikel(w, 'AB');
    p.rotasi  = Math.random() * Math.PI * 2;
    p.vRotasi = (Math.random() - 0.5) * 0.09;
    return p;
  }

  function isiWadah(w) {
    w.partikel = [];
    w.totalEfektif = 0;
    w.riwayat = [];
    w.kilatan = [];
    const jumlah = JUMLAH_DASAR * w.konsentrasi;
    for (let i = 0; i < jumlah; i++) {
      w.partikel.push(buatPartikel(w, i % 2 === 0 ? 'A' : 'B'));
    }
  }

  // ---------- Update ----------
  function updateWadah(w, skala) {
    // 1. Gerak + pantul dinding
    for (const p of w.partikel) {
      p.x += p.vx * skala;
      p.y += p.vy * skala;
      const r = radiusDari(p);
      if (p.x - r < 0)         { p.x = r;             p.vx =  Math.abs(p.vx); }
      if (p.x + r > w.lebar)   { p.x = w.lebar - r;   p.vx = -Math.abs(p.vx); }
      if (p.y - r < 0)         { p.y = r;             p.vy =  Math.abs(p.vy); }
      if (p.y + r > w.tinggi)  { p.y = w.tinggi - r;  p.vy = -Math.abs(p.vy); }

      if (p.jenis === 'AB') {
        p.rotasi += p.vRotasi * skala;
      }
    }

    // 2. Deteksi tumbukan
    const hapus  = new Set();
    const tambah = [];

    for (let i = 0; i < w.partikel.length; i++) {
      const a = w.partikel[i];
      if (hapus.has(a)) continue;

      for (let j = i + 1; j < w.partikel.length; j++) {
        const b = w.partikel[j];
        if (hapus.has(b)) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d  = Math.hypot(dx, dy);
        const rA = radiusDari(a);
        const rB = radiusDari(b);
        const jarakMin = rA + rB;

        if (d < jarakMin && d > 0.001) {
          const pasanganAB =
            (a.jenis === 'A' && b.jenis === 'B') ||
            (a.jenis === 'B' && b.jenis === 'A');

          // A + B → AB (permanen, tidak terurai kembali)
          if (pasanganAB) {
            hapus.add(a);
            hapus.add(b);
            const ab = buatAB(w);
            ab.x = (a.x + b.x) / 2;
            ab.y = (a.y + b.y) / 2;
            ab.vx = (a.vx + b.vx) / 2;
            ab.vy = (a.vy + b.vy) / 2;
            ab.rotasi = Math.atan2(b.y - a.y, b.x - a.x);
            tambah.push(ab);
            w.totalEfektif++;
            w.riwayat.push(performance.now());
            w.kilatan.push({ x: ab.x, y: ab.y, umur: 1 });
            break;   // 'a' sudah hilang, lanjut ke partikel berikutnya
          }

          // Selain pasangan A-B → pantulan elastis biasa
          const nx = dx / d, ny = dy / d;
          const tumpang = (jarakMin - d) / 2;
          a.x -= nx * tumpang; a.y -= ny * tumpang;
          b.x += nx * tumpang; b.y += ny * tumpang;

          const p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (p > 0) {
            a.vx -= p * nx; a.vy -= p * ny;
            b.vx += p * nx; b.vy += p * ny;
          }
        }
      }
    }

    // 3. Terapkan perubahan
    if (hapus.size || tambah.length) {
      w.partikel = w.partikel.filter(p => !hapus.has(p)).concat(tambah);
    }

    // 4. Buang riwayat lama
    const batas = performance.now() - JENDELA_LAJU;
    while (w.riwayat.length && w.riwayat[0] < batas) w.riwayat.shift();

    // 5. Update efek kilatan
    for (let i = w.kilatan.length - 1; i >= 0; i--) {
      w.kilatan[i].umur -= skala * 0.03;
      if (w.kilatan[i].umur <= 0) w.kilatan.splice(i, 1);
    }
  }

  // ---------- Menggambar ----------
  function gambarBolaDasar(ctx, x, y, r, warna) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = warna;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
  }

  function gambarAB(ctx, p) {
    const cosR = Math.cos(p.rotasi);
    const sinR = Math.sin(p.rotasi);
    const off = 5;

    const xa = p.x - cosR * off;
    const ya = p.y - sinR * off;
    const xb = p.x + cosR * off;
    const yb = p.y + sinR * off;

    // halo hijau
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(123, 201, 111, 0.18)';
    ctx.fill();

    // dua bola (A dan B menyatu)
    gambarBolaDasar(ctx, xa, ya, 6, WARNA_A);
    gambarBolaDasar(ctx, xb, yb, 6, WARNA_B);

    // cincin ikatan
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.strokeStyle = WARNA_AB;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  function gambarWadah(w) {
    const ctx = w.ctx;
    ctx.clearRect(0, 0, w.lebar, w.tinggi);

    for (const p of w.partikel) {
      if (p.jenis === 'AB') {
        gambarAB(ctx, p);
      } else {
        gambarBolaDasar(ctx, p.x, p.y, R_A, p.jenis === 'A' ? WARNA_A : WARNA_B);
      }
    }

    // kilatan
    for (const k of w.kilatan) {
      const r = 8 + 22 * (1 - k.umur);
      ctx.beginPath();
      ctx.arc(k.x, k.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(123, 201, 111, ${k.umur * 0.65})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(k.x, k.y, r * 1.35, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(123, 201, 111, ${k.umur * 0.9})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // ---------- Laju ----------
  function hitungLaju(w) {
    return w.riwayat.length / (JENDELA_LAJU / 1000);
  }

  // ---------- Grafik ----------
  const dataGrafik = [];

  function gambarGrafik() {
    const c = cvGrafik;
    const ctx = ctxGrafik;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(rect.width * dpr)) {
      c.width  = rect.width  * dpr;
      c.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const W = rect.width, H = rect.height;
    const pad = { kiri: 55, kanan: 25, atas: 20, bawah: 45 };
    const plotW = W - pad.kiri - pad.kanan;
    const plotH = H - pad.atas - pad.bawah;

    ctx.clearRect(0, 0, W, H);

    const maxData = dataGrafik.length ? Math.max(...dataGrafik.map(d => d.y)) : 0;
    const maxY = Math.max(5, Math.ceil(maxData * 1.25));

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

    // label X
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#2B2B3C';
    for (let i = 1; i <= 4; i++) {
      const x = pad.kiri + (i / 4) * plotW - (plotW / 8);
      ctx.fillText(i + '×', x, pad.atas + plotH + 8);
    }
    ctx.fillText('Konsentrasi', pad.kiri + plotW / 2, H - 15);

    // label Y
    ctx.save();
    ctx.translate(15, pad.atas + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Laju awal (tumbukan/detik)', 0, 0);
    ctx.restore();

    // garis teoretis linear (sebagai pembanding)
    const ref = dataGrafik.find(d => d.x === 1);
    if (ref) {
      ctx.strokeStyle = 'rgba(255, 107, 107, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      for (let i = 1; i <= 4; i++) {
        const x = pad.kiri + ((i - 0.5) / 4) * plotW;
        const y = pad.atas + plotH - (ref.y * i / maxY) * plotH;
        if (i === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // titik data
    dataGrafik.forEach(d => {
      const x = pad.kiri + ((d.x - 0.5) / 4) * plotW;
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

  // ---------- Loop ----------
  let waktuSebelumnya   = performance.now();
  let akumulatorUI      = 0;
  let waktuSampelMulai  = performance.now();
  let lajuMaksimum      = 0;
  let sudahSampel       = false;

  function mulaiSampelBaru() {
    waktuSampelMulai = performance.now();
    lajuMaksimum = 0;
    sudahSampel = false;
  }

  function loop(now) {
    const dt = Math.min(60, now - waktuSebelumnya);
    waktuSebelumnya = now;

    if (berjalan) {
      const skala = dt / 16.67;
      updateWadah(wKiri,  skala);
      updateWadah(wKanan, skala);

      // Pelacakan laju maksimum → direkam sebagai "laju awal"
      const lajuSaatIni = hitungLaju(wKanan);
      if (lajuSaatIni > lajuMaksimum) lajuMaksimum = lajuSaatIni;

      if (!sudahSampel && (now - waktuSampelMulai) > DURASI_SAMPEL) {
        const idx = dataGrafik.findIndex(d => d.x === wKanan.konsentrasi);
        if (idx >= 0) dataGrafik[idx].y = lajuMaksimum;
        else dataGrafik.push({ x: wKanan.konsentrasi, y: lajuMaksimum });
        sudahSampel = true;
      }
    }

    gambarWadah(wKiri);
    gambarWadah(wKanan);

    // Update teks statistik
    akumulatorUI += dt;
    if (akumulatorUI > 100) {
      akumulatorUI = 0;
      totalKiriEl.textContent  = wKiri.totalEfektif;
      totalKananEl.textContent = wKanan.totalEfektif;
      lajuKiriEl.textContent   = hitungLaju(wKiri).toFixed(1);
      lajuKananEl.textContent  = hitungLaju(wKanan).toFixed(1);
    }

    gambarGrafik();
    requestAnimationFrame(loop);
  }

  // ---------- Event ----------
  btnPlay.addEventListener('click', () => {
    berjalan = !berjalan;
    btnPlay.textContent = berjalan ? '⏸ Pause' : '▶ Play';
  });

  btnReset.addEventListener('click', () => {
    dataGrafik.length = 0;
    wKiri.konsentrasi  = 1;
    wKanan.konsentrasi = parseInt(sliderKons.value, 10);
    isiWadah(wKiri);
    isiWadah(wKanan);
    mulaiSampelBaru();
  });

  sliderKons.addEventListener('input', () => {
    const nilai = parseInt(sliderKons.value, 10);
    labelKons.textContent  = nilai + '×';
    judulKanan.textContent = nilai + '×';
    wKanan.konsentrasi = nilai;
    isiWadah(wKanan);
    mulaiSampelBaru();
  });

  // ---------- Mulai ----------
  function mulai() {
    aturUkuran(wKiri);
    aturUkuran(wKanan);
    wKiri.konsentrasi  = 1;
    wKanan.konsentrasi = parseInt(sliderKons.value, 10);
    isiWadah(wKiri);
    isiWadah(wKanan);
    mulaiSampelBaru();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => {
    aturUkuran(wKiri);
    aturUkuran(wKanan);
    isiWadah(wKiri);
    isiWadah(wKanan);
    mulaiSampelBaru();
  });

  window.addEventListener('load', mulai);
})();