import { URL } from 'node:url'

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function extractMetaContent(html, propertyNames) {
  const normalized = html.replace(/\r/g, '')
  const patterns = propertyNames.map((name) => new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'))

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match?.[1]) return decodeHtmlEntities(match[1]).trim()
  }

  return null
}

function extractTitle(html) {
  const ogTitle = extractMetaContent(html, ['og:title', 'twitter:title'])
  if (ogTitle) return ogTitle

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return titleMatch?.[1]?.trim() || null
}

function extractImage(html) {
  return extractMetaContent(html, ['og:image', 'twitter:image'])
}

function looksLikeRecipe(html) {
  return /"@type"\s*:\s*"(Recipe|HowTo)"/i.test(html)
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (compatible; DinderBot/1.0)',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`)
  }

  return response.text()
}

export default async function handler(request, response) {
  const { url } = request.query ?? {}

  if (!url) {
    return response.status(400).json({ error: 'Missing url query parameter' })
  }

  try {
    const normalizedUrl = new URL(url)
    const html = await fetchPage(normalizedUrl.toString())

    return response.status(200).json({
      title: extractTitle(html),
      image_url: extractImage(html),
      source_domain: normalizedUrl.hostname.replace(/^www\./, ''),
      looksLikeRecipe: looksLikeRecipe(html),
    })
  } catch (error) {
    return response.status(502).json({
      error: 'Could not fetch recipe metadata',
      details: error.message,
    })
  }
}
