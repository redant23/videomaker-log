'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getTasks() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*, profiles:created_by(id, display_name, user_color)')
    .is('archived_at', null)
    .order('position', { ascending: true })

  if (error) {
    // archived_at 또는 user_color 컬럼이 아직 없을 경우 fallback
    const { data: fb, error: fbErr } = await supabase
      .from('tasks')
      .select('*, profiles:created_by(id, display_name)')
      .order('position', { ascending: true })
    if (fbErr) throw fbErr
    return fb
  }
  return data
}

export async function createTask(formData: {
  title: string
  description?: string
  priority?: string
  assignee_id?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Get max position for todo column
  const { data: maxPos } = await supabase
    .from('tasks')
    .select('position')
    .eq('status', 'todo')
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const { error } = await supabase.from('tasks').insert({
    title: formData.title,
    description: formData.description || null,
    priority: formData.priority || 'medium',
    assignee_id: formData.assignee_id || null,
    status: 'todo',
    position: (maxPos?.position ?? -1) + 1,
    created_by: user.id,
  })

  if (error) throw error
  revalidatePath('/board')
}

export async function updateTask(id: string, formData: {
  title?: string
  description?: string
  priority?: string
  assignee_id?: string | null
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tasks')
    .update(formData)
    .eq('id', id)

  if (error) throw error
  revalidatePath('/board')
}

export async function updateTaskStatus(id: string, status: string, position: number) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tasks')
    .update({ status, position })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/board')
}

export async function deleteTask(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').delete().eq('id', id)

  if (error) throw error
  revalidatePath('/board')
}
