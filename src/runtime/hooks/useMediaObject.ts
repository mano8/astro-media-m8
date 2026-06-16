import { useCallback, useEffect, useState } from "react";
import { deleteObject, getObject, updateObject } from "../api/objects.js";
import type { MediaObjectPublic, MediaObjectUpdate } from "../schemas.js";

export type UseMediaObject = {
  object: MediaObjectPublic | null;
  loading: boolean;
  error: unknown;
  reload: () => Promise<void>;
  update: (patch: MediaObjectUpdate) => Promise<MediaObjectPublic>;
  remove: () => Promise<void>;
};

export function useMediaObject(objectId: string | null): UseMediaObject {
  const [object, setObject] = useState<MediaObjectPublic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!objectId) return;
    setLoading(true);
    try {
      setObject(await getObject(objectId));
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

  const update = useCallback(
    async (patch: MediaObjectUpdate) => {
      if (!objectId) throw new Error("No object selected");
      const next = await updateObject(objectId, patch);
      setObject(next);
      return next;
    },
    [objectId]
  );

  const remove = useCallback(async () => {
    if (!objectId) throw new Error("No object selected");
    await deleteObject(objectId);
    setObject(null);
  }, [objectId]);

  return { object, loading, error, reload, update, remove };
}
