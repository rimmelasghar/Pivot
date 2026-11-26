export interface SessionCreated {
  sessionId: string;
  desktopToken: string;
  pairUrl: string;
}

export interface SessionState {
  sessionId: string;
  modelUrl: string | null;
  modelName: string | null;
  phoneConnected: boolean;
}

export interface ModelUploaded {
  modelUrl: string;
  modelName: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  unsupported_type: "Only .glb and .gltf files are supported.",
  too_large: "That file is too large.",
  invalid_model: "That file is not a valid glTF model.",
  session_expired: "This session has expired. Reload the page.",
  bad_token: "Not allowed to change this session.",
};

/** Turn an error response body into an ApiError with a readable message. */
export function toApiError(status: number, body: unknown): ApiError {
  const data = (body ?? {}) as { detail?: unknown; message?: unknown };
  const code = typeof data.detail === "string" ? data.detail : `http_${status}`;
  const message =
    typeof data.message === "string"
      ? data.message
      : (MESSAGES[code] ?? `Request failed (${status})`);
  return new ApiError(status, code, message);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

export const createSession = () => request<SessionCreated>("/api/sessions", { method: "POST" });

export const getSession = (id: string) =>
  request<SessionState>(`/api/sessions/${encodeURIComponent(id)}`);

export const getPublicUrl = () => request<{ url: string }>("/api/public-url");

/** Upload with progress (fetch has no upload progress events, so XHR). */
export function uploadModel(
  sessionId: string,
  token: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<ModelUploaded> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/sessions/${encodeURIComponent(sessionId)}/model`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as ModelUploaded);
      else reject(toApiError(xhr.status, xhr.response));
    };
    xhr.onerror = () => reject(new ApiError(0, "network", "Network error during upload."));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

const ALLOWED = [".glb", ".gltf"];

/** Client-side pre-check so obvious mistakes fail before uploading. */
export function checkFile(file: { name: string; size: number }, maxMb = 50): string | null {
  const name = file.name.toLowerCase();
  if (!ALLOWED.some((ext) => name.endsWith(ext))) return MESSAGES.unsupported_type;
  if (file.size > maxMb * 1024 * 1024) return `That file is larger than ${maxMb} MB.`;
  if (file.size === 0) return "That file is empty.";
  return null;
}
