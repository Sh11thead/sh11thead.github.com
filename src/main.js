import './styles.css';

// ─── Pixel Canvas Animation ──────────────────────────────────────────────────
//
// Layers (back → front):
//   1. Dark sky background
//   2. Pixel grid lines (subtle)
//   3. Twinkling star field     (parallax: slowest)
//   4. Distant mountains        (parallax: slow)
//   5. Near mountains           (parallax: medium)
//   6. Ground line
//   7. Pixelated logo — scales up + fades out on scroll

const SCALE     = 4;   // canvas px per "pixel art pixel"
const LOGO_RES  = 72;  // downsample logo to this size for pixel-art look

class PixelCanvas {
  constructor(canvas, logoImg) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.frame   = 0;
    this.scrollY = 0;
    this.stars   = [];
    this.logoImg = logoImg;

    // Off-screen canvas for pixel-art downsample
    this.offCanvas        = document.createElement('canvas');
    this.offCanvas.width  = LOGO_RES;
    this.offCanvas.height = LOGO_RES;
    this.offCtx           = this.offCanvas.getContext('2d');
    this.offCtx.imageSmoothingEnabled = false;

    this.resize();
    this.initStars();

    window.addEventListener('resize', () => {
      this.resize();
      this.initStars();
    });
    window.addEventListener('scroll', () => {
      this.scrollY = window.scrollY;
    }, { passive: true });
  }

  // ── Layout ──────────────────────────────────────────────────────────────────
  resize() {
    this.canvas.width  = this.canvas.offsetWidth  || window.innerWidth;
    this.canvas.height = this.canvas.offsetHeight || window.innerHeight;
    this.cols = Math.ceil(this.canvas.width  / SCALE);
    this.rows = Math.ceil(this.canvas.height / SCALE);
  }

  initStars() {
    this.stars = Array.from({ length: 140 }, () => ({
      x:         Math.random(),
      y:         Math.random() * 0.72,
      phase:     Math.random() * Math.PI * 2,
      speed:     0.012 + Math.random() * 0.022,   // faster base sine
      size:      Math.random() < 0.18 ? 2 : 1,
      // twinkle burst state
      burstT:    0,         // countdown frames for burst
      nextBurst: Math.floor(Math.random() * 200), // frames until next burst
    }));
  }

  // ── Draw helpers ────────────────────────────────────────────────────────────
  px(x, y, color, size = 1) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x * SCALE, y * SCALE, SCALE * size, SCALE * size);
  }

  drawPixelGrid() {
    const { ctx, canvas } = this;
    ctx.strokeStyle = 'rgba(24, 24, 31, 0.9)';
    ctx.lineWidth   = 1;
    const step = SCALE * 8;
    for (let x = 0; x < canvas.width; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
  }

  drawStars() {
    const { cols, rows } = this;
    this.stars.forEach(s => {
      s.phase += s.speed;

      // Burst countdown
      if (s.burstT > 0) {
        s.burstT--;
      } else {
        s.nextBurst--;
        if (s.nextBurst <= 0) {
          s.burstT    = 3 + Math.floor(Math.random() * 4); // 3-6 frame flash
          s.nextBurst = 60 + Math.floor(Math.random() * 220);
        }
      }

      // Alpha: smooth sine base + instant burst spike
      const baseAlpha  = 0.12 + 0.45 * (0.5 + 0.5 * Math.sin(s.phase));
      const burstAlpha = s.burstT > 0 ? 0.98 : 0;
      const alpha      = Math.min(1, baseAlpha + burstAlpha);

      const rx = Math.floor(s.x * cols);
      const ry = Math.floor(s.y * rows - (this.scrollY * 0.025 / SCALE));
      if (ry < 0 || ry >= rows) return;

      // Burst stars get a +1 halo pixel for sparkle
      if (s.burstT > 0 && s.size === 2) {
        this.px(rx - 1, ry,     `rgba(255,255,220,0.35)`);
        this.px(rx + 1, ry,     `rgba(255,255,220,0.35)`);
        this.px(rx,     ry - 1, `rgba(255,255,220,0.35)`);
        this.px(rx,     ry + 1, `rgba(255,255,220,0.35)`);
      }
      this.px(rx, ry, `rgba(255,255,255,${alpha.toFixed(2)})`, s.size);
    });
  }

  mountainH(col, offset, base, a1, a2, a3) {
    const x = col + offset;
    return Math.floor(
      this.rows * base
      + Math.sin(x * 0.038) * this.rows * a1
      + Math.sin(x * 0.013) * this.rows * a2
      + Math.sin(x * 0.007) * this.rows * a3,
    );
  }

  drawMountainLayer(offset, color, base, a1, a2, a3) {
    const { cols, rows, ctx } = this;
    ctx.fillStyle = color;
    for (let col = 0; col < cols; col++) {
      const h   = Math.max(0, this.mountainH(col, offset, base, a1, a2, a3));
      const top = rows - h;
      if (top >= rows) continue;
      ctx.fillRect(col * SCALE, top * SCALE, SCALE, (rows - top) * SCALE);
    }
  }

  // ── Pixelated logo with scroll-driven scale + fade ─────────────────────────
  drawLogo() {
    if (!this.logoImg) return;

    const { ctx, canvas, scrollY } = this;
    // Animate over the full scrollable range (page bottom = t:1)
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const t         = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0;

    const alpha = 1 - t;                    // fade: 1 → 0
    if (alpha <= 0) return;

    // Base logo size: fill ~45% of canvas width (right half), capped by height
    const baseSize = Math.min(canvas.width * 0.46, canvas.height * 0.84);
    const size     = baseSize * (1 + t * 1.8); // scale: 1x → 2.8x

    // Position logo toward the right side of the canvas
    const cx = canvas.width  * 0.72;
    const cy = canvas.height * 0.50;

    // 1. Stamp logo onto tiny off-screen canvas at LOGO_RES × LOGO_RES
    this.offCtx.clearRect(0, 0, LOGO_RES, LOGO_RES);
    this.offCtx.drawImage(this.logoImg, 0, 0, LOGO_RES, LOGO_RES);

    // 2. Draw with 'screen' blend mode — black (0,0,0) pixels become invisible,
    //    coloured artwork is preserved without needing a transparent PNG.
    ctx.save();
    ctx.globalAlpha           = alpha;
    ctx.globalCompositeOperation = 'screen';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.offCanvas,
      0, 0, LOGO_RES, LOGO_RES,
      cx - size / 2, cy - size / 2,
      size, size,
    );
    ctx.restore();
  }

  // ── Main render loop ────────────────────────────────────────────────────────
  tick() {
    this.frame++;
    const { ctx, canvas, cols, rows, scrollY } = this;

    // 1 ── Clear
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2 ── Pixel grid
    this.drawPixelGrid();

    // 3 ── Stars
    this.drawStars();

    // 4 ── Distant mountains
    const farOff = scrollY * 0.038 / SCALE;
    this.drawMountainLayer(farOff, '#0d0820', 0.24, 0.06, 0.08, 0.04);

    // 5 ── Near mountains
    const nearOff = (scrollY * 0.085 / SCALE) * 1.6;
    this.drawMountainLayer(nearOff, '#08060f', 0.16, 0.04, 0.05, 0.02);

    // 6 ── Ground line
    const groundY = rows - 5;
    for (let col = 0; col < cols; col++) {
      this.px(col, groundY,     'rgba(255,77,0,0.55)');
      this.px(col, groundY + 1, 'rgba(255,77,0,0.16)');
    }

    // 7 ── Pixelated logo
    this.drawLogo();

    requestAnimationFrame(() => this.tick());
  }

  start() {
    requestAnimationFrame(() => this.tick());
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const canvas  = document.getElementById('pixel-canvas');
const logoImg = new Image();
logoImg.src   = '/julian-capital-logo.png';

function startCanvas() {
  if (!canvas || canvas._started) return;
  canvas._started = true;
  requestAnimationFrame(() => {
    const pc = new PixelCanvas(canvas, logoImg.complete ? logoImg : null);
    // Bind logo once it loads if it wasn't ready yet
    if (!logoImg.complete) {
      logoImg.onload = () => { pc.logoImg = logoImg; };
    }
    pc.start();
  });
}

// Start immediately if logo is cached, otherwise wait for it
if (logoImg.complete) {
  startCanvas();
} else {
  logoImg.onload  = startCanvas;
  // Safety fallback — start even without logo after 800 ms
  setTimeout(startCanvas, 800);
}

// ─── Scroll Reveal ───────────────────────────────────────────────────────────
const revealEls = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver(
  entries => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        observer.unobserve(e.target);
      }
    }
  },
  { threshold: 0.10, rootMargin: '0px 0px -6% 0px' },
);

revealEls.forEach((el, i) => {
  el.style.setProperty('--delay', `${i * 80}ms`);
  observer.observe(el);
});

