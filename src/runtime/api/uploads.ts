import { request } from "../client.js";
import {
  UploadCompleteResponseSchema,
  UploadInitiateResponseSchema,
  type UploadCompleteRequest,
  type UploadCompleteResponse,
  type UploadInitiateRequest,
  type UploadInitiateResponse
} from "../schemas.js";

export function initiateUpload(body: UploadInitiateRequest): Promise<UploadInitiateResponse> {
  return request({
    method: "POST",
    path: "/uploads/initiate",
    body,
    schema: UploadInitiateResponseSchema,
    auth: true
  });
}

export function completeUpload(
  sessionId: string,
  body: UploadCompleteRequest = {}
): Promise<UploadCompleteResponse> {
  return request({
    method: "POST",
    path: `/uploads/${encodeURIComponent(sessionId)}/complete`,
    body,
    schema: UploadCompleteResponseSchema,
    auth: true
  });
}

export function abortUpload(sessionId: string): Promise<void> {
  return request({
    method: "POST",
    path: `/uploads/${encodeURIComponent(sessionId)}/abort`,
    auth: true
  });
}
