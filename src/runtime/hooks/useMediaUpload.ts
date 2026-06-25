import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  createMediaUploadController,
  type UploadControllerInput,
  type UploadProgress
} from "../upload/uploadController.js";
import { mediaKeys } from "../queryKeys.js";
import type { MediaObjectPublic } from "../schemas.js";

export type UseMediaUpload = {
  progress: UploadProgress | null;
  error: unknown;
  busy: boolean;
  upload: (input: UploadControllerInput) => Promise<MediaObjectPublic>;
  abort: () => void;
};

export function useMediaUpload(): UseMediaUpload {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<ReturnType<typeof createMediaUploadController> | null>(null);

  const upload = useCallback(async (input: UploadControllerInput) => {
    const controller = createMediaUploadController(input);
    controllerRef.current = controller;
    controller.on("progress", setProgress);
    setBusy(true);
    setError(null);
    try {
      const object = await controller.start();
      await queryClient.invalidateQueries({ queryKey: mediaKeys.objectLists() });
      return object;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setBusy(false);
      controllerRef.current = null;
    }
  }, [queryClient]);

  const abort = useCallback(() => controllerRef.current?.abort(), []);

  return { progress, error, busy, upload, abort };
}
