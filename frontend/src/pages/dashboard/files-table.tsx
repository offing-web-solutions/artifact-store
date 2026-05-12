import { Link, Trash2 } from 'lucide-react'
import { fmtDate, fmtSize } from '@/components/ui/format'
import type { FileEntry } from '@/services/api'

type Props = {
  files: FileEntry[]
  loading: boolean
  error: string | null
  onSign: (path: string) => void
  onDelete: (path: string) => void
}

const ICON_EXT_CLASS: Record<string, string> = {
  tar: 't-tar', gz: 't-gz', zip: 't-zip',
  png: 't-img', jpg: 't-img', jpeg: 't-img', svg: 't-img', webp: 't-img',
  bin: 't-bin', exe: 't-bin',
  json: 't-json', yaml: 't-yaml', yml: 't-yaml',
}

function fileExt(path: string): string {
  const m = path.match(/\.([a-z0-9]+)$/i)
  return m ? m[1].toLowerCase() : 'bin'
}

export function FilesTable({ files, loading, error, onSign, onDelete }: Props) {
  return (
    <>
      <div className="toolbar-row">
        <div className="count">
          {loading ? 'Loading…' : `${files.length} file${files.length === 1 ? '' : 's'}`}
        </div>
      </div>
      <div className="table-wrap">
        <table className="file-table">
          <thead>
            <tr>
              <th>Path</th>
              <th style={{ width: 110 }}>Size</th>
              <th style={{ width: 200 }}>Modified</th>
              <th style={{ width: 240 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="empty-row">Loading…</td></tr>
            ) : error ? (
              <tr><td colSpan={4} className="empty-row">Error: {error}</td></tr>
            ) : files.length === 0 ? (
              <tr><td colSpan={4} className="empty-row">No files yet. Drop one above to upload.</td></tr>
            ) : (
              files.map((f) => {
                const ext = fileExt(f.path)
                const iconClass = ICON_EXT_CLASS[ext] ?? ''
                return (
                  <tr key={f.path}>
                    <td>
                      <div className="file-name">
                        <span className={`file-icon ${iconClass}`}>{ext.slice(0, 3)}</span>
                        <span className="mono" style={{ color: 'var(--fg-0)' }}>{f.path}</span>
                      </div>
                    </td>
                    <td className="mono muted">{fmtSize(f.size)}</td>
                    <td className="muted">{fmtDate(f.modified_at)}</td>
                    <td className="actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => onSign(f.path)}>
                        <Link size={12} /> Sign URL
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => onDelete(f.path)}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
