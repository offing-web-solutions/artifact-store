import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Folder, Link, Trash2 } from 'lucide-react'
import { fmtDate, fmtSize } from '@/components/ui/format'
import type { FileEntry } from '@/services/api'

type Props = {
  files: FileEntry[]
  loading: boolean
  error: string | null
  onSign: (path: string) => void
  onDelete: (path: string) => void
}

type FolderNode = {
  kind: 'folder'
  name: string
  path: string
  depth: number
  children: TreeNode[]
}
type FileNode = {
  kind: 'file'
  name: string
  path: string
  depth: number
  file: FileEntry
}
type TreeNode = FolderNode | FileNode

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

function buildTree(files: FileEntry[]): TreeNode[] {
  const root: FolderNode = { kind: 'folder', name: '', path: '', depth: -1, children: [] }
  for (const f of files) {
    const parts = f.path.split('/')
    let current: FolderNode = root
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i]
      const path = parts.slice(0, i + 1).join('/')
      let child = current.children.find(
        (c): c is FolderNode => c.kind === 'folder' && c.name === name,
      )
      if (!child) {
        child = { kind: 'folder', name, path, depth: i, children: [] }
        current.children.push(child)
      }
      current = child
    }
    current.children.push({
      kind: 'file',
      name: parts[parts.length - 1],
      path: f.path,
      depth: parts.length - 1,
      file: f,
    })
  }
  // Carpetas primero, luego ficheros; alfabético dentro de cada grupo
  function sort(nodes: TreeNode[]): void {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) if (n.kind === 'folder') sort(n.children)
  }
  sort(root.children)
  return root.children
}

function flatten(nodes: TreeNode[], collapsed: Set<string>, out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    out.push(n)
    if (n.kind === 'folder' && !collapsed.has(n.path)) {
      flatten(n.children, collapsed, out)
    }
  }
  return out
}

export function FilesTable({ files, loading, error, onSign, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const rows = useMemo(() => flatten(buildTree(files), collapsed), [files, collapsed])

  const toggle = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

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
              rows.map((r) => {
                const indent = { paddingLeft: r.depth * 20 }
                if (r.kind === 'folder') {
                  const isOpen = !collapsed.has(r.path)
                  return (
                    <tr key={`d:${r.path}`} className="row-folder" onClick={() => toggle(r.path)}>
                      <td>
                        <div className="file-name" style={indent}>
                          <span className="tree-chevron">
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                          <span className="file-icon t-folder"><Folder size={12} /></span>
                          <span className="mono" style={{ color: 'var(--fg-0)' }}>{r.name}</span>
                        </div>
                      </td>
                      <td />
                      <td />
                      <td />
                    </tr>
                  )
                }
                const ext = fileExt(r.name)
                const iconClass = ICON_EXT_CLASS[ext] ?? ''
                return (
                  <tr key={`f:${r.path}`}>
                    <td>
                      <div className="file-name" style={indent}>
                        <span className="tree-chevron" />
                        <span className={`file-icon ${iconClass}`}>{ext.slice(0, 3)}</span>
                        <span className="mono" style={{ color: 'var(--fg-0)' }}>{r.name}</span>
                      </div>
                    </td>
                    <td className="mono muted">{fmtSize(r.file.size)}</td>
                    <td className="muted">{fmtDate(r.file.modified_at)}</td>
                    <td className="actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => onSign(r.path)}>
                        <Link size={12} /> Sign URL
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => onDelete(r.path)}>
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
