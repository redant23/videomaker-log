const URL_REGEX = /https?:\/\/[^\s<>)"']+/gi
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i

export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) || []
}

export function isImageUrl(url: string): boolean {
  return IMAGE_EXTENSIONS.test(url)
}
