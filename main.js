import { LiquidGlassEngine } from './glass.js';

// Liquid Glass: attach the same small engine to each selected control.
function initLiquidControls() {
  document.querySelectorAll('[data-liquid], .button-ghost, .atom-select, .main-nav a, #mobileMenuToggle').forEach((element) => {
    if (element.dataset.liquidReady === 'true') return;
    const cssRadius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 8;
    const engine = new LiquidGlassEngine(element, {
      material: 'regular',
      borderRadius: cssRadius,
      blur: 2.5,
      saturation: 1.5,
      refractionStrength: 11,
      bezelWidth: 20,
      chromaticAberration: 0.27,
      lightAngle: 49,
      appearance: 'dark',
      dynamicLighting: true,
    });
    engine.enableLiquidPress({ scale: 0.92, squish: 0.03 });
    element.dataset.liquidReady = 'true';
  });
}

initLiquidControls();

// Back-to-top links always return to the actual top of the document.
document.querySelectorAll('a[href="#top"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, left: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    if (window.location.hash) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  });
});

// Mobile navigation.
const menuToggle = document.querySelector('#mobileMenuToggle');
const mainNav = document.querySelector('#mainNav');
menuToggle?.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Đóng menu' : 'Mở menu');
});
mainNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
});

// Subtle reveal-on-scroll.
const revealTargets = document.querySelectorAll('.section-heading, .fact-card, .timeline-item, .life-card, .application-card, .environment-card, .cycle-card, .video-frame');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealTargets.forEach((el) => {
    el.classList.add('reveal');
    revealObserver.observe(el);
  });
}

// ---------------------------------------------------------------------------
// Interactive Nitrogen atom. This is a small self-contained 3D projection
// renderer using Canvas 2D: no WebGL, Three.js, import map or external CDN.
// Positions are stored in XYZ space and projected with perspective, so users
// can rotate the atom, zoom, and select the individual particles.
// ---------------------------------------------------------------------------
const stage = document.querySelector('#atomStage');
const loading3d = document.querySelector('#loading3d');
const infoTitle = document.querySelector('#atomInfoTitle');
const infoEyebrow = document.querySelector('#atomInfoEyebrow');
const infoText = document.querySelector('#atomInfoText');
const infoButtons = [...document.querySelectorAll('.atom-select')];

const atomInfo = {
  overview: {
    eyebrow: 'TỔNG QUAN', title: 'Nguyên tử Nitrogen',
    text: 'Nitrogen có số hiệu nguyên tử 7. Hạt nhân chứa 7 proton và 7 neutron trong đồng vị bền phổ biến ¹⁴N; xung quanh là 7 electron.',
  },
  proton: {
    eyebrow: 'HẠT NHÂN · ĐIỆN TÍCH +1', title: '7 proton',
    text: 'Proton mang điện tích dương. Số proton quyết định nguyên tố hóa học: nguyên tử có 7 proton là nitrogen.',
  },
  neutron: {
    eyebrow: 'HẠT NHÂN · KHÔNG ĐIỆN', title: '7 neutron',
    text: 'Neutron không mang điện. Cùng với proton, neutron tạo nên phần lớn khối lượng của hạt nhân nitrogen-14.',
  },
  electron: {
    eyebrow: 'LỚP VỎ · ĐIỆN TÍCH −1', title: '7 electron',
    text: 'Nguyên tử nitrogen trung hòa có 7 electron. Ba electron độc thân ở phân lớp 2p góp phần tạo nên đặc điểm liên kết của nitrogen.',
  },
  shell: {
    eyebrow: 'PHÂN BỐ ELECTRON', title: 'Hai lớp electron',
    text: 'Lớp thứ nhất có 2 electron, lớp thứ hai có 5 electron. Cấu hình electron của nitrogen là 1s² 2s² 2p³.',
  },
};

let selectedKind = 'overview';
let atomRenderer = null;

function setAtomInfo(key) {
  const data = atomInfo[key] || atomInfo.overview;
  selectedKind = key;
  if (infoEyebrow) infoEyebrow.textContent = data.eyebrow;
  if (infoTitle) infoTitle.textContent = data.title;
  if (infoText) infoText.textContent = data.text;
  infoButtons.forEach((button) => button.classList.toggle('active', button.dataset.info === key));
}

infoButtons.forEach((button) => {
  button.addEventListener('click', () => setAtomInfo(button.dataset.info));
});

function rotateXYZ(point, rx = 0, ry = 0, rz = 0) {
  let { x, y, z } = point;
  let c = Math.cos(rx), s = Math.sin(rx);
  let nextY = y * c - z * s;
  let nextZ = y * s + z * c;
  y = nextY; z = nextZ;
  c = Math.cos(ry); s = Math.sin(ry);
  let nextX = x * c + z * s;
  nextZ = -x * s + z * c;
  x = nextX; z = nextZ;
  c = Math.cos(rz); s = Math.sin(rz);
  const finalX = x * c - y * s;
  const finalY = x * s + y * c;
  return { x: finalX, y: finalY, z };
}

function initAtomCanvas() {
  if (!stage) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'atom-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Mô hình nguyên tử Nitrogen ba chiều có thể xoay và chọn hạt');
  stage.prepend(canvas);

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) {
    if (loading3d) loading3d.innerHTML = '<small>Trình duyệt không hỗ trợ Canvas. Hãy thử Chrome, Edge hoặc Firefox mới.</small>';
    return;
  }

  const state = {
    width: 0, height: 0, dpr: 1,
    yaw: -0.42, pitch: 0.22, zoom: 1,
    autoRotate: true, showLabels: true,
    time: 0, lastFrame: 0, dragging: false, moved: false,
    pointerX: 0, pointerY: 0,
    hitTargets: [],
  };
  atomRenderer = state;

  const nucleusParticles = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 14; i += 1) {
    const y = 1 - (i / 13) * 2;
    const ringRadius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    nucleusParticles.push({
      position: {
        x: Math.cos(theta) * ringRadius * 0.39,
        y: y * 0.39,
        z: Math.sin(theta) * ringRadius * 0.39,
      },
      kind: i < 7 ? 'proton' : 'neutron',
      radius: 0.235,
    });
  }

  const innerRing = { radius: 1.22, rx: 0.24, ry: 0.16, rz: 0.12, count: 2 };
  const outerRing = { radius: 2.04, rx: 1.00, ry: 0.28, rz: 0.72, count: 5 };
  const palette = {
    proton: ['#ffe2dc', '#e87870', '#783e63'],
    neutron: ['#eff6ff', '#9bb8d6', '#405f85'],
    electron: ['#e3fbff', '#6fd5ff', '#2466b4'],
  };

  function resize() {
    const rect = stage.getBoundingClientRect();
    state.width = Math.max(280, Math.round(rect.width));
    state.height = Math.max(300, Math.round(rect.height));
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    draw();
  }

  function viewPoint(point) {
    const yawed = rotateXYZ(point, 0, state.yaw, 0);
    const pitched = rotateXYZ(yawed, state.pitch, 0, 0);
    const focal = 7.4;
    const perspective = focal / (focal - pitched.z);
    const unit = Math.min(state.width, state.height) * 0.235 * state.zoom;
    return {
      x: state.width * 0.5 + pitched.x * unit * perspective,
      y: state.height * 0.5 - pitched.y * unit * perspective,
      z: pitched.z,
      scale: unit * perspective,
    };
  }

  function ringPoint(ring, angle) {
    const local = { x: Math.cos(angle) * ring.radius, y: Math.sin(angle) * ring.radius, z: 0 };
    return rotateXYZ(local, ring.rx, ring.ry, ring.rz);
  }

  function drawRing(ring, color, alpha, width) {
    context.beginPath();
    for (let i = 0; i <= 120; i += 1) {
      const angle = (i / 120) * Math.PI * 2;
      const screen = viewPoint(ringPoint(ring, angle));
      if (i === 0) context.moveTo(screen.x, screen.y);
      else context.lineTo(screen.x, screen.y);
    }
    context.closePath();
    context.strokeStyle = color;
    context.globalAlpha = alpha;
    context.lineWidth = width;
    context.stroke();
    context.globalAlpha = 1;
  }

  function drawSphere(point, radius, kind, selected = false) {
    const screen = viewPoint(point);
    const r = Math.max(1.5, radius * screen.scale);
    const shades = palette[kind];
    const gradient = context.createRadialGradient(
      screen.x - r * 0.36, screen.y - r * 0.42, r * 0.05,
      screen.x + r * 0.08, screen.y + r * 0.12, r * 1.08,
    );
    gradient.addColorStop(0, shades[0]);
    gradient.addColorStop(0.48, shades[1]);
    gradient.addColorStop(1, shades[2]);
    context.save();
    if (selected || (selectedKind === kind)) {
      context.shadowColor = kind === 'proton' ? 'rgba(244,112,119,.68)' : kind === 'neutron' ? 'rgba(146,190,235,.66)' : 'rgba(91,205,255,.78)';
      context.shadowBlur = selected ? r * 1.2 : r * 0.65;
    }
    context.beginPath();
    context.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    context.fillStyle = gradient;
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = 'rgba(255,255,255,.30)';
    context.lineWidth = Math.max(0.6, r * 0.06);
    context.stroke();
    context.restore();
    state.hitTargets.push({ x: screen.x, y: screen.y, radius: r, kind, depth: screen.z });
  }

  function draw() {
    if (!state.width || !state.height) return;
    const w = state.width, h = state.height;
    context.clearRect(0, 0, w, h);
    state.hitTargets = [];

    // Soft center light and quiet orbital guides.
    const aura = context.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, Math.min(w, h) * 0.47);
    aura.addColorStop(0, 'rgba(69,145,220,.19)');
    aura.addColorStop(1, 'rgba(132,170,137,0)');
    context.fillStyle = aura;
    context.fillRect(0, 0, w, h);

    const shellSelected = selectedKind === 'shell';
    drawRing(innerRing, shellSelected ? 'rgba(184,226,255,.92)' : 'rgba(108,174,232,.52)', shellSelected ? 0.98 : 0.82, shellSelected ? 2.2 : 1.2);
    drawRing(outerRing, shellSelected ? 'rgba(184,226,255,.86)' : 'rgba(108,174,232,.40)', shellSelected ? 0.98 : 0.76, shellSelected ? 2.2 : 1.2);

    const particles = [];
    nucleusParticles.forEach((particle) => particles.push({ ...particle, position: particle.position }));
    for (let i = 0; i < innerRing.count; i += 1) {
      const angle = state.time * 0.88 + (Math.PI * 2 * i) / innerRing.count;
      particles.push({ position: ringPoint(innerRing, angle), kind: 'electron', radius: 0.092 });
    }
    for (let i = 0; i < outerRing.count; i += 1) {
      const angle = state.time * 0.43 + (Math.PI * 2 * i) / outerRing.count + 0.28;
      particles.push({ position: ringPoint(outerRing, angle), kind: 'electron', radius: 0.092 });
    }

    particles.sort((a, b) => viewPoint(a.position).z - viewPoint(b.position).z);
    particles.forEach((particle) => {
      const isSelected = selectedKind === 'overview'
        ? particle.kind !== 'electron'
        : selectedKind === particle.kind;
      drawSphere(particle.position, particle.radius, particle.kind, isSelected);
    });

    // Tiny label in the nucleus keeps the model recognizable without crowding it.
    context.save();
    context.textAlign = 'center';
    context.font = '600 10px "Be Vietnam Pro", sans-serif';
    context.fillStyle = 'rgba(222,239,255,.76)';
    context.fillText('N · 07', w * 0.5, h - 18);
    context.restore();
  }

  function animate(timestamp) {
    if (!state.lastFrame) state.lastFrame = timestamp;
    const delta = Math.min((timestamp - state.lastFrame) / 1000, 0.05);
    state.lastFrame = timestamp;
    if (state.autoRotate) {
      state.time += delta;
      state.yaw += delta * 0.12;
    }
    draw();
    requestAnimationFrame(animate);
  }

  let startX = 0;
  let startY = 0;
  let pointerId = null;
  canvas.addEventListener('pointerdown', (event) => {
    pointerId = event.pointerId;
    state.dragging = true;
    state.moved = false;
    startX = event.clientX;
    startY = event.clientY;
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!state.dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - state.pointerX;
    const dy = event.clientY - state.pointerY;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 4) state.moved = true;
    state.yaw += dx * 0.008;
    state.pitch = Math.max(-1.15, Math.min(1.15, state.pitch + dy * 0.008));
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    draw();
  });
  function finishPointer(event) {
    if (event.pointerId !== pointerId) return;
    state.dragging = false;
    canvas.classList.remove('is-dragging');
    if (!state.moved) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let nearest = null;
      let nearestDistance = Infinity;
      state.hitTargets.forEach((target) => {
        const distance = Math.hypot(target.x - x, target.y - y);
        const allowed = Math.max(12, target.radius + 7);
        if (distance < allowed && distance < nearestDistance) {
          nearest = target;
          nearestDistance = distance;
        }
      });
      if (nearest) setAtomInfo(nearest.kind);
    }
    pointerId = null;
  }
  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    state.zoom = Math.max(0.68, Math.min(1.65, state.zoom * (event.deltaY < 0 ? 1.08 : 0.93)));
    draw();
  }, { passive: false });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();
  loading3d?.remove();
  requestAnimationFrame(animate);

  const rotateButton = document.querySelector('#rotateToggle');
  rotateButton?.addEventListener('click', () => {
    state.autoRotate = !state.autoRotate;
    const content = rotateButton.querySelector('.lg-content');
    if (content) content.innerHTML = state.autoRotate ? '<span>Ⅱ</span> Tạm dừng xoay' : '<span>▶</span> Tiếp tục xoay';
    else rotateButton.textContent = state.autoRotate ? 'Ⅱ Tạm dừng xoay' : '▶ Tiếp tục xoay';
  });
  document.querySelector('#resetView')?.addEventListener('click', () => {
    state.yaw = -0.42;
    state.pitch = 0.22;
    state.zoom = 1;
    state.time = 0;
    draw();
  });
  const labelButton = document.querySelector('#toggleLabels');
  labelButton?.addEventListener('click', () => {
    state.showLabels = !state.showLabels;
    stage.classList.toggle('labels-hidden', !state.showLabels);
    const content = labelButton.querySelector('.lg-content');
    if (content) content.innerHTML = state.showLabels ? '<span>⌖</span> Ẩn chú thích' : '<span>⌖</span> Hiện chú thích';
    else labelButton.textContent = state.showLabels ? '⌖ Ẩn chú thích' : '⌖ Hiện chú thích';
  });
  setAtomInfo('overview');
}

initAtomCanvas();
