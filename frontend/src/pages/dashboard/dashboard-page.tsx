import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Toast } from '@/components/ui/toast'
import { useBuckets } from '@/hooks/use-buckets'
import { useToast } from '@/hooks/use-toast'
import { Sidebar } from './sidebar'
import { BucketView } from './bucket-view'

type Props = {
  username: string
  onLogout: () => Promise<void>
}

export function DashboardPage({ username, onLogout }: Props) {
  const navigate = useNavigate()
  const { buckets, refresh, create, remove, regenerate } = useBuckets(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createErr, setCreateErr] = useState('')
  const [confirmDelBucket, setConfirmDelBucket] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const { toast, ok, err } = useToast()

  useEffect(() => {
    if (selected && !buckets.find((b) => b.name === selected)) setSelected(null)
    if (!selected && buckets.length > 0) setSelected(buckets[0].name)
  }, [buckets, selected])

  const current = useMemo(
    () => (selected ? buckets.find((b) => b.name === selected) ?? null : null),
    [buckets, selected],
  )

  const handleLogout = async () => {
    await onLogout()
    navigate('/login', { replace: true })
  }

  const openNew = () => { setNewName(''); setCreateErr(''); setCreating(true) }

  const handleCreate = async () => {
    setCreateErr('')
    try {
      const created = await create(newName.trim())
      setCreating(false)
      setNewName('')
      setSelected(created.name)
      ok(`Bucket "${created.name}" created`)
    } catch (e) {
      setCreateErr((e as Error).message)
    }
  }

  const handleDeleteBucket = async () => {
    if (!current) return
    setConfirmDelBucket(false)
    try {
      await remove(current.name)
      ok(`Bucket "${current.name}" deleted`)
      setSelected(null)
      await refresh()
    } catch (e) {
      err((e as Error).message)
    }
  }

  const handleRegenerate = async () => {
    if (!current) return
    setConfirmRegen(false)
    try {
      const updated = await regenerate(current.name)
      await navigator.clipboard.writeText(updated.api_key)
      ok('Key regenerated and copied')
    } catch (e) {
      err((e as Error).message)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-mark">
          <span className="logo-square">A</span>
          <span>Artifact Store</span>
        </div>
        <div className="crumbs">
          <span className="sep">/</span>
          {current ? (
            <span className="item active mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
              {current.name}
            </span>
          ) : (
            <span className="item active">Dashboard</span>
          )}
        </div>
        <div className="topbar-spacer" />
        <div className="topbar-actions">
          <div className="user-chip">
            <span className="avatar">{username.slice(0, 1).toUpperCase()}</span>
            <span>{username}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => void handleLogout()}>
            <LogOut size={13} /> Log out
          </button>
        </div>
      </header>

      <div className="shell">
        <Sidebar
          buckets={buckets}
          selected={selected}
          onSelect={setSelected}
          onNew={openNew}
        />

        <main className="main">
          {current ? (
            <BucketView
              bucket={current}
              onRequestDeleteBucket={() => setConfirmDelBucket(true)}
              onRequestRegenerate={() => setConfirmRegen(true)}
              toastOk={ok}
              toastErr={err}
            />
          ) : (
            <div className="empty-state">
              <div>No bucket selected.</div>
              <button className="btn btn-primary" onClick={openNew}>Create your first bucket</button>
            </div>
          )}
        </main>
      </div>

      <Modal
        open={creating}
        title="New bucket"
        subtitle="3-32 characters, lowercase, digits or hyphens. Must start with a letter."
        onClose={() => setCreating(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void handleCreate()}>Create bucket</button>
          </>
        }
      >
        <div className="field-group">
          <label className="label" htmlFor="new-bucket-name">Name</label>
          <input
            id="new-bucket-name"
            className="input input-lg mono"
            type="text"
            placeholder="builds"
            autoComplete="off"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate() }}
          />
        </div>
        {createErr && <div className="field-error">{createErr}</div>}
      </Modal>

      <Modal
        open={confirmDelBucket}
        title="Delete bucket"
        onClose={() => setConfirmDelBucket(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmDelBucket(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => void handleDeleteBucket()}>Delete bucket</button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--fg-1)' }}>
          Delete <strong>{current?.name}</strong> and all of its files. This action is irreversible.
        </p>
      </Modal>

      <Modal
        open={confirmRegen}
        title="Regenerate API key"
        onClose={() => setConfirmRegen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmRegen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void handleRegenerate()}>Regenerate</button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--fg-1)' }}>
          Regenerate the API key for bucket <strong>{current?.name}</strong>. CI jobs using the
          current key will stop working.
        </p>
      </Modal>

      <Toast state={toast} />
    </div>
  )
}
