'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: {
  display_name: string
  user_color: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: formData.display_name,
      user_color: formData.user_color,
    })
    .eq('id', user.id)

  if (error) {
    // user_color 컬럼이 아직 없을 경우 display_name만 업데이트
    const { error: fbErr } = await supabase
      .from('profiles')
      .update({ display_name: formData.display_name })
      .eq('id', user.id)
    if (fbErr) throw fbErr
  }
  revalidatePath('/profile')
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
