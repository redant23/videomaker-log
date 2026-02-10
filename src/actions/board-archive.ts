'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function archiveCompletedTasks() {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tasks')
    .update({ archived_at: new Date().toISOString() })
    .eq('status', 'done')
    .is('archived_at', null)

  if (error) {
    // archived_at 컬럼이 아직 없으면 무시
    console.warn('archiveCompletedTasks failed (migration needed?):', error.message)
    return
  }
  revalidatePath('/board')
}

export async function getArchivedTasks() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*, profiles:created_by(id, display_name, user_color)')
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })

  if (error) {
    // archived_at 또는 user_color 컬럼이 아직 없으면 빈 배열 반환
    return []
  }
  return data
}

export async function restoreTask(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tasks')
    .update({ archived_at: null, status: 'done' })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/board')
}
