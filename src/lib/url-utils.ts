const URL_REGEX = /https?:\/\/[^\s<>)"']+/gi
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)(\?.*)?$/i
const IMAGE_HOST_PATTERNS = [
  /^https?:\/\/i\.imgur\.com\//i,
  /^https?:\/\/imgur\.com\/\w+\.(jpg|jpeg|png|gif|webp)/i,
  /^https?:\/\/.*\.googleusercontent\.com\//i,
  /^https?:\/\/pbs\.twimg\.com\//i,
  /^https?:\/\/cdn\.discordapp\.com\/attachments\//i,
  /^https?:\/\/media\.discordapp\.net\/attachments\//i,
  /^https?:\/\/.*\.cloudinary\.com\/.+\/image\//i,
  /^https?:\/\/images\.unsplash\.com\//i,
]

export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) || []
}

export function isImageUrl(url: string): boolean {
  if (IMAGE_EXTENSIONS.test(url)) return true
  return IMAGE_HOST_PATTERNS.some((pattern) => pattern.test(url))
}
