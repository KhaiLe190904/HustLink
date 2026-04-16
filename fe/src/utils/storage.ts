const BASE_URL = import.meta.env.VITE_API_URL;
export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_LABEL = "25MB";

export interface StoredObjectResponse {
  id: number;
  scope: string;
  bucketName: string;
  objectKey: string;
  originalFileName: string;
  contentType: string;
  sizeInBytes: number;
  publicRead: boolean;
  accessUrl: string;
  apiPath: string | null;
  uploadedAt: string;
}

export function isOversizedUpload(file: File) {
  return file.size > MAX_UPLOAD_SIZE_BYTES;
}

interface UploadStorageParams {
  file: File;
  scope:
    | "PROFILE_IMAGE"
    | "PROFILE_COVER"
    | "FEED_IMAGE"
    | "FEED_VIDEO"
    | "MESSAGE_IMAGE"
    | "MESSAGE_FILE"
    | "MESSAGE_VIDEO";
  ownerType?: string;
  ownerId?: number | string;
}

export async function uploadToStorage({
  file,
  scope,
  ownerType,
  ownerId,
}: UploadStorageParams): Promise<StoredObjectResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scope", scope);
  if (ownerType) {
    formData.append("ownerType", ownerType);
  }
  if (ownerId !== undefined) {
    formData.append("ownerId", String(ownerId));
  }

  const response = await fetch(`${BASE_URL}/api/v1/storage/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const { message } = await response.json();
    throw new Error(message);
  }

  return response.json();
}

export async function fetchPrivateDownloadUrl(
  storedObjectId: number
): Promise<string> {
  const response = await fetch(
    `${BASE_URL}/api/v1/storage/objects/${storedObjectId}/download-url`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }
  );

  if (!response.ok) {
    const { message } = await response.json();
    throw new Error(message);
  }

  const data = await response.json();
  return data.url;
}

export async function downloadPrivateObject(
  storedObjectId: number,
  fileName?: string
) {
  const url = await fetchPrivateDownloadUrl(storedObjectId);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to download attachment.");
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName || "attachment";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(objectUrl);
}

export function resolveMediaUrl(url?: string | null) {
  if (!url) {
    return "";
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${BASE_URL}${url}`;
  }
  return url;
}

export function isVideoFile(url?: string | null, contentType?: string | null) {
  if (contentType?.startsWith("video/")) {
    return true;
  }
  if (!url) {
    return false;
  }
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export function isPdfFile(url?: string | null, contentType?: string | null) {
  if (contentType === "application/pdf") {
    return true;
  }
  if (!url) {
    return false;
  }
  return /\.pdf(\?|$)/i.test(url);
}
