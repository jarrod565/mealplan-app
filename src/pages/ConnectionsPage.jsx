import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useConnectedSources } from '@/contexts/ConnectedSourcesContext'
import { startAirtableOAuth, listAirtableBases, listAirtableTables, listAirtableRecords } from '@/lib/airtable'
import { detectColumnMapping, resolveFieldValue } from '@/lib/airtableMapping'
import { getSourceDomain } from '@/lib/urlImport'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft, ChevronRight, Database, Loader2,
  Plug, Trash2, AlertTriangle, CheckCircle2, ImageOff,
} from 'lucide-react'
import UserAvatar from '@/components/layout/UserAvatar'

const PENDING_CONNECTION_KEY = 'airtable_pending_connection'

export default function ConnectionsPage() {
  const { connections, isLoading, disconnectSource, saveConnection } = useConnectedSources()

  // Wizard state — 'list' is the default Settings → Connections view; the
  // rest are steps in the "Add Connection" flow (CB_12 setup flow).
  const [step, setStep] = useState('list')
  const [pendingTokens, setPendingTokens] = useState(null)
  const [remapConnectionId, setRemapConnectionId] = useState(null) // set = updating an existing connection, not inserting

  const [bases, setBases] = useState([])
  const [basesLoading, setBasesLoading] = useState(false)
  const [selectedBase, setSelectedBase] = useState(null)

  const [tables, setTables] = useState([])
  const [tablesLoading, setTablesLoading] = useState(false)
  const [selectedTable, setSelectedTable] = useState(null)

  const [mappingLoading, setMappingLoading] = useState(false)
  const [sampleRecord, setSampleRecord] = useState(null)
  const [columnMapping, setColumnMapping] = useState({ image: null, title: null, url: null })
  const [saving, setSaving] = useState(false)

  const [disconnectTarget, setDisconnectTarget] = useState(null)

  // Pick up the OAuth handoff left by AirtableCallbackPage and continue
  // straight into base selection.
  useEffect(() => {
    const stored = sessionStorage.getItem(PENDING_CONNECTION_KEY)
    if (!stored) return
    sessionStorage.removeItem(PENDING_CONNECTION_KEY)
    try {
      const tokens = JSON.parse(stored)
      setPendingTokens(tokens)
      goToSelectBase(tokens.access_token)
    } catch {
      toast.error('Could not continue the Airtable connection. Please try again.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetWizard() {
    setStep('list')
    setPendingTokens(null)
    setRemapConnectionId(null)
    setBases([])
    setSelectedBase(null)
    setTables([])
    setSelectedTable(null)
    setSampleRecord(null)
    setColumnMapping({ image: null, title: null, url: null })
  }

  async function goToSelectBase(accessToken) {
    setStep('selectBase')
    setBasesLoading(true)
    try {
      const data = await listAirtableBases(accessToken)
      setBases(data)
    } catch {
      toast.error('Could not load Airtable bases. Please try again.')
      resetWizard()
    } finally {
      setBasesLoading(false)
    }
  }

  async function handleAddConnection() {
    try {
      await startAirtableOAuth()
    } catch {
      toast.error('Airtable connection is not configured yet.')
    }
  }

  async function handleRemap(connection) {
    setRemapConnectionId(connection.id)
    setPendingTokens({ access_token: connection.access_token, refresh_token: connection.refresh_token })
    await goToSelectBase(connection.access_token)
  }

  async function handleSelectBase(base) {
    setSelectedBase(base)
    setStep('selectTable')
    setTablesLoading(true)
    try {
      const data = await listAirtableTables(pendingTokens.access_token, base.id)
      setTables(data)
    } catch {
      toast.error('Could not load tables for that base. Please try again.')
    } finally {
      setTablesLoading(false)
    }
  }

  async function handleSelectTable(table) {
    setSelectedTable(table)
    setStep('mapping')
    setMappingLoading(true)
    try {
      const { records } = await listAirtableRecords(pendingTokens.access_token, selectedBase.id, table.id, { pageSize: 1 })
      const record = records[0] ?? null
      setSampleRecord(record)
      setColumnMapping(detectColumnMapping(table.fields ?? [], record, table.primaryFieldId))
    } catch {
      toast.error('Could not read that table. Please try again.')
    } finally {
      setMappingLoading(false)
    }
  }

  async function handleConfirmMapping() {
    setSaving(true)
    try {
      await saveConnection({
        connectionId: remapConnectionId,
        tokens: pendingTokens,
        base: selectedBase,
        table: selectedTable,
        columnMapping,
      })
      toast.success('Connection saved.')
      resetWizard()
    } catch {
      toast.error('Could not save this connection. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    if (!disconnectTarget) return
    try {
      await disconnectSource(disconnectTarget.id)
      toast.success('Disconnected.')
    } catch {
      toast.error('Could not disconnect. Please try again.')
    } finally {
      setDisconnectTarget(null)
    }
  }

  return (
    <>
      <header className="flex items-center justify-between px-5 py-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {step !== 'list' && (
            <button
              onClick={resetWizard}
              className="p-1.5 -ml-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back to Connections"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h1 className="text-xl font-bold tracking-tight">
            {step === 'list' ? 'Connections' : 'Add Connection'}
          </h1>
        </div>
        <UserAvatar />
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {step === 'list' && (
          <ConnectionsList
            connections={connections}
            isLoading={isLoading}
            onAdd={handleAddConnection}
            onRemap={handleRemap}
            onDisconnect={setDisconnectTarget}
          />
        )}

        {step === 'selectBase' && (
          <PickerList
            title="Select a base"
            loading={basesLoading}
            items={bases.map((b) => ({ id: b.id, name: b.name }))}
            onSelect={handleSelectBase}
          />
        )}

        {step === 'selectTable' && (
          <PickerList
            title={`Select a table in "${selectedBase?.name}"`}
            loading={tablesLoading}
            items={tables}
            onSelect={handleSelectTable}
          />
        )}

        {step === 'mapping' && (
          <MappingStep
            table={selectedTable}
            sampleRecord={sampleRecord}
            loading={mappingLoading}
            columnMapping={columnMapping}
            onChangeMapping={setColumnMapping}
            saving={saving}
            onConfirm={handleConfirmMapping}
            onCancel={resetWizard}
          />
        )}
      </div>

      <AlertDialog open={!!disconnectTarget} onOpenChange={(open) => !open && setDisconnectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect this source?</AlertDialogTitle>
            <AlertDialogDescription>
              {disconnectTarget?.base_name} / {disconnectTarget?.table_name} will no longer appear in
              For You. Cards already in your basket are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ConnectionsList({ connections, isLoading, onAdd, onRemap, onDisconnect }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading connections…</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {connections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <Plug className="w-7 h-7 text-primary/50" />
          </div>
          <div>
            <p className="font-semibold text-base">No sources connected</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-xs">
              Connect an Airtable base to bring your own recipes into For You.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                <Database className="w-4 h-4 text-primary/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug truncate">
                  {c.base_name} / {c.table_name}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  {c.status === 'connected' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {c.status === 'connected' ? 'Connected' : 'Reconnect needed'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => onRemap(c)}>
                  Remap
                </Button>
                <button
                  onClick={() => onDisconnect(c)}
                  className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label={`Disconnect ${c.base_name} / ${c.table_name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button onClick={onAdd} className="w-full gap-2">
        <Plug className="w-4 h-4" />
        Add Connection
      </Button>

      <Button asChild variant="ghost" className="w-full text-muted-foreground">
        <Link to="/settings">Back to Settings</Link>
      </Button>
    </div>
  )
}

function PickerList({ title, loading, items, onSelect }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nothing found.</p>
      ) : (
        <div className="rounded-2xl border bg-card divide-y overflow-hidden">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-secondary/50 transition-colors text-left"
            >
              {item.name}
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const MAPPING_FIELDS = [
  { key: 'image', label: 'Image column', required: false },
  { key: 'title', label: 'Title column', required: false },
  { key: 'url', label: 'Destination URL column', required: true },
]

function MappingStep({ table, sampleRecord, loading, columnMapping, onChangeMapping, saving, onConfirm, onCancel }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Reading table…</span>
      </div>
    )
  }

  const fields = table?.fields ?? []
  const fieldByName = new Map(fields.map((f) => [f.name, f]))

  function fieldValue(columnName) {
    if (!columnName || !sampleRecord) return null
    const field = fieldByName.get(columnName)
    return resolveFieldValue(field, sampleRecord.fields?.[columnName])
  }

  const previewImage = fieldValue(columnMapping.image)
  const previewTitle = fieldValue(columnMapping.title) || 'Untitled recipe'
  const previewUrl = fieldValue(columnMapping.url)
  const previewDomain = previewUrl ? getSourceDomain(previewUrl) : null

  return (
    <div className="space-y-5">
      {/* Live preview card */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Preview</p>
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="aspect-[16/10] bg-secondary flex items-center justify-center">
            {previewImage ? (
              <img src={previewImage} alt={previewTitle} className="w-full h-full object-cover" />
            ) : (
              <ImageOff className="w-6 h-6 text-muted-foreground/50" />
            )}
          </div>
          <div className="p-3">
            <p className="text-sm font-semibold leading-snug line-clamp-2">{previewTitle}</p>
            {previewDomain && <p className="text-xs text-muted-foreground mt-1">{previewDomain}</p>}
          </div>
        </div>
      </div>

      {/* Column mapping — auto-detected, user-correctable */}
      <div className="rounded-2xl border bg-card p-4 space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Auto-detected from your table — double check these before saving.
        </p>
        {MAPPING_FIELDS.map(({ key, label, required }) => (
          <div key={key} className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor={`mapping-${key}`}>
              {label}
              {!columnMapping[key] && (
                <span className={cn('ml-2 text-xs font-normal', required ? 'text-destructive' : 'text-muted-foreground')}>
                  {required ? 'not detected — required' : 'not detected — optional'}
                </span>
              )}
            </label>
            <select
              id={`mapping-${key}`}
              value={columnMapping[key] ?? ''}
              onChange={(e) => onChangeMapping({ ...columnMapping, [key]: e.target.value || null })}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">{required ? 'Select a column…' : 'None'}</option>
              {fields.map((f) => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={onConfirm} disabled={!columnMapping.url || saving} className="flex-1">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save connection'}
        </Button>
      </div>
    </div>
  )
}
