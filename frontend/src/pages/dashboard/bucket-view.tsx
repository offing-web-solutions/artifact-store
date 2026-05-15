import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Eye, EyeOff, FileText, KeyRound, Package, RefreshCw, RotateCw, Settings, Trash2 } from 'lucide-react'
import {
  apiDeleteFile,
  apiListFiles,
  apiSignFile,
  type Bucket,
  type FileEntry,
} from '@/services/api'
import { fmtRelative, fmtSize } from '@/components/ui/format'
import { Modal } from '@/components/ui/modal'
import { Snippet } from '@/components/ui/snippet'
import { Dropzone } from './dropzone'
import { FilesTable } from './files-table'

type Props = {
  bucket: Bucket
  onRequestDeleteBucket: () => void
  onRequestRegenerate: () => void
  toastOk: (msg: string) => void
  toastErr: (msg: string) => void
}

type Tab = 'files' | 'key' | 'settings'

export function BucketView({
  bucket,
  onRequestDeleteBucket,
  onRequestRegenerate,
  toastOk,
  toastErr,
}: Props) {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('files')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiListFiles(bucket.name, bucket.api_key)
      setFiles(data.files)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [bucket.name, bucket.api_key])

  useEffect(() => {
    setRevealed(false)
    setTab('files')
    void refresh()
  }, [bucket.name, refresh])

  const totalSize = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files])
  const lastUpload = useMemo(
    () => files.reduce((max, f) => (f.modified_at > max ? f.modified_at : max), 0),
    [files],
  )

  const sign = async (path: string) => {
    try {
      const res = await apiSignFile(bucket.name, path, bucket.api_key)
      await navigator.clipboard.writeText(res.url)
      toastOk('Signed URL copied (1h)')
    } catch (e) {
      toastErr((e as Error).message)
    }
  }

  const performDelete = async () => {
    if (!confirmDel) return
    const path = confirmDel
    setConfirmDel(null)
    try {
      await apiDeleteFile(bucket.name, path, bucket.api_key)
      toastOk(`Deleted: ${path}`)
      await refresh()
    } catch (e) {
      toastErr((e as Error).message)
    }
  }

  const copyKey = async () => {
    await navigator.clipboard.writeText(bucket.api_key)
    toastOk('API key copied')
  }

  const masked = '•'.repeat(48)
  const bucketUrl = `${window.location.host}/files/${bucket.name}`

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="bucket-icon"><Package size={16} /></div>
          <h1 className="page-title">{bucket.name}</h1>
          <span className="badge badge-green"><span className="dot" />active</span>
          <span className="badge badge-neutral">private</span>
          <div className="page-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => void refresh()} title="Refresh">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>
        <div className="detail-meta">
          <span className="mono">{bucketUrl}</span>
          <span className="sep">·</span>
          <span>{files.length} file{files.length === 1 ? '' : 's'}</span>
          <span className="sep">·</span>
          <span>{fmtSize(totalSize)} on disk</span>
          <span className="sep">·</span>
          <span>
            {lastUpload > 0 ? `last upload ${fmtRelative(lastUpload)}` : 'no uploads yet'}
          </span>
          <span className="sep">·</span>
          <span>created {fmtRelative(bucket.created_at)}</span>
        </div>
        <div className="tabs">
          <button className={`tab ${tab === 'files' ? 'active' : ''}`} onClick={() => setTab('files')}>
            <FileText size={13} /> Files <span className="count">{files.length}</span>
          </button>
          <button className={`tab ${tab === 'key' ? 'active' : ''}`} onClick={() => setTab('key')}>
            <KeyRound size={13} /> API key
          </button>
          <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
            <Settings size={13} /> Settings
          </button>
        </div>
      </div>

      <div className="page-body">
        {tab === 'files' && (
          <>
            <Dropzone bucket={bucket} onUploaded={() => void refresh()} onError={toastErr} />
            <FilesTable
              files={files}
              loading={loading}
              error={error}
              onSign={(p) => void sign(p)}
              onDelete={(p) => setConfirmDel(p)}
            />
          </>
        )}

        {tab === 'key' && <ApiKeyTab
          bucket={bucket}
          revealed={revealed}
          setRevealed={setRevealed}
          copyKey={() => void copyKey()}
          masked={masked}
        />}

        {tab === 'settings' && (
          <div className="section-card" style={{ maxWidth: 720 }}>
            <h3 className="h">Danger zone</h3>
            <p className="s">
              Irreversible actions. Regenerating the API key disables existing CI integrations;
              deleting the bucket removes all of its files.
            </p>
            <div className="danger-row">
              <div className="info">
                <p className="t">Regenerate API key</p>
                <p className="d">A new key is generated and copied to your clipboard.
                The old key stops working immediately.</p>
              </div>
              <button className="btn btn-secondary" onClick={onRequestRegenerate}>
                <RotateCw size={13} /> Regenerate
              </button>
            </div>
            <div className="danger-row">
              <div className="info">
                <p className="t">Delete bucket</p>
                <p className="d">Permanently remove <strong>{bucket.name}</strong> and all of its
                files. Cannot be undone.</p>
              </div>
              <button className="btn btn-danger" onClick={onRequestDeleteBucket}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={confirmDel !== null}
        title="Delete file"
        onClose={() => setConfirmDel(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => void performDelete()}>Delete</button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--fg-1)' }}>
          Delete <span className="mono">{confirmDel}</span> from bucket <strong>{bucket.name}</strong>.
        </p>
      </Modal>
    </>
  )
}

// ── Tab content: API key + ready-to-paste curl recipes ─────────────────────

type ApiKeyTabProps = {
  bucket: Bucket
  revealed: boolean
  setRevealed: (v: boolean | ((p: boolean) => boolean)) => void
  copyKey: () => void
  masked: string
}

function ApiKeyTab({ bucket, revealed, setRevealed, copyKey, masked }: ApiKeyTabProps) {
  const origin = window.location.origin
  const samplePath = 'v1.0.0/dist.tar.gz'
  const keyPh = '$API_KEY'

  const uploadCmd =
    `curl -X POST -H "X-API-Key: ${keyPh}" \\\n` +
    `     -F "file=@./dist.tar.gz" \\\n` +
    `     ${origin}/upload/${bucket.name}/${samplePath}`

  const signCmd =
    `# 1. Get a temporary URL (valid 1 hour)\n` +
    `URL=$(curl -s -X POST -H "X-API-Key: ${keyPh}" \\\n` +
    `       ${origin}/sign/${bucket.name}/${samplePath}?expires_in=3600 \\\n` +
    `     | jq -r .url)\n` +
    `\n` +
    `# 2. Download (no auth needed, just the signed URL)\n` +
    `curl -L -o dist.tar.gz "$URL"`

  const listCmd =
    `curl -H "X-API-Key: ${keyPh}" \\\n` +
    `     ${origin}/list/${bucket.name}`

  return (
    <div className="section-card" style={{ maxWidth: 760 }}>
      <h3 className="h">API key</h3>
      <p className="s">
        Send this key in the <span className="mono">X-API-Key</span> header to upload, list, sign,
        or delete files in this bucket. Scoped to <strong>{bucket.name}</strong> — cannot read or
        write any other bucket.
      </p>
      <div className="secret-input">
        <input readOnly value={revealed ? bucket.api_key : masked} />
        <div className="secret-actions">
          <button onClick={() => setRevealed((v) => !v)}>
            {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
            {revealed ? 'Hide' : 'Show'}
          </button>
          <button onClick={copyKey}>
            <Copy size={12} /> Copy
          </button>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Snippet
          label="Push from your CI"
          copyText={uploadCmd}
        >
          <span className="k">curl</span> -X POST -H <span className="v">"X-API-Key: {keyPh}"</span> \{'\n'}
          {'     '}-F <span className="v">"file=@./dist.tar.gz"</span> \{'\n'}
          {'     '}<span className="v">{origin}/upload/{bucket.name}/{samplePath}</span>
        </Snippet>

        <Snippet
          label="Pull a file (signed URL)"
          copyText={signCmd}
        >
          <span className="c"># 1. Get a temporary URL (valid 1 hour)</span>{'\n'}
          <span className="v">URL</span>=$(<span className="k">curl</span> -s -X POST -H <span className="v">"X-API-Key: {keyPh}"</span> \{'\n'}
          {'       '}<span className="v">{origin}/sign/{bucket.name}/{samplePath}?expires_in=3600</span> \{'\n'}
          {'     '}| <span className="k">jq</span> -r .url){'\n'}
          {'\n'}
          <span className="c"># 2. Download (no auth needed, just the signed URL)</span>{'\n'}
          <span className="k">curl</span> -L -o dist.tar.gz <span className="v">"$URL"</span>
        </Snippet>

        <Snippet
          label="List all files in this bucket"
          copyText={listCmd}
        >
          <span className="k">curl</span> -H <span className="v">"X-API-Key: {keyPh}"</span> \{'\n'}
          {'     '}<span className="v">{origin}/list/{bucket.name}</span>
        </Snippet>
      </div>
    </div>
  )
}
