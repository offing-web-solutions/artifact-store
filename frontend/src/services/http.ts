// Wrapper sobre fetch: serializa JSON, mantiene cookies de sesión y normaliza errores.

export type HttpOptions = {
  body?: unknown
  headers?: Record<string, string>
}

export class HttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, opts: HttpOptions = {}): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: opts.headers ? { ...opts.headers } : {},
  }

  if (opts.body !== undefined) {
    if (opts.body instanceof FormData) {
      init.body = opts.body
    } else {
      ;(init.headers as Record<string, string>)['Content-Type'] = 'application/json'
      init.body = JSON.stringify(opts.body)
    }
  }

  const res = await fetch(path, init)
  if (res.status === 204) return undefined as T

  const ct = res.headers.get('content-type') ?? ''
  const data = ct.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    const detail = (data && (data as { detail?: string }).detail) || (typeof data === 'string' ? data : res.statusText)
    throw new HttpError(detail, res.status)
  }

  return data as T
}

export const get  = <T>(path: string, opts?: HttpOptions) => request<T>('GET', path, opts)
export const post = <T>(path: string, opts?: HttpOptions) => request<T>('POST', path, opts)
export const put  = <T>(path: string, opts?: HttpOptions) => request<T>('PUT', path, opts)
export const del  = <T>(path: string, opts?: HttpOptions) => request<T>('DELETE', path, opts)
