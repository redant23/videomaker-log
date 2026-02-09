'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getMeetings() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meetings')
    .select('*, profiles(display_name)')
    .order('meeting_date', { ascending: false })

  if (error) throw error
  return data
}

export async function getMeeting(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meetings')
    .select('*, profiles(display_name)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createMeeting(formData: {
  title: string
  meeting_date: string
  progress_review: string
  deliverable_review: string
  retrospective: string
  next_week_plan: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('meetings').insert({
    ...formData,
    created_by: user.id,
  })

  if (error) throw error
  revalidatePath('/meetings')
}

export async function updateMeeting(id: string, formData: {
  title: string
  meeting_date: string
  progress_review: string
  deliverable_review: string
  retrospective: string
  next_week_plan: string
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('meetings')
    .update(formData)
    .eq('id', id)

  if (error) throw error
  revalidatePath('/meetings')
  revalidatePath(`/meetings/${id}`)
}

export async function deleteMeeting(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('meetings').delete().eq('id', id)

  if (error) throw error
  revalidatePath('/meetings')
}
