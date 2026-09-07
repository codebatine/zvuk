import { useEffect, useRef } from "react";

interface Props {
  getEnergy: () => number;
  active: boolean;
}

interface Thread {
  seed: number;
  hue: number; // 0 = paper white, 1 = warm amber
  width: number;
  alpha: number;
  speed: number;
  amp: number;
  freq: number;
  yBase: number; // vertical resting position 0..1
  phase: number;
}

// Slow flowing ink-threads — generative plotter art, not a starfield.
export function Field({ getEnergy, active }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const energyRef = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0b0b0d";
      ctx.fillRect(0, 0, w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    const threads: Thread[] = Array.from({ length: 14 }, (_, i) => ({
      seed: Math.random() * 1000,
      hue: i % 4 === 3 ? 1 : 0, // every fourth thread is warm
      width: 0.4 + Math.random() * 1.1,
      alpha: 0.05 + Math.random() * 0.09,
      speed: 0.12 + Math.random() * 0.35,
      amp: 0.05 + Math.random() * 0.16,
      freq: 1.2 + Math.random() * 2.6,
      yBase: 0.18 + (i / 13) * 0.64 + (Math.random() - 0.5) * 0.05,
      phase: Math.random() * Math.PI * 2,
    }));

    // pseudo-noise from layered sines
    const flow = (x: number, t: number, s: number) =>
      Math.sin(x * 0.0016 * 1 + t + s) * 0.55 +
      Math.sin(x * 0.0037 - t * 0.7 + s * 2.3) * 0.3 +
      Math.sin(x * 0.0008 + t * 0.4 + s * 4.1) * 0.45;

    let raf = 0;
    let t = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      t += 0.004;
      const target = activeRef.current ? getEnergy() : 0;
      energyRef.current += (target - energyRef.current) * 0.02;
      const e = energyRef.current;

      // fade previous frame — long soft trails
      ctx.fillStyle = `rgba(11, 11, 13, ${0.045 - e * 0.02})`;
      ctx.fillRect(0, 0, w, h);

      ctx.lineCap = "round";

      for (const th of threads) {
        const tt = t * th.speed;
        const alpha = th.alpha * (0.45 + e * 1.1);
        ctx.strokeStyle =
          th.hue === 1
            ? `rgba(198, 154, 108, ${alpha.toFixed(3)})`
            : `rgba(232, 226, 214, ${alpha.toFixed(3)})`;
        ctx.lineWidth = th.width * (1 + e * 1.4);
        ctx.beginPath();
        const yb = th.yBase + Math.sin(t * 0.3 + th.phase) * 0.05;
        for (let x = -20; x <= w + 20; x += 8) {
          const n = flow(x, tt, th.seed);
          const y =
            h * yb +
            n * h * th.amp * (0.7 + e * 0.9) +
            Math.sin(x * 0.002 + th.phase + tt * 2) * h * 0.02;
          if (x === -20) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // one large, very slow drifting form — soft smudge of warmth
      const gx = w * (0.5 + Math.sin(t * 0.11) * 0.22);
      const gy = h * (0.45 + Math.cos(t * 0.07) * 0.18);
      const gr = Math.min(w, h) * (0.35 + Math.sin(t * 0.05) * 0.08 + e * 0.1);
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, `rgba(198, 154, 108, ${0.028 + e * 0.05})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [getEnergy]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
