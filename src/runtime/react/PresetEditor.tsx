import { useState } from "react";
import { useMediaPresets } from "../hooks/useMediaPresets.js";
import type { ImageFormat } from "../schemas.js";

const FORMATS: ImageFormat[] = ["WEBP", "JPEG", "PNG", "GIF", "AVIF"];

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
    <section className="fa-media-panel">
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
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.currentTarget.value)} />
        </label>
        <label>
          Width
          <input type="number" min={1} value={width} onChange={(event) => setWidth(Number(event.currentTarget.value))} />
        </label>
        <label>
          Format
          <select value={format} onChange={(event) => setFormat(event.currentTarget.value as ImageFormat)}>
            {FORMATS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy} onClick={() => void add()}>
          Add preset
        </button>
      </fieldset>
    </section>
  );
}
