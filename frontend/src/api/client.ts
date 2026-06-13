import { clearSession, getSessionToken } from "../auth/session";

const DEFAULT_TIMEOUT_MS = 12_000;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ErrorPayload = {
  error?: string;
  message?: string;
  code?: string;
};

type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
};

async function readError(response: Response): Promise<ErrorPayload> {
  try {
    return (await response.json()) as ErrorPayload;
  } catch {
    return {};
  }
}

export async function apiRequest(
  input: RequestInfo | URL,
  options: ApiRequestOptions = {},
) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    ...init
  } = options;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();

  externalSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const headers = new Headers(init.headers);
  const token = getSessionToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  try {
    const response = await fetch(input, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (response.status === 401) {
      clearSession();
      throw new ApiError("Your session has expired. Please sign in again.", 401);
    }

    if (!response.ok) {
      const payload = await readError(response);
      throw new ApiError(
        payload.error ||
          payload.message ||
          `Request failed with status ${response.status}`,
        response.status,
        payload.code,
      );
    }

    return response;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      if (externalSignal?.aborted) {
        throw new DOMException("Request aborted", "AbortError");
      }
      throw new ApiError("The server took too long to respond.", 408);
    }
    throw new ApiError(
      error instanceof Error ? error.message : "Network request failed.",
    );
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function apiJson<T>(
  input: RequestInfo | URL,
  options?: ApiRequestOptions,
): Promise<T> {
  const response = await apiRequest(input, options);
  return (await response.json()) as T;
}
