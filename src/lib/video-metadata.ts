export type VideoMeta = {
  title: string
  description: string
  tags: string[]
  account: string
  thumbnail_url: string
}

export async function fetchVideoMetadata(url: string): Promise<VideoMeta | null> {
  // Use server API which extracts full data from YouTube/Instagram embedded JSON
  try {
    const res = await fetch(`/api/og-metadata?url=${encodeURIComponent(url)}`)
    if (res.ok) {
      const data = await res.json()
      if (data.title) {
        return {
          title: data.title,
          description: data.description || '',
          tags: Array.isArray(data.tags) ? data.tags : [],
          account: data.account || '',
          thumbnail_url: data.image || '',
        }
      }
    }
  } catch {}

  // Fallback: noembed.com (limited data - no full description/tags)
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`)
    if (res.ok) {
      const data = await res.json()
      if (data.title) {
        return {
          title: data.title,
          description: '',
          tags: [],
          account: data.author_name || '',
          thumbnail_url: data.thumbnail_url || '',
        }
      }
    }
  } catch {}

  return null
}
