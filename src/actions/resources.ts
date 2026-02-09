'use server'

import { createClient } from '@/lib/supabase/server'

export async function getMessages() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('resources')
    .select('*, profiles(display_name, avatar_url)')
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) throw error
  return data
}

export async function createMessage(formData: { content: string; url?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('resources').insert({
    content: formData.content,
    url: formData.url || null,
    author_id: user.id,
  })

  if (error) throw error
}

export async function deleteMessage(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('resources').delete().eq('id', id)

  if (error) throw error
}
