/* ============================================================
   SIMULASI KATALIS — Mekanisme Adsorpsi Permukaan (Katalis Bergerak)
   ============================================================ */
(function () {

  // ---------- DOM ----------
  const cvTanpa   = document.getElementById('kanvas-tanpa');
  const cvDengan  = document.getElementById('kanvas-dengan');
  const cvEnergi  = document.getElementById('kanvas-energi');
  const ctxTanpa  = cvTanpa.getContext('2d');
  const ctxDengan = cvDengan.getContext('2d');
  const ctxEnergi = cvEnergi.getContext('2d');

  const btnPlay   = document.getElementById('btn-play');
  const btnReset  = document.getElementById('btn-reset');
  const sliderKecepatan = document.getElementById('slider-kecepatan');
  const labelKecepatan  = document.getElementById('label-kecepatan');

  const lajuTanpaEl   = document.getElementById('laju-tanpa');
  const lajuDenganEl  = document.getElementById('laju-dengan');
  const totalTanpaEl  = document.getElementById('total-tanpa');
  const totalDenganEl = document.getElementById('total-dengan');

  // ---------- Konstanta ----------
  const WARNA_A  = '#FF6B6B';
  const WARNA_B  = '#45B7D1';
  const WARNA_AB = '#7BC96F';
  const WARNA_KATALIS = '#E74C3C';

  const R_PARTIKEL = 7;
  const N_A = 16;
  const N_B = 16;

  const KEC_MIN = 0.55;
  const KEC_MAX = 1.05;
  const JENDELA_LAJU = 3000;

  const EA_TANPA = 1.55;

  const RADIUS_KATALIS = 34;
  const JARAK_ADSORPSI = 8;
  const DURASI_ADSORPSI = 300;
  const COOLDOWN_KATALIS = 500;
  const KEC_KATALIS = 0.15;

  let berjalan = true;
  let faktorKecepatan = 1.0;

  // ---------- Wadah ----------
  function buatWadah(canvas, ctx, punyaKatalis) {
    return {
      canvas: canvas,
      ctx: ctx,
      lebar: 0,
      tinggi: 0,
      partikel: [],
      katalis: [],
      punyaKatalis: punyaKatalis,
      totalReaksi: 0,
      riwayat: [],
      kilatan: [],
      gagal: []
    };
  }
  const wTanpa  = buatWadah(cvTanpa,  ctxTanpa,  false);
  const wDengan = buatWadah(cvDengan, ctxDengan, true);

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

  // ---------- Katalis ----------
  function buatKatalis(w) {
    w.katalis = [];
    if (!w.punyaKatalis) return;

    const cx = w.lebar / 2;
    const cy = w.tinggi / 2;
    const offset = Math.min(w.lebar, w.tinggi) * 0.20;

    const posisiAwal = [
      { x: cx,           y: cy - offset        },
      { x: cx - offset,  y: cy + offset * 0.7  },
      { x: cx + offset,  y: cy + offset * 0.7  }
    ];

    for (let i = 0; i < posisiAwal.length; i++) {
      const pos = posisiAwal[i];
      const sudut = Math.random() * Math.PI * 2;
      w.katalis.push({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(sudut) * KEC_KATALIS,
        vy: Math.sin(sudut) * KEC_KATALIS,
        radius: RADIUS_KATALIS,
        cooldown: 0,
        faseGetar: Math.random() * Math.PI * 2
      });
    }
  }

  // ---------- Partikel ----------
  function buatPartikel(w, jenis) {
    const sudut = Math.random() * Math.PI * 2;
    const kec = KEC_MIN + Math.random() * (KEC_MAX - KEC_MIN);
    return {
      x: 20 + Math.random() * Math.max(1, w.lebar - 40),
      y: 20 + Math.random() * Math.max(1, w.tinggi - 40),
      vx: Math.cos(sudut) * kec,
      vy: Math.sin(sudut) * kec,
      jenis: jenis,
      energi: 0.3 + Math.random() * 0.7,
      status: 'bebas',
      katalisInduk: null,
      sudutIkatan: 0,
      waktuAdsorpsi: 0,
      offsetX: 0,
      offsetY: 0
    };
  }

  function isiWadah(w) {
    w.partikel = [];
    w.totalReaksi = 0;
    w.riwayat = [];
    w.kilatan = [];
    w.gagal = [];

    buatKatalis(w);

    for (let i = 0; i < N_A; i++) w.partikel.push(buatPartikel(w, 'A'));
    for (let i = 0; i < N_B; i++) w.partikel.push(buatPartikel(w, 'B'));
  }

  // ---------- Utilitas katalis ----------
  function diDalamKatalis(px, py, k) {
    const dx = px - k.x;
    const dy = py - k.y;
    return Math.sqrt(dx * dx + dy * dy) < k.radius + R_PARTIKEL;
  }

  function posisiAdsorpsi(k, partikelLain) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const sudut = Math.random() * Math.PI * 2;
      const px = k.x + Math.cos(sudut) * (k.radius + JARAK_ADSORPSI);
      const py = k.y + Math.sin(sudut) * (k.radius + JARAK_ADSORPSI);

      let ok = true;
      for (let n = 0; n < partikelLain.length; n++) {
        const other = partikelLain[n];
        if (other.status !== 'teradsorpsi') continue;
        const dx = px - other.x;
        const dy = py - other.y;
        if (dx * dx + dy * dy < (R_PARTIKEL * 2.4) * (R_PARTIKEL * 2.4)) {
          ok = false;
          break;
        }
      }
      if (ok) return { x: px, y: py, sudut: sudut };
    }
    const sudut = Math.random() * Math.PI * 2;
    return {
      x: k.x + Math.cos(sudut) * (k.radius + JARAK_ADSORPSI),
      y: k.y + Math.sin(sudut) * (k.radius + JARAK_ADSORPSI),
      sudut: sudut
    };
  }

  // ============================================================
  //  UPDATE
  // ============================================================
  function updateWadah(w, skala, waktuSekarang) {

    // 0. Gerak katalis
    for (let i = 0; i < w.katalis.length; i++) {
      const k = w.katalis[i];
      k.x += k.vx * skala * faktorKecepatan;
      k.y += k.vy * skala * faktorKecepatan;

      if (k.x - k.radius < 0)        { k.x = k.radius;             k.vx =  Math.abs(k.vx); }
      if (k.x + k.radius > w.lebar)  { k.x = w.lebar - k.radius;   k.vx = -Math.abs(k.vx); }
      if (k.y - k.radius < 0)        { k.y = k.radius;             k.vy =  Math.abs(k.vy); }
      if (k.y + k.radius > w.tinggi) { k.y = w.tinggi - k.radius;  k.vy = -Math.abs(k.vy); }
    }

    // Partikel yang menempel ikut katalis
    for (let i = 0; i < w.partikel.length; i++) {
      const p = w.partikel[i];
      if (p.status === 'teradsorpsi' && p.katalisInduk) {
        p.x = p.katalisInduk.x + p.offsetX;
        p.y = p.katalisInduk.y + p.offsetY;
      }
    }

    // 1. Gerak partikel bebas
    for (let i = 0; i < w.partikel.length; i++) {
      const p = w.partikel[i];
      if (p.jenis === 'AB') p.sudutIkatan += 0.02 * skala;
      if (p.status === 'teradsorpsi') continue;

      p.x += p.vx * skala * faktorKecepatan;
      p.y += p.vy * skala * faktorKecepatan;

      if (p.x - R_PARTIKEL < 0)        { p.x = R_PARTIKEL;            p.vx =  Math.abs(p.vx); }
      if (p.x + R_PARTIKEL > w.lebar)  { p.x = w.lebar - R_PARTIKEL;  p.vx = -Math.abs(p.vx); }
      if (p.y - R_PARTIKEL < 0)        { p.y = R_PARTIKEL;            p.vy =  Math.abs(p.vy); }
      if (p.y + R_PARTIKEL > w.tinggi) { p.y = w.tinggi - R_PARTIKEL; p.vy = -Math.abs(p.vy); }
    }

    // 2. Update cooldown katalis
    for (let i = 0; i < w.katalis.length; i++) {
      const k = w.katalis[i];
      if (k.cooldown > 0) k.cooldown -= skala * 16.67;
    }

    // 3. Adsorpsi
    if (w.punyaKatalis) {
      for (let i = 0; i < w.partikel.length; i++) {
        const p = w.partikel[i];
        if (p.status !== 'bebas') continue;
        if (p.jenis === 'AB') continue;

        for (let j = 0; j < w.katalis.length; j++) {
          const k = w.katalis[j];
          if (k.cooldown > 0) continue;
          if (diDalamKatalis(p.x, p.y, k)) {
            const pos = posisiAdsorpsi(k, w.partikel);
            p.x = pos.x;
            p.y = pos.y;
            p.status = 'teradsorpsi';
            p.katalisInduk = k;
            p.waktuAdsorpsi = waktuSekarang;
            p.offsetX = p.x - k.x;
            p.offsetY = p.y - k.y;
            p.vx = 0;
            p.vy = 0;
            break;
          }
        }
      }
    }

    // 4. Reaksi di permukaan katalis
    if (w.punyaKatalis) {
      for (let j = 0; j < w.katalis.length; j++) {
        const k = w.katalis[j];
        if (k.cooldown > 0) continue;

        let a = null;
        let b = null;
        for (let i = 0; i < w.partikel.length; i++) {
          const p = w.partikel[i];
          if (p.status !== 'teradsorpsi') continue;
          if (p.katalisInduk !== k) continue;
          if (waktuSekarang - p.waktuAdsorpsi < DURASI_ADSORPSI) continue;
          if (p.jenis === 'A' && !a) a = p;
          if (p.jenis === 'B' && !b) b = p;
        }

        if (a && b) {
          const ab = {
            x: k.x,
            y: k.y,
            vx: (Math.random() - 0.5) * 1.2,
            vy: (Math.random() - 0.5) * 1.2,
            jenis: 'AB',
            energi: 0.5,
            status: 'bebas',
            katalisInduk: null,
            sudutIkatan: Math.random() * Math.PI * 2,
            waktuAdsorpsi: 0,
            offsetX: 0,
            offsetY: 0
          };

          w.partikel = w.partikel.filter(function (p) { return p !== a && p !== b; });
          w.partikel.push(ab);

          w.totalReaksi++;
          w.riwayat.push(performance.now());
          w.kilatan.push({ x: k.x, y: k.y, umur: 1 });
          k.cooldown = COOLDOWN_KATALIS;
        }
      }
    }

    // 5. Reaksi langsung tanpa katalis
    if (!w.punyaKatalis) {
      const hapus = new Set();
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
          const jarakMin = R_PARTIKEL * 2;

          if (d < jarakMin && d > 0.001) {
            const pasanganAB =
              (a.jenis === 'A' && b.jenis === 'B') ||
              (a.jenis === 'B' && b.jenis === 'A');

            if (pasanganAB) {
              const totalEnergi = a.energi + b.energi;
              if (totalEnergi >= EA_TANPA) {
                hapus.add(a);
                hapus.add(b);
                tambah.push({
                  x: (a.x + b.x) / 2,
                  y: (a.y + b.y) / 2,
                  vx: (a.vx + b.vx) / 2,
                  vy: (a.vy + b.vy) / 2,
                  jenis: 'AB',
                  energi: 0.5,
                  status: 'bebas',
                  katalisInduk: null,
                  sudutIkatan: Math.atan2(b.y - a.y, b.x - a.x),
                  waktuAdsorpsi: 0,
                  offsetX: 0,
                  offsetY: 0
                });
                w.totalReaksi++;
                w.riwayat.push(performance.now());
                w.kilatan.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, umur: 1 });
                break;
              } else {
                w.gagal.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, umur: 1 });
              }
            }

            const nx = dx / d;
            const ny = dy / d;
            const tumpang = (jarakMin - d) / 2;
            a.x -= nx * tumpang; a.y -= ny * tumpang;
            b.x += nx * tumpang; b.y += ny * tumpang;
            const pv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (pv > 0) {
              a.vx -= pv * nx; a.vy -= pv * ny;
              b.vx += pv * nx; b.vy += pv * ny;
            }
          }
        }
      }

      if (hapus.size || tambah.length) {
        w.partikel = w.partikel.filter(function (p) { return !hapus.has(p); }).concat(tambah);
      }
    }

    // 6. Trim riwayat
    const batas = performance.now() - JENDELA_LAJU;
    while (w.riwayat.length && w.riwayat[0] < batas) w.riwayat.shift();

    // 7. Update efek
    for (let i = w.kilatan.length - 1; i >= 0; i--) {
      w.kilatan[i].umur -= skala * 0.03;
      if (w.kilatan[i].umur <= 0) w.kilatan.splice(i, 1);
    }
    for (let i = w.gagal.length - 1; i >= 0; i--) {
      w.gagal[i].umur -= skala * 0.05;
      if (w.gagal[i].umur <= 0) w.gagal.splice(i, 1);
    }
  }

  // ============================================================
  //  GAMBAR
  // ============================================================
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

    ctx.beginPath();
    ctx.arc(xa, ya, 6, 0, Math.PI * 2);
    ctx.fillStyle = WARNA_A;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(xb, yb, 6, 0, Math.PI * 2);
    ctx.fillStyle = WARNA_B;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.strokeStyle = WARNA_AB;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  function gambarWadah(w) {
    const ctx = w.ctx;
    ctx.clearRect(0, 0, w.lebar, w.tinggi);

    // Katalis
    for (let i = 0; i < w.katalis.length; i++) {
      const k = w.katalis[i];

      if (k.cooldown <= 0) {
        const g = ctx.createRadialGradient(k.x, k.y, k.radius * 0.6, k.x, k.y, k.radius + 10);
        g.addColorStop(0, 'rgba(231, 76, 60, 0.25)');
        g.addColorStop(1, 'rgba(231, 76, 60, 0)');
        ctx.beginPath();
        ctx.arc(k.x, k.y, k.radius + 10, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      ctx.beginPath();
      const nTitik = 12;
      for (let t = 0; t <= nTitik; t++) {
        const a = (t / nTitik) * Math.PI * 2;
        const r = k.radius * (0.85 + 0.15 * Math.sin(a * 3 + k.faseGetar));
        const px = k.x + Math.cos(a) * r;
        const py = k.y + Math.sin(a) * r;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = k.cooldown > 0 ? 'rgba(231, 76, 60, 0.5)' : WARNA_KATALIS;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(k.x, k.y, k.radius * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Katalis', k.x, k.y);
    }

    // Partikel
    for (let i = 0; i < w.partikel.length; i++) {
      const p = w.partikel[i];

      if (p.jenis === 'AB') {
        gambarAB(ctx, p);
        continue;
      }

      const alpha = 0.4 + 0.6 * p.energi;
      const warnaDasar = p.jenis === 'A'
        ? 'rgba(255, 107, 107, ' + alpha + ')'
        : 'rgba(69, 183, 209, ' + alpha + ')';

      if (p.energi > 0.6) {
        const g = ctx.createRadialGradient(p.x, p.y, R_PARTIKEL * 0.4, p.x, p.y, R_PARTIKEL + 5);
        g.addColorStop(0, 'rgba(251, 191, 36, ' + ((p.energi - 0.4) * 0.7) + ')');
        g.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.beginPath();
        ctx.arc(p.x, p.y, R_PARTIKEL + 5, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      if (p.status === 'teradsorpsi') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, R_PARTIKEL + 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, R_PARTIKEL, 0, Math.PI * 2);
      ctx.fillStyle = warnaDasar;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x - 2, p.y - 2, R_PARTIKEL * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.4 + 0.35 * p.energi) + ')';
      ctx.fill();
    }

    // Efek tumbukan gagal
    for (let i = 0; i < w.gagal.length; i++) {
      const g = w.gagal[i];
      const r = 4 + 8 * (1 - g.umur);
      ctx.beginPath();
      ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(148, 163, 184, ' + (g.umur * 0.7) + ')';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Kilatan reaksi
    for (let i = 0; i < w.kilatan.length; i++) {
      const k = w.kilatan[i];
      const r = 10 + 28 * (1 - k.umur);
      ctx.beginPath();
      ctx.arc(k.x, k.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(123, 201, 111, ' + (k.umur * 0.5) + ')';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(k.x, k.y, r * 1.3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(123, 201, 111, ' + (k.umur * 0.9) + ')';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  // ---------- Laju ----------
  function hitungLaju(w) {
    return w.riwayat.length / (JENDELA_LAJU / 1000);
  }

  // ---------- Diagram Profil Energi ----------
  function gambarEnergi() {
    const c = cvEnergi;
    const ctx = ctxEnergi;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(rect.width * dpr)) {
      c.width  = rect.width  * dpr;
      c.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const W = rect.width;
    const H = rect.height;
    const pad = { kiri: 70, kanan: 40, atas: 40, bawah: 60 };
    const plotW = W - pad.kiri - pad.kanan;
    const plotH = H - pad.atas - pad.bawah;

    ctx.clearRect(0, 0, W, H);

    const maxE = 10;
    function yOf(e) { return pad.atas + plotH - (e / maxE) * plotH; }

    ctx.strokeStyle = '#8A8AA3';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.kiri, pad.atas);
    ctx.lineTo(pad.kiri, pad.atas + plotH);
    ctx.lineTo(pad.kiri + plotW, pad.atas + plotH);
    ctx.stroke();

    ctx.fillStyle = '#2B2B3C';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Koordinat Reaksi', pad.kiri + plotW / 2, pad.atas + plotH + 28);

    ctx.save();
    ctx.translate(22, pad.atas + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Energi', 0, 0);
    ctx.restore();

    const E_REAKTAN = 3;
    const E_PRODUK  = 1.8;
    const E_PUNCAK_TANPA  = 8.5;
    const E_PUNCAK_DENGAN = 5.5;

    const x0 = pad.kiri + 10;
    const x1 = pad.kiri + plotW - 10;
    const xPuncakTanpa  = pad.kiri + plotW * 0.35;
    const xPuncakDengan = pad.kiri + plotW * 0.55;
    const xAntaraDengan = pad.kiri + plotW * 0.30;

    ctx.strokeStyle = '#DDD';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, yOf(E_REAKTAN));
    ctx.lineTo(x1, yOf(E_REAKTAN));
    ctx.moveTo(x0, yOf(E_PRODUK));
    ctx.lineTo(x1, yOf(E_PRODUK));
    ctx.stroke();
    ctx.setLineDash([]);

    // Kurva tanpa katalis
    ctx.beginPath();
    ctx.moveTo(x0, yOf(E_REAKTAN));
    ctx.bezierCurveTo(x0 + 30, yOf(E_REAKTAN), xPuncakTanpa - 40, yOf(E_PUNCAK_TANPA), xPuncakTanpa, yOf(E_PUNCAK_TANPA));
    ctx.bezierCurveTo(xPuncakTanpa + 40, yOf(E_PUNCAK_TANPA), x1 - 50, yOf(E_PRODUK), x1, yOf(E_PRODUK));
    ctx.strokeStyle = '#E74C3C';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Kurva dengan katalis
    ctx.beginPath();
    ctx.moveTo(x0, yOf(E_REAKTAN));
    ctx.bezierCurveTo(x0 + 20, yOf(E_REAKTAN), xAntaraDengan - 20, yOf(E_PUNCAK_DENGAN), xAntaraDengan, yOf(E_PUNCAK_DENGAN));
    ctx.bezierCurveTo(xAntaraDengan + 20, yOf(E_PUNCAK_DENGAN), xPuncakDengan - 20, yOf(E_PUNCAK_DENGAN - 0.2), xPuncakDengan, yOf(E_PUNCAK_DENGAN - 0.2));
    ctx.bezierCurveTo(xPuncakDengan + 20, yOf(E_PUNCAK_DENGAN - 0.2), x1 - 50, yOf(E_PRODUK), x1, yOf(E_PRODUK));
    ctx.strokeStyle = '#27AE60';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Ea tanpa katalis
    const xEaTanpa = pad.kiri + plotW * 0.08;
    ctx.strokeStyle = '#E74C3C';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xEaTanpa, yOf(E_REAKTAN));
    ctx.lineTo(xEaTanpa, yOf(E_PUNCAK_TANPA));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xEaTanpa - 5, yOf(E_PUNCAK_TANPA) + 8);
    ctx.lineTo(xEaTanpa, yOf(E_PUNCAK_TANPA));
    ctx.lineTo(xEaTanpa + 5, yOf(E_PUNCAK_TANPA) + 8);
    ctx.fillStyle = '#E74C3C';
    ctx.fill();
    ctx.fillStyle = '#E74C3C';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Ea tanpa katalis', xEaTanpa + 8, (yOf(E_REAKTAN) + yOf(E_PUNCAK_TANPA)) / 2);

    // Ea dengan katalis
    const xEaDengan = pad.kiri + plotW * 0.24;
    ctx.strokeStyle = '#27AE60';
    ctx.beginPath();
    ctx.moveTo(xEaDengan, yOf(E_REAKTAN));
    ctx.lineTo(xEaDengan, yOf(E_PUNCAK_DENGAN));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xEaDengan - 5, yOf(E_PUNCAK_DENGAN) + 8);
    ctx.lineTo(xEaDengan, yOf(E_PUNCAK_DENGAN));
    ctx.lineTo(xEaDengan + 5, yOf(E_PUNCAK_DENGAN) + 8);
    ctx.fillStyle = '#27AE60';
    ctx.fill();
    ctx.fillStyle = '#27AE60';
    ctx.textAlign = 'left';
    ctx.fillText('Ea dengan katalis', xEaDengan + 8, (yOf(E_REAKTAN) + yOf(E_PUNCAK_DENGAN)) / 2 + 12);

    // ΔH
    const xDH = pad.kiri + plotW - 20;
    ctx.strokeStyle = '#8E44AD';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xDH, yOf(E_REAKTAN));
    ctx.lineTo(xDH, yOf(E_PRODUK));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xDH - 4, yOf(E_REAKTAN) + 6);
    ctx.lineTo(xDH, yOf(E_REAKTAN));
    ctx.lineTo(xDH + 4, yOf(E_REAKTAN) + 6);
    ctx.fillStyle = '#8E44AD';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(xDH - 4, yOf(E_PRODUK) - 6);
    ctx.lineTo(xDH, yOf(E_PRODUK));
    ctx.lineTo(xDH + 4, yOf(E_PRODUK) - 6);
    ctx.fill();
    ctx.fillStyle = '#8E44AD';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('ΔH', xDH - 10, (yOf(E_REAKTAN) + yOf(E_PRODUK)) / 2);

    ctx.fillStyle = '#2B2B3C';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Reaktan (A + B)', x0, yOf(E_REAKTAN) - 22);
    ctx.textAlign = 'right';
    ctx.fillText('Produk (AB)', x1, yOf(E_PRODUK) - 22);

    ctx.fillStyle = '#8E44AD';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('(reaksi eksoterm)', x1, yOf(E_PRODUK) - 8);
  }

  // ---------- Loop ----------
  let waktuSebelumnya = performance.now();
  let akumulatorUI = 0;

  function loop(now) {
    const dt = Math.min(60, now - waktuSebelumnya);
    waktuSebelumnya = now;

    if (berjalan) {
      const skala = dt / 16.67;
      updateWadah(wTanpa,  skala, now);
      updateWadah(wDengan, skala, now);
    }

    gambarWadah(wTanpa);
    gambarWadah(wDengan);
    gambarEnergi();

    akumulatorUI += dt;
    if (akumulatorUI > 100) {
      akumulatorUI = 0;
      lajuTanpaEl.textContent   = hitungLaju(wTanpa).toFixed(1);
      lajuDenganEl.textContent  = hitungLaju(wDengan).toFixed(1);
      totalTanpaEl.textContent  = wTanpa.totalReaksi;
      totalDenganEl.textContent = wDengan.totalReaksi;
    }

    requestAnimationFrame(loop);
  }

  // ---------- Event ----------
  btnPlay.addEventListener('click', function () {
    berjalan = !berjalan;
    btnPlay.textContent = berjalan ? '⏸ Pause' : '▶ Play';
  });

  btnReset.addEventListener('click', function () {
    isiWadah(wTanpa);
    isiWadah(wDengan);
  });

  sliderKecepatan.addEventListener('input', function () {
    const v = parseInt(sliderKecepatan.value, 10) / 10;
    faktorKecepatan = v;
    labelKecepatan.textContent = v.toFixed(1).replace('.', ',') + '×';
  });

  // ---------- Mulai ----------
  function mulai() {
    aturUkuran(wTanpa);
    aturUkuran(wDengan);
    isiWadah(wTanpa);
    isiWadah(wDengan);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', function () {
    aturUkuran(wTanpa);
    aturUkuran(wDengan);
    isiWadah(wTanpa);
    isiWadah(wDengan);
  });

  window.addEventListener('load', mulai);
})();
