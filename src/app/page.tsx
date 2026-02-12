import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Film, Youtube, Instagram, Globe, Tag, LogIn } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getPublicPortfolioItems } from '@/actions/portfolio'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function getVideoIcon(type: string) {
  switch (type) {
    case 'youtube': return <Youtube className="h-4 w-4 text-red-500" />
    case 'instagram': return <Instagram className="h-4 w-4 text-pink-500" />
    default: return <Globe className="h-4 w-4 text-gray-500" />
  }
}

function isInstagramCdn(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname.endsWith('fbcdn.net') || hostname.endsWith('cdninstagram.com')
  } catch {
    return false
  }
}

function proxyThumbnail(url: string): string {
  if (isInstagramCdn(url)) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`
  }
  return url
}

function getThumbnailUrl(item: { video_type: string; video_id: string; thumbnail_url: string | null }) {
  if (item.thumbnail_url) return proxyThumbnail(item.thumbnail_url)
  if (item.video_type === 'youtube') return `https://img.youtube.com/vi/${item.video_id}/hqdefault.jpg`
  return null
}

export default async function Home({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/meetings')
  }

  const params = await searchParams
  const selectedTag = params.tag || null
  const items = await getPublicPortfolioItems(selectedTag ? { tags: [selectedTag] } : undefined)

  // 모든 태그 수집
  const allTags = Array.from(new Set(items?.flatMap((item: any) => item.tags || []) || []))

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Film className="h-5 w-5 sm:h-6 sm:w-6 text-violet-400" />
            <h1 className="text-base sm:text-xl font-bold">Portfolio Showcase</h1>
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm" className="!bg-transparent border-white/20 text-white hover:bg-white/10">
              <LogIn className="h-4 w-4 mr-2" />
              로그인
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <Link href="/">
              <Badge
                variant={selectedTag ? 'outline' : 'default'}
                className={`cursor-pointer ${!selectedTag ? 'bg-violet-600 hover:bg-violet-700 text-white' : '!bg-transparent border-white/20 text-white/70 hover:bg-white/10'}`}
              >
                전체
              </Badge>
            </Link>
            {allTags.map((tag) => (
              <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`}>
                <Badge
                  variant={selectedTag === tag ? 'default' : 'outline'}
                  className={`cursor-pointer ${selectedTag === tag ? 'bg-violet-600 hover:bg-violet-700 text-white' : '!bg-transparent border-white/20 text-white/70 hover:bg-white/10'}`}
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {/* Portfolio Grid */}
        {items && items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item: any) => {
              const thumbnail = getThumbnailUrl(item)
              return (
                <a
                  key={item.id}
                  href={item.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-violet-500/50 transition-all hover:shadow-lg hover:shadow-violet-500/10"
                >
                  {/* Thumbnail */}
                  <div className={`aspect-video relative overflow-hidden ${item.thumbnail_url && isInstagramCdn(item.thumbnail_url) ? 'bg-black' : 'bg-gray-800'}`}>
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className={`w-full h-full group-hover:scale-105 transition-transform duration-300 ${item.thumbnail_url && isInstagramCdn(item.thumbnail_url) ? 'object-contain' : 'object-cover'}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="h-12 w-12 text-gray-600" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      {getVideoIcon(item.video_type)}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-white/50 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-wrap gap-1">
                        {item.tags?.slice(0, 3).map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs border-white/10 text-white/40">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      {item.profiles?.display_name && (
                        <span className="text-xs text-white/30">{item.profiles.display_name}</span>
                      )}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-white/40">
            <Film className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">아직 등록된 포트폴리오가 없습니다</p>
          </div>
        )}
      </main>
    </div>
  )
}
