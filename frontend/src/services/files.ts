import { get, post, del } from './http'

export type FileEntry = {
  path: string
  size: number
  modified_at: number
}

export type ListResult = {
  bucket: string
  files: FileEntry[]
  total: number
}

export type SignResult = {
  url: string
  expires_at: number
  expires_in: number
}

export type UploadResult = {
  bucket: string
  path: string
  size: number
}

const keyHeader = (apiKey: string) => ({ 'X-API-Key': apiKey })

export const apiListFiles = (bucket: string, apiKey: string) =>
  get<ListResult>(`/list/${encodeURIComponent(bucket)}`, { headers: keyHeader(apiKey) })

export const apiUploadFile = (bucket: string, path: string, apiKey: string, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return post<UploadResult>(
    `/upload/${encodeURIComponent(bucket)}/${encodeURI(path)}`,
    { body: fd, headers: keyHeader(apiKey) },
  )
}

export const apiSignFile = (bucket: string, path: string, apiKey: string, expiresIn = 3600) =>
  post<SignResult>(
    `/sign/${encodeURIComponent(bucket)}/${encodeURI(path)}?expires_in=${expiresIn}`,
    { headers: keyHeader(apiKey) },
  )

export const apiDeleteFile = (bucket: string, path: string, apiKey: string) =>
  del<void>(
    `/files/${encodeURIComponent(bucket)}/${encodeURI(path)}`,
    { headers: keyHeader(apiKey) },
  )
