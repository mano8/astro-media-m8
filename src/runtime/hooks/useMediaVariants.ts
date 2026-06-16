import { useCallback, useEffect, useState } from "react";
import {
  deleteVariant,
  generateVariants,
  listVariants,
  waitForVariantJob
} from "../api/variants.js";
import type { VariantJobPublic, VariantPublic } from "../schemas.js";

export type UseMediaVariants = {
  items: VariantPublic[];
  loading: boolean;
  error: unknown;
  job: VariantJobPublic | null;
  reload: () => Promise<void>;
  generate: (presets: string[]) => Promise<VariantJobPublic>;
  remove: (variantId: string) => Promise<void>;
};

export function useMediaVariants(objectId: string | null): UseMediaVariants {
  const [items, setItems] = useState<VariantPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [job, setJob] = useState<VariantJobPublic | null>(null);

  const reload = useCallback(async () => {
    if (!objectId) return;
    setLoading(true);
    try {
      const response = await listVariants(objectId);
      setItems(response.items);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [objectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const generate = useCallback(
    async (presets: string[]) => {
      if (!objectId) throw new Error("No object selected");
      const started = await generateVariants(objectId, { presets });
      setJob(started);
      const finished = await waitForVariantJob(objectId, started.id, { onUpdate: setJob });
      await reload();
      return finished;
    },
    [objectId, reload]
  );

  const remove = useCallback(
    async (variantId: string) => {
      if (!objectId) throw new Error("No object selected");
      await deleteVariant(objectId, variantId);
      setItems((prev) => prev.filter((variant) => variant.id !== variantId));
    },
    [objectId]
  );

  return { items, loading, error, job, reload, generate, remove };
}
