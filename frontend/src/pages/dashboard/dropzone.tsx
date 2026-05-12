import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { fmtSize } from '@/components/ui/format'
import type { Bucket } from '@/services/api'
import { apiUploadFile } from '@/services/api'

type Props = {
  bucket: Bucket
  onUploaded: () => void
  onError: (msg: string) => void
}

type Row = { path: string; status: 'pending' | 'ok' | 'err'; info: string }

export function Dropzone({ bucket, onUploaded, onError }: Props) {
  const [over, setOver] = useState(false)
  const [prefix, setPrefix] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const upload = async (files: File[]) => {
    if (!files.length) return
    const cleanPrefix = prefix.trim().replace(/^\/+|\/+$/g, '')
    const next: Row[] = files.map((f) => ({
      path: (cleanPrefix ? `${cleanPrefix}/` : '') + f.name,
      status: 'pending',
      info: '',
    }))
    setRows((prev) => [...prev, ...next])

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const path = next[i].path
      try {
        const res = await apiUploadFile(bucket.name, path, bucket.api_key, file)
        setRows((prev) =>
          prev.map((r) => (r.path === path && r.status === 'pending'
            ? { ...r, status: 'ok', info: fmtSize(res.size) } : r)),
        )
      } catch (e) {
        const msg = (e as Error).message
        setRows((prev) =>
          prev.map((r) => (r.path === path && r.status === 'pending'
            ? { ...r, status: 'err', info: msg } : r)),
        )
        onError(msg)
      }
    }
    onUploaded()
    window.setTimeout(() => setRows([]), 5000)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div
      className={`dropzone ${over ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false)
        void upload([...e.dataTransfer.files])
      }}
      onClick={() => fileInputRef.current?.click()}
    >
      <div className="dz-icon"><UploadCloud size={28} strokeWidth={1.4} /></div>
      <h4>Drag files here or <span className="pick">browse</span></h4>
      <p>Uploaded files are signed and served via temporary URLs.</p>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => void upload([...(e.target.files ?? [])])}
      />
      <div className="dropzone-prefix" onClick={(e) => e.stopPropagation()}>
        <input
          className="input"
          type="text"
          placeholder="optional prefix (e.g. builds/v1.2.3/)"
          autoComplete="off"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
        />
      </div>
      {rows.length > 0 && (
        <div className="uploads">
          {rows.map((r) => (
            <div key={r.path} className={`row ${r.status === 'ok' ? 'ok' : r.status === 'err' ? 'err' : ''}`}>
              {r.status === 'ok' ? '✓' : r.status === 'err' ? '✗' : '↑'} {r.path}
              {r.info && <>  ({r.info})</>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
