import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useConnectedSources } from '@/contexts/ConnectedSourcesContext'
import { startAirtableOAuth, listAirtableBases, listAirtableTables, listAirtableRecords } from '@/lib/airtable'
import { detectColumnMapping, resolveFieldValue } from '@/lib/airtableMapping'
import { startPinterestOAuth, listPinterestBoards } from '@/lib/pinterest'
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
  ArrowLeft, ChevronRight, Database, Loader2, Pin,
  Plug, Trash2, AlertTriangle, CheckCircle2, ImageOff, RefreshCw,
} from 'lucide-react'
import UserAvatar from '@/components/layout/UserAvatar'

const AIRTABLE_PENDING_KEY = 'airtable_pending_connection'
const PINTEREST_PENDING_KEY = 'pinterest_pending_connection'

function connectionLabel(connection) {
  return connection.source_type === 'pinterest'
    ? 'Pinterest'
    : `${connection.base_name} / ${connection.table_name}`
}

export default function ConnectionsPage() {
  const {
    connections, isLoading, disconnectSource, saveConnection, savePinterestConnection, markReconnectRequired,
  } = useConnectedSources()
  const [searchParams, setSearchParams] = useSearchParams()
  const consumedEditParamRef = useRef(false)

  // Wizard state — 'list' is the default Settings → Connections view. The
  // rest are steps in the "Add Connection" flow: 'chooseSource' picks
  // Airtable vs Pinterest, then each source has its own steps (CB_12 setup
  // flow for Airtable; board selection only for CB_09 Pinterest).
  const [step, setStep] = useState('list')

  // Airtable wizard state
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
  // true when the mapping step was pre-populated from a stored connection
  // (Remap) instead of a fresh Airtable fetch — Save is then the one point
  // that talks to Airtable, to validate before persisting.
  const [usingCachedSchema, setUsingCachedSchema] = useState(false)
  const [saving, setSaving] = useState(false)

  // Pinterest wizard state — no base/table/column-mapping steps, board
  // selection replaces them (CB_09).
  const [pinterestPendingTokens, setPinterestPendingTokens] = useState(null)
  const [pinterestConnectionId, setPinterestConnectionId] = useState(null) // set = editing boards on an existing connection
  const [pinterestBoards, setPinterestBoards] = useState([])
  const [pinterestBoardsLoading, setPinterestBoardsLoading] = useState(false)
  const [pinterestBoardsError, setPinterestBoardsError] = useState(null)
  const [selectedBoardIds, setSelectedBoardIds] = useState(new Set())
  const [boardsSaving, setBoardsSaving] = useState(false)

  const [disconnectTarget, setDisconnectTarget] = useState(null)

  const remapConnection = remapConnectionId ? connections.find((c) => c.id === remapConnectionId) : null
  const pinterestConnection = connections.find((c) => c.source_type === 'pinterest') ?? null
  const editingPinterestConnection = pinterestConnectionId
    ? connections.find((c) => c.id === pinterestConnectionId)
    : null

  // Pick up the OAuth handoff left by AirtableCallbackPage / PinterestCallbackPage
  // and continue straight into the next wizard step.
  useEffect(() => {
    const airtableStored = sessionStorage.getItem(AIRTABLE_PENDING_KEY)
    if (airtableStored) {
      sessionStorage.removeItem(AIRTABLE_PENDING_KEY)
      try {
        const tokens = JSON.parse(airtableStored)
        setPendingTokens(tokens)
        goToSelectBase(tokens.access_token)
      } catch {
        toast.error('Could not continue the Airtable connection. Please try again.')
      }
      return
    }

    const pinterestStored = sessionStorage.getItem(PINTEREST_PENDING_KEY)
    if (pinterestStored) {
      sessionStorage.removeItem(PINTEREST_PENDING_KEY)
      try {
        const tokens = JSON.parse(pinterestStored)
        setPinterestPendingTokens(tokens)
        goToSelectBoards(tokens.access_token, [])
      } catch {
        toast.error('Could not continue the Pinterest connection. Please try again.')
      }
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
    setUsingCachedSchema(false)
    setPinterestPendingTokens(null)
    setPinterestConnectionId(null)
    setPinterestBoards([])
    setPinterestBoardsError(null)
    setSelectedBoardIds(new Set())
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

  async function handleAddAirtable() {
    try {
      await startAirtableOAuth()
    } catch {
      toast.error('Airtable connection is not configured yet.')
    }
  }

  // Fresh OAuth round-trip for a connection stuck in "Reconnect needed".
  // AirtableCallbackPage reads the connection id back out after the redirect
  // and updates just the tokens — base/table/column_mapping are untouched,
  // so the user never re-does base/table selection.
  async function handleReconnectAirtable(connection) {
    try {
      await startAirtableOAuth({ reconnectConnectionId: connection.id })
    } catch {
      toast.error('Airtable connection is not configured yet.')
    }
  }

  // Remap pre-populates the mapping step straight from the stored connection
  // — no Airtable API call here. If nothing's ever been cached (a connection
  // saved before cached_fields existed), the dropdowns just fall back to
  // showing the currently-mapped column names with no other options, until
  // Save re-fetches and refreshes the cache.
  function handleRemapAirtable(connection) {
    setRemapConnectionId(connection.id)
    setPendingTokens({ access_token: connection.access_token, refresh_token: connection.refresh_token })
    setSelectedBase({ id: connection.base_id, name: connection.base_name })
    setSelectedTable({ id: connection.table_id, name: connection.table_name, fields: connection.cached_fields ?? [] })
    setColumnMapping(connection.column_mapping ?? { image: null, title: null, url: null })
    setSampleRecord(null)
    setUsingCachedSchema(true)
    setStep('mapping')
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
    setUsingCachedSchema(false)
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
      let tableForSave = selectedTable
      let fieldsForSave = selectedTable?.fields ?? []

      // Remap skipped every Airtable call to get here — Save is where this
      // flow finally talks to Airtable, both to confirm the token/table are
      // still good and to refresh the cached field list for next time.
      if (usingCachedSchema) {
        try {
          const freshTables = await listAirtableTables(pendingTokens.access_token, selectedBase.id)
          const freshTable = freshTables.find((t) => t.id === selectedTable.id)
          if (!freshTable) throw new Error('Table no longer exists')
          tableForSave = freshTable
          fieldsForSave = freshTable.fields ?? []
        } catch (err) {
          if (remapConnectionId && (err?.status === 401 || err?.status === 403)) {
            await markReconnectRequired(remapConnectionId)
            toast.error('Your Airtable connection has expired. Please reconnect before saving changes.')
          } else {
            toast.error('Could not verify this connection with Airtable. Please try again.')
          }
          return
        }
      }

      await saveConnection({
        connectionId: remapConnectionId,
        tokens: pendingTokens,
        base: selectedBase,
        table: tableForSave,
        columnMapping,
        cachedFields: fieldsForSave,
      })
      toast.success('Connection saved.')
      resetWizard()
    } catch {
      toast.error('Could not save this connection. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddPinterest() {
    try {
      await startPinterestOAuth()
    } catch {
      toast.error('Pinterest connection is not configured yet.')
    }
  }

  // Fresh OAuth round-trip for a Pinterest connection stuck in "Reconnect
  // needed". PinterestCallbackPage updates just the tokens — selected board
  // ids are untouched, so the user never re-does board selection.
  async function handleReconnectPinterest(connection) {
    try {
      await startPinterestOAuth({ reconnectConnectionId: connection.id })
    } catch {
      toast.error('Pinterest connection is not configured yet.')
    }
  }

  async function goToSelectBoards(accessToken, preselected = []) {
    setStep('selectBoards')
    setSelectedBoardIds(new Set(preselected))
    setPinterestBoardsLoading(true)
    setPinterestBoardsError(null)
    try {
      const data = await listPinterestBoards(accessToken)
      setPinterestBoards(data)
    } catch (err) {
      setPinterestBoardsError(err)
    } finally {
      setPinterestBoardsLoading(false)
    }
  }

  // CB_09: "Board selection must be editable at any time from Settings →
  // Integrations → Pinterest." Re-fetches the live board list with the
  // connection's already-stored access token — board names are never cached
  // (even locally), only ever fetched fresh per the Pinterest policy.
  function handleManageBoards(connection) {
    setPinterestConnectionId(connection.id)
    setPinterestPendingTokens(null)
    goToSelectBoards(connection.access_token, connection.config?.selected_board_ids ?? [])
  }

  // Settings page's Connections table deep-links its edit icon here as
  // /settings/connections?connectionId=<id> — jump straight into that
  // connection's edit step instead of landing on the plain list. Waits for
  // `connections` to finish loading (async on mount) before looking the id
  // up, and only ever consumes the param once so resetting the wizard back
  // to 'list' doesn't re-trigger it.
  useEffect(() => {
    if (consumedEditParamRef.current) return
    const editId = searchParams.get('connectionId')
    if (!editId || isLoading) return

    consumedEditParamRef.current = true
    const target = connections.find((c) => c.id === editId)
    if (target) {
      if (target.source_type === 'pinterest') {
        handleManageBoards(target)
      } else {
        handleRemapAirtable(target)
      }
    }
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, isLoading, searchParams])

  function handleToggleBoard(boardId) {
    setSelectedBoardIds((prev) => {
      const next = new Set(prev)
      if (next.has(boardId)) next.delete(boardId)
      else next.add(boardId)
      return next
    })
  }

  async function handleConfirmBoards() {
    setBoardsSaving(true)
    try {
      await savePinterestConnection({
        connectionId: pinterestConnectionId,
        tokens: pinterestPendingTokens,
        selectedBoardIds: Array.from(selectedBoardIds),
      })
      toast.success('Boards saved.')
      resetWizard()
    } catch {
      toast.error('Could not save your board selection. Please try again.')
    } finally {
      setBoardsSaving(false)
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

  const stepTitle = step === 'list' ? 'Connections' : step === 'selectBoards' ? 'Pinterest Boards' : 'Add Connection'

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
          <h1 className="text-xl font-bold tracking-tight">{stepTitle}</h1>
        </div>
        <UserAvatar />
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {step === 'list' && (
          <ConnectionsList
            connections={connections}
            isLoading={isLoading}
            onChooseSource={() => setStep('chooseSource')}
            onReconnectAirtable={handleReconnectAirtable}
            onRemapAirtable={handleRemapAirtable}
            onReconnectPinterest={handleReconnectPinterest}
            onManageBoards={handleManageBoards}
            onDisconnect={setDisconnectTarget}
          />
        )}

        {step === 'chooseSource' && (
          <SourceChooser
            hasPinterestConnection={Boolean(pinterestConnection)}
            onChooseAirtable={handleAddAirtable}
            onChoosePinterest={handleAddPinterest}
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
            usingCachedSchema={usingCachedSchema}
            needsReconnect={remapConnection?.status === 'reconnect_required'}
            onReconnect={() => remapConnection && handleReconnectAirtable(remapConnection)}
          />
        )}

        {step === 'selectBoards' && (
          <BoardSelectionStep
            boards={pinterestBoards}
            loading={pinterestBoardsLoading}
            error={pinterestBoardsError}
            selectedBoardIds={selectedBoardIds}
            onToggleBoard={handleToggleBoard}
            saving={boardsSaving}
            onConfirm={handleConfirmBoards}
            onCancel={resetWizard}
            needsReconnect={editingPinterestConnection?.status === 'reconnect_required'}
            onReconnect={() => editingPinterestConnection && handleReconnectPinterest(editingPinterestConnection)}
          />
        )}
      </div>

      <AlertDialog open={!!disconnectTarget} onOpenChange={(open) => !open && setDisconnectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect this source?</AlertDialogTitle>
            <AlertDialogDescription>
              {disconnectTarget && connectionLabel(disconnectTarget)} will no longer appear in For You. Cards
              already in your basket are unaffected.
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

function ConnectionsList({
  connections, isLoading, onChooseSource, onReconnectAirtable, onRemapAirtable,
  onReconnectPinterest, onManageBoards, onDisconnect,
}) {
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
              Connect Airtable or Pinterest to bring your own recipes into For You.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((c) => {
            const isPinterest = c.source_type === 'pinterest'
            const boardCount = isPinterest ? (c.config?.selected_board_ids?.length ?? 0) : null
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  {isPinterest ? (
                    <Pin className="w-4 h-4 text-primary/60" />
                  ) : (
                    <Database className="w-4 h-4 text-primary/60" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug truncate">
                    {connectionLabel(c)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {c.status === 'connected' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {c.status === 'connected' ? 'Connected' : 'Reconnect needed'}
                      {isPinterest && c.status === 'connected' && (
                        <> · {boardCount} board{boardCount !== 1 ? 's' : ''}</>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {c.status === 'reconnect_required' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => (isPinterest ? onReconnectPinterest(c) : onReconnectAirtable(c))}
                    >
                      Reconnect
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => (isPinterest ? onManageBoards(c) : onRemapAirtable(c))}
                  >
                    {isPinterest ? 'Manage Boards' : 'Remap'}
                  </Button>
                  <button
                    onClick={() => onDisconnect(c)}
                    className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label={`Disconnect ${connectionLabel(c)}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Button onClick={onChooseSource} className="w-full gap-2">
        <Plug className="w-4 h-4" />
        Add Connection
      </Button>

      <Button asChild variant="ghost" className="w-full text-muted-foreground">
        <Link to="/settings">Back to Settings</Link>
      </Button>
    </div>
  )
}

function SourceChooser({ hasPinterestConnection, onChooseAirtable, onChoosePinterest }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">What would you like to connect?</p>
      <button
        onClick={onChooseAirtable}
        className="w-full flex items-center gap-3 rounded-2xl border bg-card p-4 text-left hover:bg-secondary/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
          <Database className="w-4 h-4 text-primary/60" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Airtable</p>
          <p className="text-xs text-muted-foreground mt-0.5">Bring in recipes from an Airtable base</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      <button
        onClick={onChoosePinterest}
        disabled={hasPinterestConnection}
        className="w-full flex items-center gap-3 rounded-2xl border bg-card p-4 text-left hover:bg-secondary/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
          <Pin className="w-4 h-4 text-primary/60" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Pinterest</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasPinterestConnection
              ? 'Already connected — manage boards from Connections'
              : 'Swipe through pins saved to your boards'}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
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

function MappingStep({
  table, sampleRecord, loading, columnMapping, onChangeMapping, saving, onConfirm, onCancel,
  usingCachedSchema = false, needsReconnect = false, onReconnect,
}) {
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

  // Remap has no live field list to offer for connections saved before
  // cached_fields existed — fall back to at least showing whatever columns
  // are already mapped so the select isn't left silently blank.
  const knownNames = new Set(fields.map((f) => f.name))
  const fallbackOptions = Object.values(columnMapping)
    .filter((name) => name && !knownNames.has(name))
    .map((name) => ({ id: name, name }))
  const selectOptions = [...fields, ...fallbackOptions]

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
      {needsReconnect && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">This connection needs to be reconnected</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              The mapping below is from before it lost access. You can still adjust it, but saving
              will need a fresh connection to Airtable.
            </p>
            <Button variant="outline" size="sm" onClick={onReconnect} className="mt-3 gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              Reconnect Airtable
            </Button>
          </div>
        </div>
      )}

      {/* Live preview card — no sample record when remapping from cache, so
          this shows placeholders until Save re-fetches from Airtable. */}
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
          {usingCachedSchema
            ? 'Showing your last saved column mapping. Saving will confirm it’s still valid with Airtable.'
            : 'Auto-detected from your table — double check these before saving.'}
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
              {selectOptions.map((f) => (
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

// CB_09: "multi-select checklist — same pattern as Dietary Preferences." Uses
// checkbox rows (not Dietary Preferences' pill chips) since board lists can
// run long and board names are unbounded length — the same list-row pattern
// ForYouPage's filter drawer already uses for connected sources.
function BoardSelectionStep({
  boards, loading, error, selectedBoardIds, onToggleBoard, saving, onConfirm, onCancel,
  needsReconnect = false, onReconnect,
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading your boards…</span>
      </div>
    )
  }

  if (error) {
    const isAuthError = error?.status === 401 || error?.status === 403
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Couldn't load your Pinterest boards</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {isAuthError
                ? 'Your Pinterest connection needs to be refreshed.'
                : 'Something went wrong talking to Pinterest. Please try again.'}
            </p>
            {isAuthError && needsReconnect && (
              <Button variant="outline" size="sm" onClick={onReconnect} className="mt-3 gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                Reconnect Pinterest
              </Button>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={onCancel} className="w-full">Cancel</Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Select at least one board to pull recipe pins from. Only board selection is saved — board
        names and pin counts are fetched fresh from Pinterest each time.
      </p>

      {boards.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No boards found on your Pinterest account.
        </p>
      ) : (
        <div className="rounded-2xl border bg-card divide-y overflow-hidden">
          {boards.map((board) => (
            <label key={board.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedBoardIds.has(board.id)}
                onChange={() => onToggleBoard(board.id)}
                className="w-4 h-4 rounded border-input accent-primary shrink-0"
              />
              <span className="text-sm flex-1 min-w-0 truncate">{board.name}</span>
              {typeof board.pin_count === 'number' && (
                <span className="text-xs text-muted-foreground shrink-0">{board.pin_count} pins</span>
              )}
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={onConfirm} disabled={selectedBoardIds.size === 0 || saving} className="flex-1">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save boards'}
        </Button>
      </div>
    </div>
  )
}
