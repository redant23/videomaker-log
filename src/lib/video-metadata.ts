export async function fetchVideoMetadata(url: string): Promise<{ title: string; description: string } | null> {
  // noembed.com 우선 시도
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`)
    if (res.ok) {
      const data = await res.json()
      if (data.title) {
        return { title: data.title, description: data.author_name ? `by ${data.author_name}` : '' }
      }
    }
  } catch {}

  // fallback: OG metadata
  try {
    const res = await fetch(`/api/og-metadata?url=${encodeURIComponent(url)}`)
    if (res.ok) {
      const data = await res.json()
      if (data.title) {
        return { title: data.title, description: data.description || '' }
      }
    }
  } catch {}

  return null
}
