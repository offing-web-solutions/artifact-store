import type { ToastState } from '@/hooks/use-toast'

export function Toast({ state }: { state: ToastState }) {
  if (!state) return null
  return (
    <div className={`toast ${state.kind === 'err' ? 'err' : ''}`}>
      <span className="dot" />
      <span>{state.msg}</span>
    </div>
  )
}
