// Formato compartido para tamaños y fechas en la tabla de archivos.

export function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
  return `${(b / 1024 ** 3).toFixed(2)} GB`
}

export function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

export function fmtRelative(ts: number): string {
  const diffSec = Math.floor(Date.now() / 1000) - ts
  if (diffSec < 0) return 'in the future'
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d ago`
  if (diffSec < 30 * 86400) return `${Math.floor(diffSec / (7 * 86400))}w ago`
  if (diffSec < 365 * 86400) return `${Math.floor(diffSec / (30 * 86400))}mo ago`
  return `${Math.floor(diffSec / (365 * 86400))}y ago`
}
