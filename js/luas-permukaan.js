/* ============================================================
   SIMULASI LUAS PERMUKAAN BIDANG SENTUH — Versi 3
   Konsep:
   - Zat padat A (merah) tersusun rapi dalam bongkahan (posisi tetap)
   - Larutan B (biru) bergerak bebas
   - Hanya A yang TERekspos (di permukaan) bisa bereaksi
   - A + B → AB (dumbbell merah-biru) yang bergerak bebas
   - B memantul dari A (ekspos maupun tertutup) → tidak menembus
   ============================================================ */
(function () {

  // ---------- DOM ----------
  const cvKiri   = document.getElementById('kanvas-kiri');
  const cvKanan  = document.getElementById('kanvas-kanan');
  const cvGrafik = document.getElementById('kanvas-grafik');
  const ctxKiri  = cvKiri.getContext('2d');
  const ctxKanan = cvKanan.getContext('2d');
  const ctxGrafik = cvGrafik.getContext('2d');

  const btnPlay     = document.getElementById('btn-play');
  const btnReset    = document.getElementById('btn-reset');
  const sliderTkt   = document.getElementById('slider-tingkat');
  const labelTkt    = document.getElementById('label-tingkat');
  const judulKanan  = document.getElementById('judul-kanan');
  const eksposKiri  = document.getElementById('ekspos-kiri');
  const eksposKanan = document.getElementById('ekspos-kanan');
  const sisaKiriEl  = document.getElementById('sisa-kiri');
  const sisaKananEl = document.getElementById('sisa-kanan');
  const lajuKiriEl  = document.getElementById('laju-kiri');
  const lajuKananEl = document.getElementById('laju-kanan');

  // ---------- Warna ----------
  const WARNA_A          = '#FF6B6B';   // A terekspos (terang)
  const WARNA_A_TERTUTUP = '#9B2A2A';   // A tertutup (gelap)
  const WARNA_B          = '#45B7D1';
  const WARNA_AB_RING    = '#7BC96F';
  const GLOW_EKSPOS      = 'rgba(123, 201, 111, 0.55)';

  // ---------- Konstanta ----------
  const JENDELA_LAJU   = 2500;
  const DURASI_SAMPEL  = 3000;
  const COOLDOWN_CHUNK = 120;      // ms — jeda bongkahan setelah satu reaksi
  const N_B            = 40;      // jumlah partikel larutan B
  const KEC_B_MIN      = 0.55;
  const KEC_B_MAX      = 1.00;
  const HOMING_BIAS    = 0.03;    // tarikan kecil B ke A terekspos terdekat
  const R_B            = 6;
  const R_AB           = 11;

  const LEVEL = {
    1: { chunkGridSide: 1, chunkSide: 6, label: '1× (utuh)',   desk: '1 bongkah besar'   },
    2: { chunkGridSide: 2, chunkSide: 3, label: '2× (kasar)',  desk: '4 bongkah sedang'  },
    3: { chunkGridSide: 3, chunkSide: 2, label: '3× (halus)',  desk: '9 bongkah kecil'   },
    4: { chunkGridSide: 6, chunkSide: 1, label: '4× (serbuk)', desk: '36 butiran serbuk' }
  };

  let berjalan = true;

  // ---------- Wadah ----------
  function buatWadah(canvas, ctx) {
    return {
      canvas, ctx,
      lebar: 0, tinggi: 0,
      CELL: 20, R_A: 8.4,
      partikelA: [],
      partikelB: [],
      produk: [],
      kilatan: [],
      chunkCooldown: {},
      jumlahReaksi: 0,
      riwayat: [],
      level: 1
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

    // Hitung ukuran sel dan radius A berdasarkan ukuran kanvas
    const cfg = LEVEL[w.level];
    const gS = cfg.chunkGridSide;
    const cS = cfg.chunkSide;
    const footprintUnits = gS * cS + (gS - 1);
    const targetSize = Math.min(w.lebar, w.tinggi) * 0.78;
    const cellIdeal = 20;
    const cellMax = targetSize / footprintUnits;
    w.CELL = Math.min(cellIdeal, cellMax);
    w.R_A  = w.CELL * 0.42;
  }

  // ---------- Setup A (zat padat) ----------
  function isiA(w) {
    w.partikelA = [];
    w.chunkCooldown = {};
    const cfg = LEVEL[w.level];
    const gS = cfg.chunkGridSide;
    const cS = cfg.chunkSide;

    const cx = w.lebar / 2;
    const cy = w.tinggi / 2;
    const chunkSpacing = (cS + 1) * w.CELL;

    for (let a = 0; a < gS; a++) {
      for (let b = 0; b < gS; b++) {
        const chunkId = a * gS + b;
        const chunkCx = cx + (a - (gS - 1) / 2) * chunkSpacing;
        const chunkCy = cy + (b - (gS - 1) / 2) * chunkSpacing;

        for (let i = 0; i < cS; i++) {
          for (let j = 0; j < cS; j++) {
            const px = chunkCx + (i - (cS - 1) / 2) * w.CELL;
            const py = chunkCy + (j - (cS - 1) / 2) * w.CELL;
            w.partikelA.push({
              chunkId, i, j,
              cx: px, cy: py,
              hidup: true,
              ekspos: false
            });
          }
        }
      }
    }
  }

  // ---------- Setup B (larutan) ----------
  function isiB(w) {
    w.partikelB = [];
    for (let k = 0; k < N_B; k++) {
      const sudut = Math.random() * Math.PI * 2;
      const kec = KEC_B_MIN + Math.random() * (KEC_B_MAX - KEC_B_MIN);
      w.partikelB.push({
        x: 14 + Math.random() * Math.max(1, w.lebar - 28),
        y: 14 + Math.random() * Math.max(1, w.tinggi - 28),
        vx: Math.cos(sudut) * kec,
        vy: Math.sin(sudut) * kec,
        hidup: true
      });
    }
  }

  function isiWadah(w) {
    w.produk = [];
    w.kilatan = [];
    w.jumlahReaksi = 0;
    w.riwayat = [];
    aturUkuran(w);
    isiA(w);
    isiB(w);
  }

  // ---------- Hitung A terekspos ----------
  function hitungEkspos(w) {
    const peta = new Set();
    for (const a of w.partikelA) {
      if (a.hidup) peta.add(`${a.chunkId},${a.i},${a.j}`);
    }
    for (const a of w.partikelA) {
      if (!a.hidup) { a.ekspos = false; continue; }
      const atas  = peta.has(`${a.chunkId},${a.i},${a.j - 1}`);
      const bawah = peta.has(`${a.chunkId},${a.i},${a.j + 1}`);
      const kiri  = peta.has(`${a.chunkId},${a.i - 1},${a.j}`);
      const kanan = peta.has(`${a.chunkId},${a.i + 1},${a.j}`);
      a.ekspos = !(atas && bawah && kiri && kanan);
    }
  }

  // ---------- Update ----------
  function updateWadah(w, skala) {
    hitungEkspos(w);

    // Cooldown chunk
    for (const k in w.chunkCooldown) {
      if (w.chunkCooldown[k] > 0) {
        w.chunkCooldown[k] -= skala * 16.67;
        if (w.chunkCooldown[k] < 0) w.chunkCooldown[k] = 0;
      }
    }

    // Kumpulkan A yang masih terekspos (untuk homing)
    const targetEkspos = [];
    for (const a of w.partikelA) {
      if (a.hidup && a.ekspos) targetEkspos.push(a);
    }

    // ---- Gerak B (dengan homing kecil ke A terekspos) ----
    for (const b of w.partikelB) {
      if (!b.hidup) continue;

      if (targetEkspos.length > 0) {
        let terdekat = null, d2min = Infinity;
        for (const a of targetEkspos) {
          const dx = a.cx - b.x, dy = a.cy - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < d2min) { d2min = d2; terdekat = a; }
        }
        if (terdekat) {
          const dx = terdekat.cx - b.x;
          const dy = terdekat.cy - b.y;
          const d  = Math.sqrt(d2min) || 1;
          b.vx += (dx / d) * HOMING_BIAS * skala;
          b.vy += (dy / d) * HOMING_BIAS * skala;
        }
      }

      // Batasi kecepatan
      const sp = Math.hypot(b.vx, b.vy);
      const maxSp = KEC_B_MAX * 1.5;
      if (sp > maxSp) {
        b.vx = b.vx / sp * maxSp;
        b.vy = b.vy / sp * maxSp;
      }

      b.x += b.vx * skala;
      b.y += b.vy * skala;

      // Pantul dinding
      if (b.x - R_B < 0)         { b.x = R_B;             b.vx =  Math.abs(b.vx); }
      if (b.x + R_B > w.lebar)   { b.x = w.lebar - R_B;   b.vx = -Math.abs(b.vx); }
      if (b.y - R_B < 0)         { b.y = R_B;             b.vy =  Math.abs(b.vy); }
      if (b.y + R_B > w.tinggi)  { b.y = w.tinggi - R_B;  b.vy = -Math.abs(b.vy); }
    }

    // ---- Gerak produk AB ----
    for (const p of w.produk) {
      p.x += p.vx * skala * 0.7;
      p.y += p.vy * skala * 0.7;
      p.sudutIkatan += 0.02 * skala;
      if (p.x - R_AB < 0)         { p.x = R_AB;             p.vx =  Math.abs(p.vx); }
      if (p.x + R_AB > w.lebar)   { p.x = w.lebar - R_AB;   p.vx = -Math.abs(p.vx); }
      if (p.y - R_AB < 0)         { p.y = R_AB;             p.vy =  Math.abs(p.vy); }
      if (p.y + R_AB > w.tinggi)  { p.y = w.tinggi - R_AB;  p.vy = -Math.abs(p.vy); }
    }

    // ---- Deteksi tumbukan B vs A ----
    for (const b of w.partikelB) {
      if (!b.hidup) continue;

      for (const a of w.partikelA) {
        if (!a.hidup) continue;

        const dx = b.x - a.cx;
        const dy = b.y - a.cy;
        const d2 = dx * dx + dy * dy;
        const jarakMin = R_B + w.R_A;
        const jarakKuadrat = jarakMin * jarakMin;

        if (d2 < jarakKuadrat && d2 > 0.001) {
          const d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d;

          const chunkSiap = (w.chunkCooldown[a.chunkId] || 0) <= 0;

          if (a.ekspos && chunkSiap) {
            // ---- REAKSI ----
            a.hidup = false;
            b.hidup = false;

            const sudut = Math.random() * Math.PI * 2;
            w.produk.push({
              x: a.cx, y: a.cy,
              vx: Math.cos(sudut) * 0.7,
              vy: Math.sin(sudut) * 0.7,
              sudutIkatan: Math.random() * Math.PI * 2
            });

            w.jumlahReaksi++;
            w.riwayat.push(performance.now());
            w.kilatan.push({ x: a.cx, y: a.cy, umur: 1 });
            w.chunkCooldown[a.chunkId] = COOLDOWN_CHUNK;
            break;
          } else {
            // ---- Pantulan (tidak bereaksi) ----
            b.x = a.cx + nx * (jarakMin + 1);
            b.y = a.cy + ny * (jarakMin + 1);

            const vDotN = b.vx * nx + b.vy * ny;
            if (vDotN < 0) {
              b.vx -= 2 * vDotN * nx;
              b.vy -= 2 * vDotN * ny;
            }
          }
        }
      }
    }

    // Hapus B yang sudah mati
    w.partikelB = w.partikelB.filter(b => b.hidup);

    // Trim riwayat
    const batas = performance.now() - JENDELA_LAJU;
    while (w.riwayat.length && w.riwayat[0] < batas) w.riwayat.shift();

    // Update kilatan
    for (let i = w.kilatan.length - 1; i >= 0; i--) {
      w.kilatan[i].umur -= skala * 0.025;
      if (w.kilatan[i].umur <= 0) w.kilatan.splice(i, 1);
    }
  }

  // ---------- Menggambar ----------
  function gambarWadah(w) {
    const ctx = w.ctx;
    ctx.clearRect(0, 0, w.lebar, w.tinggi);

    // 1. Partikel A (merah, tersusun rapi)
    for (const a of w.partikelA) {
      if (!a.hidup) continue;
      const r = w.R_A;

      // Glow hijau untuk A terekspos
      if (a.ekspos) {
        ctx.beginPath();
        ctx.arc(a.cx, a.cy, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = GLOW_EKSPOS;
        ctx.fill();
      }

      // Badan partikel A
      ctx.beginPath();
      ctx.arc(a.cx, a.cy, r, 0, Math.PI * 2);
      ctx.fillStyle = a.ekspos ? WARNA_A : WARNA_A_TERTUTUP;
      ctx.fill();

      // Highlight kecil
      ctx.beginPath();
      ctx.arc(a.cx - r * 0.3, a.cy - r * 0.3, r * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = a.ekspos
        ? 'rgba(255, 255, 255, 0.6)'
        : 'rgba(255, 255, 255, 0.15)';
      ctx.fill();

      // Cincin tipis untuk yang terekspos
      if (a.ekspos) {
        ctx.beginPath();
        ctx.arc(a.cx, a.cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#4C9A3F';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // 2. Produk AB
    for (const p of w.produk) {
      gambarAB(ctx, p);
    }

    // 3. Partikel B (biru, bergerak)
    for (const b of w.partikelB) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, R_B, 0, Math.PI * 2);
      ctx.fillStyle = WARNA_B;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x - 1.5, b.y - 1.5, R_B * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fill();
    }

    // 4. Kilatan reaksi
    for (const k of w.kilatan) {
      const r = 6 + 22 * (1 - k.umur);
      ctx.beginPath();
      ctx.arc(k.x, k.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(123, 201, 111, ${k.umur * 0.55})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(k.x, k.y, r * 1.35, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(123, 201, 111, ${k.umur * 0.9})`;
      ctx.lineWidth = 2;
      ctx.stroke();
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

    // Halo hijau
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(123, 201, 111, 0.18)';
    ctx.fill();

    // Bola A (merah)
    ctx.beginPath();
    ctx.arc(xa, ya, 6, 0, Math.PI * 2);
    ctx.fillStyle = WARNA_A;
    ctx.fill();

    // Bola B (biru)
    ctx.beginPath();
    ctx.arc(xb, yb, 6, 0, Math.PI * 2);
    ctx.fillStyle = WARNA_B;
    ctx.fill();

    // Cincin ikatan
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.strokeStyle = WARNA_AB_RING;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // ---------- Statistik ----------
  function hitungLaju(w) {
    return w.riwayat.length / (JENDELA_LAJU / 1000);
  }
  function hitungSisaA(w) {
    let n = 0;
    for (const a of w.partikelA) if (a.hidup) n++;
    return n;
  }
  function hitungEksposAktif(w) {
    let n = 0;
    for (const a of w.partikelA) if (a.hidup && a.ekspos) n++;
    return n;
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
    const pad = { kiri: 55, kanan: 25, atas: 20, bawah: 50 };
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

    ctx.strokeStyle = '#8A8AA3';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.kiri, pad.atas);
    ctx.lineTo(pad.kiri, pad.atas + plotH);
    ctx.lineTo(pad.kiri + plotW, pad.atas + plotH);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#2B2B3C';
    ctx.font = '12px sans-serif';
    const labelX = ['1×', '2×', '3×', '4×'];
    for (let i = 1; i <= 4; i++) {
      const x = pad.kiri + ((i - 0.5) / 4) * plotW;
      ctx.fillText(labelX[i - 1], x, pad.atas + plotH + 8);
    }
    ctx.fillText('Tingkat penghalusan', pad.kiri + plotW / 2, H - 22);

    ctx.save();
    ctx.translate(15, pad.atas + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Laju awal (reaksi/detik)', 0, 0);
    ctx.restore();

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

  function loop(now) {
    const dt = Math.min(60, now - waktuSebelumnya);
    waktuSebelumnya = now;

    if (berjalan) {
      const skala = dt / 16.67;
      updateWadah(wKiri,  skala);
      updateWadah(wKanan, skala);

      const lajuSaatIni = hitungLaju(wKanan);
      if (lajuSaatIni > lajuMaksimum) lajuMaksimum = lajuSaatIni;

      if (!sudahSampel && (now - waktuSampelMulai) > DURASI_SAMPEL) {
        const idx = dataGrafik.findIndex(d => d.x === wKanan.level);
        if (idx >= 0) dataGrafik[idx].y = lajuMaksimum;
        else dataGrafik.push({ x: wKanan.level, y: lajuMaksimum });
        sudahSampel = true;
      }
    }

    gambarWadah(wKiri);
    gambarWadah(wKanan);

    akumulatorUI += dt;
    if (akumulatorUI > 100) {
      akumulatorUI = 0;
      sisaKiriEl.textContent  = hitungSisaA(wKiri);
      sisaKananEl.textContent = hitungSisaA(wKanan);
      lajuKiriEl.textContent  = hitungLaju(wKiri).toFixed(1);
      lajuKananEl.textContent = hitungLaju(wKanan).toFixed(1);
      eksposKiri.textContent  = hitungEksposAktif(wKiri);
      eksposKanan.textContent = hitungEksposAktif(wKanan);
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
    wKiri.level = 1;
    wKanan.level = parseInt(sliderTkt.value, 10);
    isiWadah(wKiri);
    isiWadah(wKanan);
    mulaiSampelBaru();
  });

  sliderTkt.addEventListener('input', () => {
    const nilai = parseInt(sliderTkt.value, 10);
    labelTkt.textContent = LEVEL[nilai].label;
    judulKanan.textContent = LEVEL[nilai].desk;
    wKanan.level = nilai;
    isiWadah(wKanan);
    mulaiSampelBaru();
  });

  // ---------- Mulai ----------
  function mulai() {
    wKiri.level = 1;
    wKanan.level = parseInt(sliderTkt.value, 10);
    isiWadah(wKiri);
    isiWadah(wKanan);
    mulaiSampelBaru();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => {
    isiWadah(wKiri);
    isiWadah(wKanan);
    mulaiSampelBaru();
  });

  window.addEventListener('load', mulai);
})();
