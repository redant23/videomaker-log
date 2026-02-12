import { NextRequest, NextResponse } from 'next/server'

function isAllowedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    // Instagram/Facebook CDN domains
    return hostname.endsWith('fbcdn.net')
      || hostname.endsWith('cdninstagram.com')
      || hostname.endsWith('instagram.com')
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url || !isAllowedUrl(url)) {
    return new NextResponse(null, { status: 403 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return new NextResponse(null, { status: 502 })
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
      },
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
