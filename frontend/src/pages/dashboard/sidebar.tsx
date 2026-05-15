import { Package, Plus } from 'lucide-react'
import type { Bucket } from '@/services/api'

type Props = {
  buckets: Bucket[]
  selected: string | null
  onSelect: (name: string) => void
  onNew: () => void
}

export function Sidebar({ buckets, selected, onSelect, onNew }: Props) {
  return (
    <aside className="sidebar">
      <div className="side-section">
        <span>Buckets</span>
        <button className="add-btn" title="Create bucket" onClick={onNew}>
          <Plus size={12} strokeWidth={2.5} />
        </button>
      </div>
      <div className="side-list">
        {buckets.length === 0 ? (
          <div className="nav-empty">No buckets yet</div>
        ) : (
          buckets.map((b) => (
            <div
              key={b.name}
              className={`nav-item ${b.name === selected ? 'active' : ''}`}
              onClick={() => onSelect(b.name)}
            >
              <span className="nav-icon"><Package size={14} /></span>
              <span className="nav-label">{b.name}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
