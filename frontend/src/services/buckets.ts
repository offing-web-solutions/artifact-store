import { get, post, del } from './http'

export type Bucket = {
  name: string
  api_key: string
  created_at: number
}

export const apiListBuckets = () =>
  get<{ buckets: Bucket[] }>('/admin/buckets')

export const apiCreateBucket = (name: string) =>
  post<Bucket>('/admin/buckets', { body: { name } })

export const apiDeleteBucket = (name: string) =>
  del<void>(`/admin/buckets/${encodeURIComponent(name)}`)

export const apiRegenerateBucketKey = (name: string) =>
  post<Bucket>(`/admin/buckets/${encodeURIComponent(name)}/regenerate`)
