import { useEffect, useRef } from 'react';

export interface ColorTheme {
  name?: string;
  sunsetTop: string;
  sunsetMid: string;
  sunsetHorizon: string;
  waterBottom: string;
  waterTop: string;
  wave: string;
}

interface CanvasSketchProps {
  theme: ColorTheme;
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const getRandomString = () => CHARS[Math.floor(Math.random() * CHARS.length)];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const map = (n: number, start1: number, stop1: number, start2: number, stop2: number) => ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
const constrain = (n: number, low: number, high: number) => Math.max(low, Math.min(n, high));

const pseudoNoise = (x: number, t: number) => {
  return (Math.sin(x + t) + Math.sin(x * 2.1 - t * 1.3) * 0.5 + Math.sin(x * 3.7 + t * 0.8) * 0.25) / 1.75 * 0.5 + 0.5;
};

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
};

export default function CanvasSketch({ theme }: CanvasSketchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const themeRef = useRef(theme);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use resize observer for smooth canvas resizing and high-DPI awareness
    let width = container.clientWidth;
    let height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;

    const pgCanvas = document.createElement('canvas');
    pgCanvas.width = width;
    pgCanvas.height = height;
    const pg = pgCanvas.getContext('2d')!;

    let t = 0;
    const freq = 0.008;
    let offsetWidth = 0;
    let showWave = false;

    class Splash {
      x: number;
      y: number;
      dx: number;
      dy: number;
      alpha: number;
      randomString: string;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.dx = (Math.random() * 10) - 5;
        this.dy = (Math.random() * 10) - 5;
        this.alpha = 255;
        this.randomString = getRandomString();
      }

      update() {
        this.x += this.dx;
        this.y += this.dy;
        this.alpha -= 20;
        this.alpha = constrain(this.alpha, 0, 255);
      }

      display() {
        if (!ctx) return;
        const waveColor = hexToRgb(themeRef.current.wave);
        ctx.fillStyle = `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, ${this.alpha / 255})`;
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.randomString, this.x, this.y);
      }
    }

    class Wave {
      startY: number;
      initY: number;
      offsets: {x: number, y: number}[] = [];
      space: number = 8;
      lineCount: number = 20;
      state: string = "ascending";
      descendingY: number = 0;
      waitTimer: number = 0;
      descendProgress: number = 0;
      splashes: Splash[] = [];
      textList: string[] = [];
      currentScale: number = 1;
      targetScale: number = 1;

      constructor(y: number) {
        this.initY = y;
        this.startY = y + 200;

        for (let i = 0; i < this.lineCount; i++) {
          for (let x = 0; x <= width + 100; x += this.space) { 
            this.offsets.push({
              x: (Math.random() * 10) - 5,
              y: (Math.random() * 10) - 5
            });
            this.textList.push(getRandomString());
          }
        }
      }

      shrink() {
        this.targetScale = 0.2;
      }

      update() {
        this.currentScale = lerp(this.currentScale, this.targetScale, 0.15);
        if (this.targetScale < 1 && this.currentScale < this.targetScale + 0.05) {
          this.targetScale = 1;
        }

        if (this.state === "ascending") {
          this.startY = lerp(this.startY, this.initY, 0.01);
          if (Math.abs(this.startY - this.initY) < 10) {
            this.state = "waiting";
            this.waitTimer = performance.now();
          }
        } else if (this.state === "descending") {
          this.descendProgress += 0.01;
          if (this.descendProgress > 1) this.descendProgress = 1;

          const easedProgress = Math.pow(this.descendProgress, 2);
          this.startY = lerp(this.descendingY, this.initY + 200, easedProgress);

          if (Math.abs(this.startY - (this.initY + 200)) < 10) {
            this.state = "ascending";
            this.descendProgress = 0;
          }
        } else if (this.state === "waiting") {
          if (performance.now() - this.waitTimer > 500) {
            this.state = "descending";
            this.descendingY = this.startY;
          }
        }
      }

      display() {
        if (!ctx) return;
        const currentScale = this.currentScale;
        const amp = map(this.startY, this.initY + 200, this.initY, 10, 60) * currentScale;

        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        let index = 0;
        const centerOffsetLocal = (this.lineCount * this.space) / 2;
        
        for (let i = 0; i < this.lineCount; i++) {
          const offsetY = (i * this.space - centerOffsetLocal) * currentScale + centerOffsetLocal;
          for (let x = 0; x <= width; x += this.space) {
            if (index >= this.offsets.length) break;

            const n = pseudoNoise(x * freq, t);
            const y = offsetY + this.startY + map(n, 0, 1, -amp, amp);

            let a = map(y, this.initY, this.initY + 200, 255, 5);
            a = constrain(a, 5, 255);

            const offset = this.offsets[index];
            const waveColor = hexToRgb(themeRef.current.wave);
            ctx.fillStyle = `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, ${a / 255})`;
            ctx.fillText(this.textList[index], x + offset.x, y + offset.y);

            if (this.state === "ascending" && i < 3 && Math.random() < 0.002) {
              this.splashes.push(new Splash(x + offset.x, y + offset.y));
            }

            index++;
          }
        }

        for (let i = this.splashes.length - 1; i >= 0; i--) {
          const s = this.splashes[i];
          s.update();
          s.display();
          if (s.alpha <= 0) {
            this.splashes.splice(i, 1);
          }
        }
      }
    }

    class Star {
      x: number;
      y: number;
      baseAlpha: number;
      phase: number;
      speed: number;

      constructor(x: number, y: number) {
        this.x = Math.floor(x / 8) * 8;
        this.y = Math.floor(y / 8) * 8;
        this.baseAlpha = Math.random() * 0.3 + 0.1;
        this.phase = Math.random() * Math.PI * 2;
        this.speed = Math.random() * 0.02 + 0.01;
      }

      display(ctx: CanvasRenderingContext2D, time: number) {
        const alpha = this.baseAlpha + Math.sin(time * this.speed + this.phase) * 0.4;
        if (alpha > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(alpha, 0.6)})`;
          ctx.fillRect(this.x, this.y, 8, 8);
        }
      }
    }

    class Cloud {
      x: number;
      y: number;
      speed: number;
      w: number;
      h: number;

      constructor(x: number, yMax: number) {
        this.x = x;
        this.y = Math.floor(Math.random() * yMax / 8) * 8;
        this.speed = Math.random() * 0.2 + 0.05;
        this.w = (Math.floor(Math.random() * 10) + 6) * 8;
        this.h = (Math.floor(Math.random() * 2) + 2) * 8;
      }

      update(yMax: number) {
        this.x += this.speed;
        if (this.x > width + 32) {
          this.x = -this.w - 32;
          this.y = Math.floor(Math.random() * yMax / 8) * 8;
        }
      }

      display(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        const snapX = Math.floor(this.x / 8) * 8;
        ctx.fillRect(snapX, this.y, this.w, this.h);
        ctx.fillRect(snapX + 16, this.y - 8, this.w - 32, 8);
        ctx.fillRect(snapX + 8, this.y + this.h, this.w - 16, 8);
      }
    }

    let waves = Array.from({ length: 4 }, (_, i) => new Wave(height * 0.5 + i * 80));
    let stars = Array.from({ length: 80 }, () => new Star(Math.random() * width, Math.random() * height * 0.4));
    let clouds = Array.from({ length: 5 }, () => new Cloud(Math.random() * width, height * 0.35));

    let cachedBgCanvas = document.createElement('canvas');
    let lastWidth = 0;
    let lastHeight = 0;
    let lastTheme = "";

    let animationId: number;

    function render() {
      if (!ctx) return;

      const themeKey = JSON.stringify(themeRef.current);
      if (width !== lastWidth || height !== lastHeight || lastTheme !== themeKey) {
        cachedBgCanvas.width = width;
        cachedBgCanvas.height = height;
        const cx = cachedBgCanvas.getContext('2d')!;

        const PIXEL_SIZE = 8;
        const sw = Math.ceil(width / PIXEL_SIZE);
        const sh = Math.ceil(height / PIXEL_SIZE);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sw;
        tempCanvas.height = sh;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.scale(1 / PIXEL_SIZE, 1 / PIXEL_SIZE);

        const currentTheme = themeRef.current;
        const divide = height * 0.4;
        const grad1 = tempCtx.createLinearGradient(0, 0, 0, divide);
        grad1.addColorStop(0, currentTheme.sunsetTop);
        grad1.addColorStop(0.6, currentTheme.sunsetMid);
        grad1.addColorStop(1, currentTheme.sunsetHorizon);
        tempCtx.fillStyle = grad1;
        tempCtx.fillRect(0, 0, width, divide);

        const grad2 = tempCtx.createLinearGradient(0, divide, 0, height);
        grad2.addColorStop(0, currentTheme.waterTop);
        grad2.addColorStop(1, currentTheme.waterBottom);
        tempCtx.fillStyle = grad2;
        tempCtx.fillRect(0, divide, width, height - divide);

        tempCtx.save();
        const bx = width / 2;
        const by = height * 0.43;

        tempCtx.fillStyle = 'rgba(0, 40, 0, 0.15)';
        tempCtx.beginPath();
        tempCtx.moveTo(bx - 50, by + 10);
        tempCtx.lineTo(bx + 50, by + 10);
        tempCtx.lineTo(bx + 200, by + 120);
        tempCtx.lineTo(bx + 100, by + 140);
        tempCtx.closePath();
        tempCtx.fill();

        tempCtx.fillStyle = 'rgb(20, 20, 20)';
        tempCtx.beginPath();
        tempCtx.roundRect(bx - 60, by - 5, 120, 10, 2);
        tempCtx.fill();

        tempCtx.beginPath();
        tempCtx.roundRect(bx - 60, by - 30, 120, 10, 2); 
        tempCtx.fill();

        tempCtx.strokeStyle = 'rgb(20, 20, 20)';
        tempCtx.lineWidth = 5;
        tempCtx.lineCap = 'round';
        tempCtx.beginPath();
        tempCtx.moveTo(bx - 40, by + 5);
        tempCtx.lineTo(bx - 50, by + 45);
        tempCtx.moveTo(bx + 40, by + 5);
        tempCtx.lineTo(bx + 50, by + 45);
        tempCtx.moveTo(bx - 40, by - 20);
        tempCtx.lineTo(bx - 40, by + 10);
        tempCtx.moveTo(bx + 40, by - 20);
        tempCtx.lineTo(bx + 40, by + 10);
        tempCtx.stroke();
        tempCtx.restore();

        cx.imageSmoothingEnabled = false;
        cx.drawImage(tempCanvas, 0, 0, sw, sh, 0, 0, width, height);

        lastWidth = width;
        lastHeight = height;
        lastTheme = themeKey;
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cachedBgCanvas, 0, 0);

      const appTime = performance.now() * 0.05;
      stars.forEach(s => s.display(ctx, appTime));
      clouds.forEach(c => {
        c.update(height * 0.4);
        c.display(ctx);
      });

      if (showWave) {
        waves.forEach((w) => {
          w.update();
          w.display();
        });
        t += 0.003; // Processing sketch's slower flow speed
      } else {
        ctx!.drawImage(pgCanvas, 0, 0);

        const waveColor = hexToRgb(themeRef.current.wave);
        pg.fillStyle = `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, 0.8)`;
        pg.font = "12px monospace";
        pg.textAlign = "center";
        pg.textBaseline = "middle";

        // Draw multiple characters per frame to accelerate the intro accumulation gracefully
        for (let i = 0; i < 6; i++) {
          const rx = (width / 2 - offsetWidth) + Math.random() * (offsetWidth * 2);
          const ry = (height - 16) + Math.random() * 16;
          pg.fillText(getRandomString(), rx, ry);
        }

        offsetWidth = Math.min(width / 1.5, offsetWidth + 2);
        if (offsetWidth >= width / 1.5) {
          showWave = true;
        }
      }

      animationId = requestAnimationFrame(render);
    }

    render();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        
        // Prevent clearing the intro if width hasn't changed (stops recursive loop on mount)
        if (newWidth === width && newHeight === height) continue;
        if ((window as any).isRecordingCanvas) continue;

        width = newWidth;
        height = newHeight;
        canvas.width = width;
        canvas.height = height;
        pgCanvas.width = width;
        pgCanvas.height = height;
        
        // Restart sequence on resize
        showWave = false;
        offsetWidth = 0;
        t = 0;
        waves = Array.from({ length: 4 }, (_, i) => new Wave(height * 0.5 + i * 80));
        stars = Array.from({ length: 80 }, () => new Star(Math.random() * width, Math.random() * height * 0.4));
        clouds = Array.from({ length: 5 }, () => new Cloud(Math.random() * width, height * 0.35));
      }
    });
    resizeObserver.observe(container);

    const handlePointerDown = (e: PointerEvent) => {
      if (!showWave) return;
      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;

      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        const yMin = w.startY - 50;
        const yMax = w.startY + w.lineCount * w.space + 50;
        if (y >= yMin && y <= yMax) {
          w.shrink();
          break;
        }
      }
    };
    canvas.addEventListener('pointerdown', handlePointerDown);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{background: 'black'}}>
      <canvas id="main-canvas" ref={canvasRef} className="block w-full h-full touch-none" />
    </div>
  );
}
