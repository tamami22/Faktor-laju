/* ============================================================
   ANIMASI HERO — Partikel bertumbukan di latar belakang
   ============================================================ */

(function () {
  const kanvas = document.getElementById('kanvas-hero');
  if (!kanvas) return;

  const ctx = kanvas.getContext('2d');
  let lebar, tinggi;
  let partikel = [];
  let kilatan = [];          // efek visual saat tumbukan efektif

  const WARNA_A = '#FF6B6B'; // partikel A (coral)
  const WARNA_B = '#45B7D1'; // partikel B (biru)
  const WARNA_P = '#7BC96F'; // produk AB (hijau)
  const WARNA_FLASH = 'rgba(255, 217, 61, 0.9)';

  const JUMLAH = 26;
  const RADIUS = 8;

  /* ---------- Sesuaikan ukuran kanvas dengan elemen ---------- */
  function sesuaikanUkuran() {
    const rect = kanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    lebar = rect.width;
    tinggi = rect.height;

    kanvas.width = lebar * dpr;
    kanvas.height = tinggi * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- Buat satu partikel ---------- */
  function buatPartikel(jenis) {
    const sudut = Math.random() * Math.PI * 2;
    const kecepatan = 0.35 + Math.random() * 0.5;

    return {
      x: RADIUS + Math.random() * (lebar - RADIUS * 2),
      y: RADIUS + Math.random() * (tinggi - RADIUS * 2),
      vx: Math.cos(sudut) * kecepatan,
      vy: Math.sin(sudut) * kecepatan,
      jenis: jenis,            // 'A' atau 'B'
      radius: RADIUS
    };
  }

  function inisialisasi() {
    partikel = [];
    for (let i = 0; i < JUMLAH; i++) {
      partikel.push(buatPartikel(i % 2 === 0 ? 'A' : 'B'));
    }
  }

  /* ---------- Warna berdasarkan jenis ---------- */
  function warnaPartikel(jenis) {
    if (jenis === 'A') return WARNA_A;
    if (jenis === 'B') return WARNA_B;
    return WARNA_P;
  }

  /* ---------- Pantulan terhadap dinding ---------- */
  function pantulDinding(p) {
    if (p.x - p.radius < 0) { p.x = p.radius; p.vx *= -1; }
    if (p.x + p.radius > lebar) { p.x = lebar - p.radius; p.vx *= -1; }
    if (p.y - p.radius < 0) { p.y = p.radius; p.vy *= -1; }
    if (p.y + p.radius > tinggi) { p.y = tinggi - p.radius; p.vy *= -1; }
  }

  /* ---------- Deteksi tumbukan antar partikel ---------- */
  function cekTumbukan() {
    for (let i = 0; i < partikel.length; i++) {
      for (let j = i + 1; j < partikel.length; j++) {
        const a = partikel[i];
        const b = partikel[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const jarak = Math.hypot(dx, dy);
        const jarakMin = a.radius + b.radius;

        if (jarak < jarakMin) {
          // Pertukaran kecepatan sederhana (elastis)
          const nx = dx / jarak;
          const ny = dy / jarak;
          const p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;

          if (p > 0) {
            a.vx -= p * nx;
            a.vy -= p * ny;
            b.vx += p * nx;
            b.vy += p * ny;
          }

          // Pisahkan agar tidak menempel
          const tumpang = (jarakMin - jarak) / 2;
          a.x -= nx * tumpang;
          a.y -= ny * tumpang;
          b.x += nx * tumpang;
          b.y += ny * tumpang;

          // Efek kilatan bila A bertemu B (tumbukan "berhasil")
          if (a.jenis !== b.jenis && (a.jenis === 'A' || b.jenis === 'A')) {
            kilatan.push({
              x: (a.x + b.x) / 2,
              y: (a.y + b.y) / 2,
              umur: 1
            });
          }
        }
      }
    }
  }

  /* ---------- Gambar ---------- */
  function gambar() {
    ctx.clearRect(0, 0, lebar, tinggi);

    // gambar partikel
    partikel.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = warnaPartikel(p.jenis);
      ctx.globalAlpha = 0.85;
      ctx.fill();

      // kilau putih kecil di atas
      ctx.beginPath();
      ctx.arc(p.x - 3, p.y - 3, p.radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // gambar kilatan tumbukan
    for (let i = kilatan.length - 1; i >= 0; i--) {
      const k = kilatan[i];
      ctx.beginPath();
      ctx.arc(k.x, k.y, 22 * (1 - k.umur), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 217, 61, ${k.umur * 0.5})`;
      ctx.fill();

      k.umur -= 0.04;
      if (k.umur <= 0) kilatan.splice(i, 1);
    }
  }

  /* ---------- Loop ---------- */
  function loop() {
    partikel.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      pantulDinding(p);
    });

    cekTumbukan();
    gambar();
    requestAnimationFrame(loop);
  }

  /* ---------- Mulai ---------- */
  function mulai() {
    sesuaikanUkuran();
    inisialisasi();
    loop();
  }

  window.addEventListener('resize', () => {
    sesuaikanUkuran();
    inisialisasi(); // sebar ulang agar tidak ada yang keluar batas
  });

  window.addEventListener('load', mulai);
})();
