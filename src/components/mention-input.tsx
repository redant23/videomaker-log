'use client'

import { useState, useRef, useEffect } from 'react'
import type { Profile } from '@/types'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface MentionInputProps {
  id?: string
  placeholder?: string
  rows?: number
  value: string
  onChange: (value: string) => void
  members: Profile[]
}

export function MentionInput({ id, placeholder, rows = 3, value, onChange, members }: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredMembers, setFilteredMembers] = useState<Profile[]>([])
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart
    onChange(newValue)

    const textBeforeCursor = newValue.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex >= 0) {
      const textBeforeAt = lastAtIndex > 0 ? newValue[lastAtIndex - 1] : ' '
      if (textBeforeAt === ' ' || textBeforeAt === '\n' || lastAtIndex === 0) {
        const query = textBeforeCursor.slice(lastAtIndex + 1)
        if (!query.includes(' ')) {
          const filtered = members.filter((m) =>
            m.display_name.toLowerCase().includes(query.toLowerCase())
          )
          setFilteredMembers(filtered)
          setShowSuggestions(filtered.length > 0)
          setMentionStart(lastAtIndex)
          setSelectedIndex(0)
          return
        }
      }
    }

    setShowSuggestions(false)
    setMentionStart(null)
  }

  const insertMention = (member: Profile) => {
    if (mentionStart === null) return
    const cursorPos = textareaRef.current?.selectionStart ?? value.length
    const before = value.slice(0, mentionStart)
    const after = value.slice(cursorPos)
    const newValue = `${before}@${member.display_name} ${after}`
    onChange(newValue)
    setShowSuggestions(false)
    setMentionStart(null)

    setTimeout(() => {
      const pos = mentionStart + member.display_name.length + 2
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % filteredMembers.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length)
    } else if (e.key === 'Enter' && filteredMembers[selectedIndex]) {
      e.preventDefault()
      insertMention(filteredMembers[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        id={id}
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      {showSuggestions && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border bg-popover p-1 shadow-md">
          {filteredMembers.map((member, i) => (
            <button
              key={member.id}
              type="button"
              className={cn(
                'w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                i === selectedIndex && 'bg-accent'
              )}
              onClick={() => insertMention(member)}
            >
              @{member.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
