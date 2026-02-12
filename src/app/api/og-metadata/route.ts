import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

type VideoMetadata = {
  title: string
  description: string
  image: string
  siteName: string
  url: string
  tags: string[]
  account: string
}

function extractYouTubeData(html: string): VideoMetadata | null {
  try {
    // ytInitialPlayerResponse contains full video description, tags, channel
    const playerMatch = html.match(/var\s+ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/)
      || html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/)
    if (playerMatch) {
      const data = JSON.parse(playerMatch[1])
      const videoDetails = data?.videoDetails
      if (videoDetails) {
        return {
          title: videoDetails.title || '',
          description: videoDetails.shortDescription || '',
          image: videoDetails.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || '',
          siteName: 'YouTube',
          url: `https://www.youtube.com/watch?v=${videoDetails.videoId}`,
          tags: videoDetails.keywords || [],
          account: videoDetails.author || '',
        }
      }
    }

    // Fallback: try ytInitialData
    const dataMatch = html.match(/var\s+ytInitialData\s*=\s*(\{.+?\})\s*;/)
      || html.match(/ytInitialData\s*=\s*(\{.+?\})\s*;/)
    if (dataMatch) {
      const data = JSON.parse(dataMatch[1])
      const contents = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents
      if (contents) {
        const primary = contents.find((c: Record<string, unknown>) => c.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer
        const secondary = contents.find((c: Record<string, unknown>) => c.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer

        const title = primary?.title?.runs?.map((r: { text: string }) => r.text).join('') || ''
        const description = secondary?.attributedDescription?.content || ''
        const channel = secondary?.owner?.videoOwnerRenderer?.title?.runs?.[0]?.text || ''

        // Extract tags from metadata row
        const superTitle = primary?.superTitleLink?.runs
        const tags: string[] = []
        if (superTitle) {
          for (const run of superTitle) {
            const text = run.text?.trim()
            if (text && text !== '#') tags.push(text.replace(/^#/, ''))
          }
        }

        return {
          title,
          description,
          image: '',
          siteName: 'YouTube',
          url: '',
          tags,
          account: channel,
        }
      }
    }
  } catch {
    // JSON parse failed, fall through
  }
  return null
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\uAC00-\uD7A3]+/g)
  if (!matches) return []
  return [...new Set(matches.map((t) => t.replace(/^#/, '')))]
}

function stripHashtags(text: string): string {
  return text.replace(/#[\w\uAC00-\uD7A3]+/g, '').replace(/\s{2,}/g, ' ').trim()
}

async function fetchInstagramData(url: string): Promise<VideoMetadata | null> {
  try {
    // Instagram public oEmbed API - returns full caption and author
    const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(oembedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) return null

    const data = await res.json()
    const caption: string = data.title || ''
    const tags = extractHashtags(caption)
    const description = stripHashtags(caption)

    return {
      title: data.title || '',
      description,
      image: data.thumbnail_url || '',
      siteName: 'Instagram',
      url,
      tags,
      account: data.author_name || '',
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  const isYouTube = /(?:youtube\.com|youtu\.be)/.test(url)
  const isInstagram = /instagram\.com/.test(url)

  try {
    // Instagram: use oEmbed API for full caption, account, hashtags
    if (isInstagram) {
      const igData = await fetchInstagramData(url)
      if (igData && (igData.title || igData.account)) {
        return NextResponse.json(igData)
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })
    clearTimeout(timeout)

    const html = await response.text()

    // YouTube: extract from embedded JSON for full data
    if (isYouTube) {
      const ytData = extractYouTubeData(html)
      if (ytData && ytData.title) {
        return NextResponse.json(ytData)
      }
    }

    // Fallback: OG metadata for all URLs
    const $ = cheerio.load(html)

    // Try to extract tags from meta keywords
    const keywordsRaw = $('meta[name="keywords"]').attr('content') || ''
    const tags = keywordsRaw
      ? keywordsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : []

    const ogDescription = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || ''

    // Extract hashtags from description as additional tags
    const descHashtags = extractHashtags(ogDescription)
    const allTags = [...new Set([...tags, ...descHashtags])]

    const metadata: VideoMetadata = {
      title: $('meta[property="og:title"]').attr('content') || $('title').text() || '',
      description: ogDescription,
      image: $('meta[property="og:image"]').attr('content') || '',
      siteName: $('meta[property="og:site_name"]').attr('content') || '',
      url: $('meta[property="og:url"]').attr('content') || url,
      tags: allTags,
      account: '',
    }

    return NextResponse.json(metadata)
  } catch {
    return NextResponse.json({ title: '', description: '', image: '', siteName: '', url, tags: [], account: '' }, { status: 200 })
  }
}
