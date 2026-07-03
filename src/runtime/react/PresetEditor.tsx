import { useState } from "react";
import { useMediaPresets } from "../hooks/useMediaPresets.js";
import type { ImageFormat } from "../schemas.js";

const FORMATS: ImageFormat[] = ["WEBP", "JPEG", "PNG", "GIF", "AVIF"];
const inputClassName =
  "fa-media-control h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";
const labelClassName =
  "fa-media-label flex items-center gap-2 pb-2 text-sm leading-none font-medium select-none";

/** Built-in presets render read-only; user-owned presets are editable. */
export function PresetEditor() {
  const { presets, create, remove, error } = useMediaPresets();
  const [name, setName] = useState("");
  const [width, setWidth] = useState(512);
  const [format, setFormat] = useState<ImageFormat>("WEBP");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await create({
        name: name.trim(),
        spec: {
          image_size: { fixed_width: width, fixed_height: null, fixed_size: null },
          formats: [{ ext: format, quality: 82 }],
          allow_upscale: false,
          max_byte_size: null
        }
      });
      setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="not-content fa-media-panel">
      <h2>Presets</h2>
      {error ? <p role="alert">Failed to load presets</p> : null}
      <ul className="fa-media-presets">
        {presets.map((preset) => (
          <li key={preset.id ?? preset.name}>
            <strong>{preset.name}</strong>
            {preset.builtin ? (
              <em> built-in (read-only)</em>
            ) : (
              <button type="button" onClick={() => preset.id && void remove(preset.id)}>
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
      <fieldset>
        <legend>New preset</legend>
        <div className="fa-media-field-control">
          <label className={labelClassName} htmlFor="fa-media-preset-name">Name</label>
          <input id="fa-media-preset-name" className={inputClassName} value={name} onChange={(event) => setName(event.currentTarget.value)} />
        </div>
        <div className="fa-media-field-control">
          <label className={labelClassName} htmlFor="fa-media-preset-width">Width</label>
          <input id="fa-media-preset-width" className={inputClassName} type="number" min={1} value={width} onChange={(event) => setWidth(Number(event.currentTarget.value))} />
        </div>
        <div className="fa-media-field-control">
          <label className={labelClassName} htmlFor="fa-media-preset-format">Format</label>
          <select id="fa-media-preset-format" className={inputClassName} value={format} onChange={(event) => setFormat(event.currentTarget.value as ImageFormat)}>
            {FORMATS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <button type="button" disabled={busy} onClick={() => void add()}>
          Add preset
        </button>
      </fieldset>
    </section>
  );
}
