import type { Profile } from '@/types'

export function extractMentions(text: string, members: Profile[]): Profile[] {
  const mentioned: Profile[] = []
  const regex = /@(\S+)/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const name = match[1]
    const member = members.find((m) => m.display_name === name)
    if (member && !mentioned.find((m) => m.id === member.id)) {
      mentioned.push(member)
    }
  }
  return mentioned
}

export function highlightMentions(text: string): string {
  return text.replace(/@(\S+)/g, '**@$1**')
}
