import { useCallback, useRef, useState } from "react";
import {
  createMediaUploadController,
  type UploadControllerInput,
  type UploadProgress
} from "../upload/uploadController.js";
import type { MediaObjectPublic } from "../schemas.js";

export type UseMediaUpload = {
  progress: UploadProgress | null;
  error: unknown;
  busy: boolean;
  upload: (input: UploadControllerInput) => Promise<MediaObjectPublic>;
  abort: () => void;
};

export function useMediaUpload(): UseMediaUpload {
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
      return await controller.start();
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setBusy(false);
      controllerRef.current = null;
    }
  }, []);

  const abort = useCallback(() => controllerRef.current?.abort(), []);

  return { progress, error, busy, upload, abort };
}
