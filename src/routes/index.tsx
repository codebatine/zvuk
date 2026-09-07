import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Field } from "@/components/Field";
import { ZvukSlider } from "@/components/ZvukSlider";
import {
  DEFAULT_PARAMS,
  PRESETS,
  ZvukEngine,
  type ParamKey,
  type Params,
} from "@/lib/zvuk-engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZVUK — an ever-changing electronic soundscape" },
      {
        name: "description",
        content:
          "ZVUK is a generative instrument: warm analog tones, slow evolution, endless listening. Press play and let it drift.",
      },
      { property: "og:title", content: "ZVUK — an ever-changing electronic soundscape" },
      {
        property: "og:description",
        content: "Sound, in motion. A generative electronic soundscape that never repeats.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Zvuk,
});

const CONTROLS: { key: ParamKey; label: string; low: string; high: string }[] = [
  { key: "space", label: "SPACE", low: "CLOSE", high: "VAST" },
  { key: "motion", label: "MOTION", low: "STILL", high: "EVOLVING" },
  { key: "pulse", label: "PULSE", low: "DRONE", high: "PULSING" },
  { key: "warmth", label: "WARMTH", low: "CLEAN", high: "WARM" },
  { key: "density", label: "DENSITY", low: "SPARSE", high: "FULL" },
  { key: "harmony", label: "HARMONY", low: "SIMPLE", high: "RICH" },
];

function Zvuk() {
  const engineRef = useRef<ZvukEngine | null>(null);
  const [playing, setPlaying] = useState(false);
  const [params, setParams] = useState<Params>({ ...DEFAULT_PARAMS });
  const [label, setLabel] = useState("D MINOR · 72 BPM");
  const [preset, setPreset] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);

  const engine = () => {
    if (!engineRef.current) {
      const e = new ZvukEngine();
      e.onState = (s) => setLabel(s.label);
      e.setParams(params);
      engineRef.current = e;
    }
    return engineRef.current;
  };

  useEffect(() => () => engineRef.current?.dispose(), []);

  const getEnergy = useCallback(() => engineRef.current?.energy() ?? 0, []);

  const toggle = async () => {
    const e = engine();
    if (playing) {
      e.pause();
      setPlaying(false);
    } else {
      await e.play();
      setPlaying(true);
      setPanel(true);
    }
  };

  const update = (k: ParamKey, v: number) => {
    setParams((p) => ({ ...p, [k]: v }));
    engine().setParam(k, v);
    setPreset(null);
  };

  const applyPreset = (name: string, p: Params) => {
    setParams({ ...p });
    engine().setParams(p);
    setPreset(name);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <Field getEnergy={getEnergy} active={playing} />

      <div className="relative flex min-h-screen flex-col px-6 py-8 sm:px-10 sm:py-10">
        <header className="zvuk-fade flex items-baseline gap-4">
          <h1 className="text-[26px] font-medium leading-none tracking-[0.34em] text-foreground">
            ZVUK
          </h1>
          <span className="text-[10px] tracking-[0.3em] text-muted-foreground">
            GENERATIVE SOUND
          </span>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center gap-6">
          <button
            onClick={toggle}
            className="rounded-full border border-border/70 px-12 py-5 text-[12px] tracking-[0.45em] text-foreground transition-all duration-700 hover:border-accent hover:tracking-[0.55em] hover:text-accent"
          >
            {playing ? "PAUSE" : "PLAY"}
          </button>
          <p className="text-[10px] tracking-[0.32em] text-muted-foreground transition-opacity duration-1000">
            {playing ? label : "AN EVER-CHANGING ELECTRONIC SOUNDSCAPE"}
          </p>
          <button
            onClick={() => {
              engine().mutate();
              setPreset(null);
            }}
            className="text-[10px] tracking-[0.4em] text-muted-foreground transition-colors duration-500 hover:text-foreground"
          >
            MUTATE
          </button>
        </section>

        <footer
          className={`transition-opacity duration-1000 ${panel ? "opacity-100" : "opacity-40"}`}
        >
          <div className="mb-6 flex flex-wrap gap-x-7 gap-y-3">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p.name, p.params)}
                className={`text-[10px] tracking-[0.3em] transition-colors duration-500 ${
                  preset === p.name
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="grid gap-x-12 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {CONTROLS.map((c) => (
              <ZvukSlider
                key={c.key}
                label={c.label}
                low={c.low}
                high={c.high}
                value={params[c.key]}
                onChange={(v) => update(c.key, v)}
              />
            ))}
          </div>
          <p className="mt-8 text-[9px] tracking-[0.3em] text-muted-foreground/60">
            SOUND, IN MOTION
          </p>
        </footer>
      </div>
    </main>
  );
}
