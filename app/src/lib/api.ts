/** The `{ error }` shape every non-2xx API response uses. */
export class ApiError extends Error {
  code: string;
  fields?: Record<string, string>;

  constructor(code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.fields = fields;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch('/api' + path, { credentials: 'include', ...init });
  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const err = body?.error as { code?: string; message?: string; fields?: Record<string, string> } | undefined;
    throw new ApiError(err?.code ?? 'unknown_error', err?.message ?? 'Something went wrong.', err?.fields);
  }
  return body as T;
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, data?: unknown) => request<T>(path, {
    method: 'POST',
    headers: data !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  }),
  postForm: <T,>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form }),
  patch: <T,>(path: string, data: unknown) => request<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  del: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
};
