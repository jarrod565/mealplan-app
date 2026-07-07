// ── CB_12 column mapping auto-detection ───────────────────────────────────────
// Scores each Airtable field against the three roles Dinder needs (image,
// title, destination URL) using the exact heuristics from the brief: image
// columns look like image URLs or CDN links, title columns are short
// non-URL text, URL columns parse as URLs and aren't images. Airtable's
// native Attachment field type is also treated as a strong image signal,
// since that's the more common way real Airtable bases store photos versus
// a plain URL text column.

const IMAGE_EXTENSION_RE = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|$)/i
const IMAGE_HOST_RE = /(imgur\.com|cloudinary\.com|unsplash\.com|airtableusercontent\.com|images?\.|img\.|cdn\.)/i
const MAX_TITLE_LENGTH = 80
const MAX_TITLE_WORDS = 12

function isUrlString(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function isImageUrlString(value) {
  return isUrlString(value) && (IMAGE_EXTENSION_RE.test(value) || IMAGE_HOST_RE.test(value))
}

function isTitleLikeString(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_TITLE_LENGTH) return false
  if (isUrlString(trimmed)) return false
  const words = trimmed.split(/\s+/)
  return words.length > 0 && words.length <= MAX_TITLE_WORDS
}

// First attachment's URL for Airtable's native Attachment field type,
// otherwise the raw value if it's already a plain string. `field` is
// optional — at column-mapping time we have the real schema (field.type),
// but at card-build time a persisted connection only has column_mapping
// (names), so the attachment shape is duck-typed from the raw value itself
// when no field/type is available.
export function resolveFieldValue(field, rawValue) {
  if (field?.type === 'multipleAttachments' && Array.isArray(rawValue)) {
    return rawValue[0]?.url ?? null
  }
  if (!field && Array.isArray(rawValue) && typeof rawValue[0]?.url === 'string') {
    return rawValue[0].url
  }
  return typeof rawValue === 'string' ? rawValue : null
}

// fields: Airtable table schema fields [{ id, name, type }]
// sampleRecord: one Airtable record ({ fields: { [fieldName]: value } }), or null
// primaryFieldId: table.primaryFieldId, used as a tiebreaker for title detection
export function detectColumnMapping(fields, sampleRecord, primaryFieldId) {
  const resolved = fields.map((field) => ({
    field,
    value: resolveFieldValue(field, sampleRecord?.fields?.[field.name]),
  }))

  let image = null
  for (const { field, value } of resolved) {
    if (field.type === 'multipleAttachments' && value) { image = field.name; break }
  }
  if (!image) {
    const candidate = resolved.find(({ value }) => isImageUrlString(value))
    image = candidate?.field.name ?? null
  }

  let url = null
  const urlCandidates = resolved.filter(
    ({ field, value }) => field.name !== image && isUrlString(value) && !isImageUrlString(value)
  )
  // Prefer Airtable's own "url" field type when there's ambiguity
  url = (urlCandidates.find(({ field }) => field.type === 'url') ?? urlCandidates[0])?.field.name ?? null

  const primaryField = fields.find((f) => f.id === primaryFieldId)
  let title = null
  if (primaryField && primaryField.name !== image && primaryField.name !== url) {
    const primaryValue = resolved.find(({ field }) => field.id === primaryFieldId)?.value
    if (isTitleLikeString(primaryValue)) title = primaryField.name
  }
  if (!title) {
    const candidate = resolved.find(
      ({ field, value }) => field.name !== image && field.name !== url && isTitleLikeString(value)
    )
    title = candidate?.field.name ?? null
  }

  return { image, title, url }
}
