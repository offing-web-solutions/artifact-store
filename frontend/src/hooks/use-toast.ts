import { useCallback, useState } from 'react'

export type ToastKind = 'ok' | 'err'
export type ToastState = { msg: string; kind: ToastKind } | null

export function useToast(autoHideMs = 3500) {
  const [toast, setToast] = useState<ToastState>(null)

  const show = useCallback(
    (msg: string, kind: ToastKind = 'ok') => {
      setToast({ msg, kind })
      window.setTimeout(() => setToast(null), autoHideMs)
    },
    [autoHideMs],
  )

  const ok  = useCallback((msg: string) => show(msg, 'ok'),  [show])
  const err = useCallback((msg: string) => show(msg, 'err'), [show])

  return { toast, ok, err }
}
