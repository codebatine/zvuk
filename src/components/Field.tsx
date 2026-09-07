import { useEffect, useRef } from "react";

interface Props {
  getEnergy: () => number;
  active: boolean;
}

interface P {
  a: number; // orbit angle
  r: number; // radius factor
  s: number; // speed
  z: number; // depth 0..1
  o: number; // base opacity
  d: number; // drift phase
}

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
    };
    resize();
    window.addEventListener("resize", resize);

    const N = 260;
    const pts: P[] = Array.from({ length: N }, () => ({
      a: Math.random() * Math.PI * 2,
      r: Math.pow(Math.random(), 0.65),
      s: (0.00006 + Math.random() * 0.00022) * (Math.random() < 0.25 ? -1 : 1),
      z: Math.random(),
      o: 0.12 + Math.random() * 0.55,
      d: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    let t = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      t += 1;
      const target = activeRef.current ? getEnergy() : 0;
      energyRef.current += (target - energyRef.current) * 0.03;
      const e = energyRef.current;

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const base = Math.min(w, h) * 0.42;

      // translucent slow rings
      for (let i = 0; i < 3; i++) {
        const ph = t * 0.0008 + i * 2.1;
        const rr = base * (0.45 + i * 0.24 + Math.sin(ph) * 0.03 + e * 0.05);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rr, rr * (0.62 + Math.sin(ph * 0.7) * 0.06), Math.sin(ph * 0.4) * 0.3, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(232, 226, 214, ${0.018 + e * 0.03})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (const p of pts) {
        p.a += p.s * (0.5 + e * 1.6);
        p.d += 0.0016;
        const wob = Math.sin(p.d) * 0.05 + Math.cos(p.d * 0.53) * 0.03;
        const rad = base * (p.r + wob) * (0.9 + e * 0.16);
        const x = cx + Math.cos(p.a) * rad;
        const y = cy + Math.sin(p.a) * rad * (0.6 + p.z * 0.22);
        const size = (0.5 + p.z * 1.5) * (1 + e * 0.7);
        const alpha = p.o * (0.28 + e * 0.72) * (0.6 + 0.4 * Math.sin(p.d * 0.8));
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(236, 230, 218, ${Math.max(0, alpha).toFixed(3)})`;
        ctx.fill();
      }

      // a slow warm core glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 1.1);
      g.addColorStop(0, `rgba(198, 154, 108, ${0.05 + e * 0.07})`);
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
