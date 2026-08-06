// Rain as a 2D canvas layer over the renderer — cheap, resolution-independent,
// and it reads. Driven by whichever pressure carries weather this phase.

export class Rain {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private drops: { x: number; y: number; len: number; speed: number }[] = [];
  private intensity = 0;      // current, eased
  target = 0;                 // 0 = dry, 1 = storm

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:3;';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  update(dt: number): void {
    this.intensity += (this.target - this.intensity) * Math.min(1, dt * 1.5);
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.intensity < 0.02) { this.drops = []; return; }

    const wanted = Math.floor(140 * this.intensity);
    while (this.drops.length < wanted) {
      this.drops.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        len: 9 + Math.random() * 14,
        speed: 900 + Math.random() * 500
      });
    }
    if (this.drops.length > wanted) this.drops.length = wanted;

    ctx.strokeStyle = 'rgba(190, 210, 225, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of this.drops) {
      d.y += d.speed * dt;
      d.x -= d.speed * dt * 0.18;
      if (d.y > canvas.height) { d.y = -d.len; d.x = Math.random() * canvas.width; }
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.18, d.y + d.len);
    }
    ctx.stroke();
  }
}
