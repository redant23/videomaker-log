import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VideomakerLog/1.0)',
      },
    })
    clearTimeout(timeout)

    const html = await response.text()
    const $ = cheerio.load(html)

    const metadata = {
      title: $('meta[property="og:title"]').attr('content') || $('title').text() || '',
      description: $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '',
      image: $('meta[property="og:image"]').attr('content') || '',
      siteName: $('meta[property="og:site_name"]').attr('content') || '',
      url: $('meta[property="og:url"]').attr('content') || url,
    }

    return NextResponse.json(metadata)
  } catch (error) {
    return NextResponse.json({ title: '', description: '', image: '', siteName: '', url }, { status: 200 })
  }
}
