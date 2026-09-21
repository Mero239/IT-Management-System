import { useEffect, useState } from 'react'
import { navConfigApi } from '../api/client'
import { NAV_CATALOG, DEFAULT_STRUCTURE, moveItem, mergeWithDefaults } from '../navConfig'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'

function EditableLabel({ text, editing, onStartEdit, onChange, onCommit }) {
  if (editing) {
    return (
      <input
        autoFocus
        className="text-sm font-medium text-slate-700 flex-1 border-b-2 border-yellow-400 outline-none bg-transparent"
        value={text}
        onChange={e => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={e => { if (e.key === 'Enter') onCommit() }}
        onClick={e => e.stopPropagation()}
      />
    )
  }
  return (
    <span className="text-sm font-medium text-slate-700 flex-1 flex items-center gap-1.5">
      {text}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onStartEdit() }}
        className="text-slate-400 hover:text-yellow-600 text-xs"
        title="تعديل الاسم"
      >
        ✏️
      </button>
    </span>
  )
}

function Row({ itemKey, label, icon, isGroup, expanded, onToggleExpand, onDragStart, onDropHere, indent, nested, editing, onStartEdit, onChangeLabel, onCommitLabel, isDragging, isDragOver, onDragEnter, onDragLeave }) {
  return (
    <div
      draggable={!editing}
      onDragStart={e => {
        // Firefox (and some Chrome builds) refuse to start a native drag at
        // all unless dataTransfer carries data — an empty string is enough.
        e.dataTransfer.setData('text/plain', itemKey || '')
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnter={e => { e.preventDefault(); onDragEnter() }}
      onDragLeave={onDragLeave}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDrop={e => { e.preventDefault(); onDropHere() }}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 bg-white transition-colors ${editing ? '' : 'cursor-grab active:cursor-grabbing'} ${
        isDragging ? 'opacity-40 border-slate-200' : isDragOver ? 'border-yellow-500 bg-yellow-50' : 'border-slate-200 hover:border-yellow-300'
      } ${indent ? 'ms-6' : ''} ${nested ? 'border-dashed' : ''}`}
    >
      <span className="text-slate-300 text-sm select-none">⠿</span>
      <span className="text-lg">{icon}</span>
      <EditableLabel
        text={label}
        editing={editing}
        onStartEdit={onStartEdit}
        onChange={onChangeLabel}
        onCommit={onCommitLabel}
      />
      {isGroup && (
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-xs text-slate-400 hover:text-slate-600 px-1"
        >
          {expanded ? '▾ طي' : '▸ توسيع'}
        </button>
      )}
    </div>
  )
}

export default function MenuCustomizer() {
  const { t } = useLanguage()
  const [structure, setStructure] = useState(null)
  const [labels, setLabels] = useState({})
  const [expanded, setExpanded] = useState(() => new Set(DEFAULT_STRUCTURE.filter(s => s.children).map(s => s.key)))
  const [draggedKey, setDraggedKey] = useState(null)
  const [dragOverKey, setDragOverKey] = useState(null)
  const [editingKey, setEditingKey] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    navConfigApi.get().then(r => {
      setStructure(r.data?.sections?.length ? mergeWithDefaults(r.data.sections) : DEFAULT_STRUCTURE)
      setLabels(r.data?.labels || {})
    }).catch(() => setStructure(DEFAULT_STRUCTURE))
  }, [])

  const toggleExpand = (key) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const applyMove = (target) => {
    if (!draggedKey) return
    setStructure(s => moveItem(s, draggedKey, target))
    setDraggedKey(null)
    setDragOverKey(null)
  }

  const labelFor = (key) => labels[key] || t(key)

  const handleSave = async () => {
    setSaving(true)
    try {
      await navConfigApi.save(structure, labels)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const handleReset = async () => {
    setStructure(DEFAULT_STRUCTURE)
    setLabels({})
    await navConfigApi.reset().catch(() => {})
  }

  if (!structure) return <div className="py-12 text-center text-slate-400 text-sm">جاري التحميل...</div>

  return (
    <div className="space-y-4 max-w-2xl">
      <Header
        title="تخصيص المنيو"
        subtitle="ده خاص بحسابك أنت بس — اسحب وأفلت عناصر المنيو الجانبي لإعادة ترتيبها، أو اضغط ✏️ لتغيير اسم أي عنصر"
      />

      <div className="card !p-4 space-y-2">
        {structure.map(sec => {
          const meta = NAV_CATALOG[sec.key]
          if (!meta) return null
          const isGroup = !!sec.children
          return (
            <div key={sec.key} className="space-y-1.5">
              <Row
                itemKey={sec.key}
                label={labelFor(sec.key)}
                icon={meta.icon}
                isGroup={isGroup}
                expanded={expanded.has(sec.key)}
                onToggleExpand={() => toggleExpand(sec.key)}
                onDragStart={() => setDraggedKey(sec.key)}
                onDropHere={() => applyMove(isGroup ? { type: 'into-group', groupKey: sec.key } : { type: 'top-before', beforeKey: sec.key })}
                isDragging={draggedKey === sec.key}
                isDragOver={dragOverKey === sec.key}
                onDragEnter={() => setDragOverKey(sec.key)}
                onDragLeave={() => setDragOverKey(k => k === sec.key ? null : k)}
                editing={editingKey === sec.key}
                onStartEdit={() => setEditingKey(sec.key)}
                onChangeLabel={(val) => setLabels(l => ({ ...l, [sec.key]: val }))}
                onCommitLabel={() => setEditingKey(null)}
              />
              {isGroup && expanded.has(sec.key) && (
                <div className="space-y-1.5">
                  {(sec.children || []).map(ck => {
                    const cmeta = NAV_CATALOG[ck]
                    if (!cmeta) return null
                    return (
                      <Row
                        key={ck}
                        itemKey={ck}
                        label={labelFor(ck)}
                        icon={cmeta.icon}
                        indent
                        nested
                        onDragStart={() => setDraggedKey(ck)}
                        onDropHere={() => applyMove({ type: 'child-before', groupKey: sec.key, beforeKey: ck })}
                        isDragging={draggedKey === ck}
                        isDragOver={dragOverKey === ck}
                        onDragEnter={() => setDragOverKey(ck)}
                        onDragLeave={() => setDragOverKey(k => k === ck ? null : k)}
                        editing={editingKey === ck}
                        onStartEdit={() => setEditingKey(ck)}
                        onChangeLabel={(val) => setLabels(l => ({ ...l, [ck]: val }))}
                        onCommitLabel={() => setEditingKey(null)}
                      />
                    )
                  })}
                  {sec.children?.length === 0 && (
                    <p className="ms-6 text-xs text-slate-300 py-1">لا عناصر — اسحب عنصر واحطه فوق اسم المجموعة</p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Drop zone to move an item to the very end of the top level */}
        <div
          onDragEnter={e => e.preventDefault()}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
          onDrop={e => { e.preventDefault(); applyMove({ type: 'top-end' }) }}
          className="border-2 border-dashed border-slate-200 rounded-xl py-3 text-center text-xs text-slate-300"
        >
          اسحب هنا لنقل عنصر لآخر القائمة (أو لإخراجه من مجموعة)
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-40">
          {saving ? 'جاري الحفظ...' : saved ? 'تم الحفظ ✓' : 'حفظ'}
        </button>
        <button onClick={handleReset} className="btn-secondary">إعادة الافتراضي</button>
      </div>
    </div>
  )
}
