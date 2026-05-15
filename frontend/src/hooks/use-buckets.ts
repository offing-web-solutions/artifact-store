import { useCallback, useEffect, useState } from 'react'
import {
  apiCreateBucket,
  apiDeleteBucket,
  apiListBuckets,
  apiRegenerateBucketKey,
  type Bucket,
} from '@/services/api'

export function useBuckets(enabled: boolean) {
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiListBuckets()
      setBuckets(data.buckets)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) void refresh()
  }, [enabled, refresh])

  const create = async (name: string): Promise<Bucket> => {
    const created = await apiCreateBucket(name)
    setBuckets((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    return created
  }

  const remove = async (name: string) => {
    await apiDeleteBucket(name)
    setBuckets((prev) => prev.filter((b) => b.name !== name))
  }

  const regenerate = async (name: string): Promise<Bucket> => {
    const updated = await apiRegenerateBucketKey(name)
    setBuckets((prev) => prev.map((b) => (b.name === name ? updated : b)))
    return updated
  }

  return { buckets, loading, error, refresh, create, remove, regenerate }
}
