/*
 * LiquidGlassEngine — self-contained Liquid Glass effect for static websites.
 * Inspired by the quick-liquid API/config supplied by the user.
 * No npm, bundler, WebGL or external JavaScript dependency is required.
 * The effect uses a moving specular lens, chromatic edge highlights,
 * frosted backdrop, a fine bezel and spring-like press/release motion.
 */
const DEFAULTS = {
  material: 'regular',
  borderRadius: 999,
  blur: 2.5,
  saturation: 1.5,
  refractionStrength: 11,
  bezelWidth: 20,
  chromaticAberration: 0.27,
  lightAngle: 49,
  appearance: 'dark',
  dynamicLighting: true,
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class LiquidGlassEngine {
  constructor(element, options = {}) {
    if (!(element instanceof HTMLElement)) {
      throw new TypeError('LiquidGlassEngine cần một phần tử HTML hợp lệ.');
    }

    this.el = element;
    this.config = { ...DEFAULTS, ...options };
    this.pressConfig = { scale: 0.92, squish: 0.03 };
    this.releaseTimer = 0;
    this.destroyed = false;

    this.el.classList.add('lg', 'liquid-control');
    this.el.dataset.lgMaterial = this.config.material;
    this.el.dataset.lgAppearance = this.config.appearance;
    this.el.style.setProperty('--lg-radius', `${this.config.borderRadius}px`);
    this.el.style.setProperty('--lg-blur', `${this.config.blur}px`);
    this.el.style.setProperty('--lg-saturation', String(this.config.saturation));
    this.el.style.setProperty('--lg-strength', String(this.config.refractionStrength));
    this.el.style.setProperty('--lg-bezel', `${this.config.bezelWidth}px`);
    this.el.style.setProperty('--lg-chroma', String(this.config.chromaticAberration));
    this.el.style.setProperty('--lg-angle', `${this.config.lightAngle}deg`);
    this.el.style.setProperty('--lg-x', '50%');
    this.el.style.setProperty('--lg-y', '34%');

    // Preserve the original text/children inside a stable foreground layer.
    this.content = document.createElement('span');
    this.content.className = 'lg-content';
    while (this.el.firstChild) this.content.appendChild(this.el.firstChild);
    this.el.appendChild(this.content);

    // Lens surface: its gradients are animated and follow the pointer.
    this.specular = document.createElement('span');
    this.specular.className = 'lg-spec';
    this.specular.setAttribute('aria-hidden', 'true');
    this.el.appendChild(this.specular);

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);

    this.el.addEventListener('pointermove', this.onPointerMove, { passive: true });
    this.el.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
    this.el.addEventListener('pointerdown', this.onPointerDown);
    this.el.addEventListener('pointerup', this.onPointerUp);
    this.el.addEventListener('pointercancel', this.onPointerUp);
    this.el.addEventListener('keydown', this.onKeyDown);
    this.el.addEventListener('keyup', this.onKeyUp);

    this.resizeObserver = 'ResizeObserver' in window
      ? new ResizeObserver(() => this.syncSize())
      : null;
    this.resizeObserver?.observe(this.el);
    this.syncSize();
  }

  syncSize() {
    if (this.destroyed) return;
    this.el.style.setProperty('--lg-width', `${this.el.offsetWidth}px`);
    this.el.style.setProperty('--lg-height', `${this.el.offsetHeight}px`);
  }

  setLightFromPointer(event) {
    const rect = this.el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    this.el.style.setProperty('--lg-x', `${x}%`);
    this.el.style.setProperty('--lg-y', `${y}%`);
  }

  onPointerMove(event) {
    if (!this.config.dynamicLighting || this.destroyed) return;
    this.setLightFromPointer(event);
    if (event.pointerType !== 'touch') this.el.classList.add('lg-lit');
  }

  onPointerLeave() {
    this.el.style.setProperty('--lg-x', '50%');
    this.el.style.setProperty('--lg-y', '34%');
    this.el.classList.remove('lg-lit');
    if (this.el.classList.contains('lg-pressed')) this.onPointerUp();
  }

  enableLiquidPress(options = {}) {
    this.pressConfig = { ...this.pressConfig, ...options };
    this.el.style.setProperty('--lg-press-scale', String(this.pressConfig.scale));
    this.el.style.setProperty('--lg-squish', String(this.pressConfig.squish));
    return this;
  }

  onPointerDown(event) {
    if (event && this.config.dynamicLighting) this.setLightFromPointer(event);
    if (reduceMotion || this.destroyed) return;
    window.clearTimeout(this.releaseTimer);
    this.el.classList.remove('lg-release');
    this.el.classList.add('lg-pressed');
  }

  onPointerUp() {
    if (reduceMotion || this.destroyed || !this.el.classList.contains('lg-pressed')) return;
    this.el.classList.remove('lg-pressed');
    this.el.classList.add('lg-release');
    this.releaseTimer = window.setTimeout(() => {
      this.el.classList.remove('lg-release');
    }, 520);
  }

  onKeyDown(event) {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) this.onPointerDown();
  }

  onKeyUp(event) {
    if (event.key === ' ' || event.key === 'Enter') this.onPointerUp();
  }

  destroy() {
    this.destroyed = true;
    window.clearTimeout(this.releaseTimer);
    this.resizeObserver?.disconnect();
    this.el.removeEventListener('pointermove', this.onPointerMove);
    this.el.removeEventListener('pointerleave', this.onPointerLeave);
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    this.el.removeEventListener('pointerup', this.onPointerUp);
    this.el.removeEventListener('pointercancel', this.onPointerUp);
    this.el.removeEventListener('keydown', this.onKeyDown);
    this.el.removeEventListener('keyup', this.onKeyUp);
    this.specular.remove();
    while (this.content.firstChild) this.el.insertBefore(this.content.firstChild, this.content);
    this.content.remove();
    this.el.classList.remove('lg', 'liquid-control', 'lg-pressed', 'lg-release', 'lg-lit');
  }
}

export { DEFAULTS as LIQUID_GLASS_DEFAULTS };
