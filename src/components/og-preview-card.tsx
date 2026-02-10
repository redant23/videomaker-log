'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'

type OgData = {
  title: string
  description: string
  image: string
  siteName: string
  url: string
}

export function OgPreviewCard({ url }: { url: string }) {
  const [og, setOg] = useState<OgData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchOg() {
      try {
        const res = await fetch(`/api/og-metadata?url=${encodeURIComponent(url)}`)
        const data = await res.json()
        if (data.title || data.description || data.image) {
          setOg(data)
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false)
      }
    }
    fetchOg()
  }, [url])

  if (loading || !og) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50 max-w-md"
    >
      {og.image && (
        <img
          src={og.image}
          alt=""
          className="size-16 shrink-0 rounded-md object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        {og.siteName && (
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {og.siteName}
          </p>
        )}
        <p className="truncate text-sm font-medium">{og.title}</p>
        {og.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground mt-0.5">
            {og.description}
          </p>
        )}
      </div>
      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground mt-1" />
    </a>
  )
}
