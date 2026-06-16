import { useCallback, useEffect, useState } from "react";
import { createPreset, deletePreset, listPresets, updatePreset } from "../api/presets.js";
import type { ImagePresetCreate, ImagePresetPublic, ImagePresetUpdate } from "../schemas.js";

export type UseMediaPresets = {
  presets: ImagePresetPublic[];
  loading: boolean;
  error: unknown;
  reload: () => Promise<void>;
  create: (body: ImagePresetCreate) => Promise<ImagePresetPublic>;
  update: (id: string, body: ImagePresetUpdate) => Promise<ImagePresetPublic>;
  remove: (id: string) => Promise<void>;
};

export function useMediaPresets(): UseMediaPresets {
  const [presets, setPresets] = useState<ImagePresetPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setPresets(await listPresets());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (body: ImagePresetCreate) => {
      const created = await createPreset(body);
      await reload();
      return created;
    },
    [reload]
  );

  const update = useCallback(
    async (id: string, body: ImagePresetUpdate) => {
      const updated = await updatePreset(id, body);
      await reload();
      return updated;
    },
    [reload]
  );

  const remove = useCallback(
    async (id: string) => {
      await deletePreset(id);
      await reload();
    },
    [reload]
  );

  return { presets, loading, error, reload, create, update, remove };
}
