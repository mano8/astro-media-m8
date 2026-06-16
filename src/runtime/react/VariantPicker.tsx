import { useState } from "react";
import { useMediaPresets } from "../hooks/useMediaPresets.js";
import { useMediaVariants } from "../hooks/useMediaVariants.js";

/** List variants for an object and generate new ones from named presets. */
export function VariantPicker({ objectId }: { objectId: string }) {
  const { presets } = useMediaPresets();
  const { items, job, generate, remove, error } = useMediaVariants(objectId);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function toggle(name: string) {
    setSelected((prev) => (prev.includes(name) ? prev.filter((value) => value !== name) : [...prev, name]));
  }

  async function run() {
    if (!selected.length) return;
    setBusy(true);
    try {
      await generate(selected);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="fa-media-panel">
      <h3>Variants</h3>
      {error ? <p role="alert">Failed to load variants</p> : null}
      <ul className="fa-media-variants">
        {items.map((variant) => (
          <li key={variant.id}>
            {variant.variant_name} · {variant.format} · {variant.width ?? "?"}×{variant.height ?? "?"}
            <button type="button" onClick={() => void remove(variant.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <fieldset>
        <legend>Generate from presets</legend>
        {presets.map((preset) => (
          <label key={preset.name}>
            <input type="checkbox" checked={selected.includes(preset.name)} onChange={() => toggle(preset.name)} />
            {preset.name}
            {preset.builtin ? " (built-in)" : ""}
          </label>
        ))}
        <button type="button" disabled={busy || !selected.length} onClick={() => void run()}>
          {busy ? "Generating…" : "Generate"}
        </button>
        {job ? <p>Job {job.status}: {job.variants_created}/{job.variants_expected}</p> : null}
      </fieldset>
    </section>
  );
}
