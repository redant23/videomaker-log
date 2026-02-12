'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function extractVideoInfo(url: string): { video_type: string; video_id: string } {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  if (ytMatch) return { video_type: 'youtube', video_id: ytMatch[1] }

  const igMatch = url.match(
    /instagram\.com\/(?:p|reels?|tv)\/([a-zA-Z0-9_-]+)/
  )
  if (igMatch) return { video_type: 'instagram', video_id: igMatch[1] }

  return { video_type: 'other', video_id: '' }
}

export async function getPortfolioItems(filters?: { tags?: string[]; created_by?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from('portfolio_items')
    .select('*, profiles:created_by(id, display_name, user_color)')
    .order('created_at', { ascending: false })

  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags)
  }

  if (filters?.created_by) {
    query = query.eq('created_by', filters.created_by)
  }

  const { data, error } = await query
  if (error) {
    // user_color 컬럼이 아직 없을 경우 fallback
    let fbQuery = supabase
      .from('portfolio_items')
      .select('*, profiles:created_by(id, display_name)')
      .order('created_at', { ascending: false })
    if (filters?.tags && filters.tags.length > 0) fbQuery = fbQuery.overlaps('tags', filters.tags)
    if (filters?.created_by) fbQuery = fbQuery.eq('created_by', filters.created_by)
    const { data: fb, error: fbErr } = await fbQuery
    if (fbErr) throw fbErr
    return fb
  }
  return data
}

export async function getPublicPortfolioItems(filters?: { tags?: string[] }) {
  const supabase = await createClient()
  let query = supabase
    .from('portfolio_items')
    .select('*, profiles:created_by(display_name)')
    .order('created_at', { ascending: false })

  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createPortfolioItem(formData: {
  title: string
  description?: string
  video_url: string
  tags: string[]
  account?: string
  created_by?: string
  thumbnail_url?: string
  upload_date?: string
  view_count?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { video_type, video_id } = extractVideoInfo(formData.video_url)

  const thumbnail_url = formData.thumbnail_url
    || (video_type === 'youtube' ? `https://img.youtube.com/vi/${video_id}/hqdefault.jpg` : null)

  const { error } = await supabase.from('portfolio_items').insert({
    title: formData.title,
    description: formData.description || null,
    video_url: formData.video_url,
    video_type,
    video_id,
    thumbnail_url,
    tags: formData.tags,
    account: formData.account || null,
    upload_date: formData.upload_date || null,
    view_count: formData.view_count ?? null,
    created_by: formData.created_by || user.id,
  })

  if (error) throw error
  revalidatePath('/portfolio')
}

export async function updatePortfolioItem(id: string, formData: {
  title: string
  description?: string
  video_url: string
  tags: string[]
  account?: string
  thumbnail_url?: string
  created_by?: string
  upload_date?: string
  view_count?: number
}) {
  const supabase = await createClient()
  const { video_type, video_id } = extractVideoInfo(formData.video_url)

  const thumbnail_url = formData.thumbnail_url
    || (video_type === 'youtube' ? `https://img.youtube.com/vi/${video_id}/hqdefault.jpg` : null)

  const updateData: Record<string, unknown> = {
    title: formData.title,
    description: formData.description || null,
    video_url: formData.video_url,
    video_type,
    video_id,
    thumbnail_url,
    tags: formData.tags,
    account: formData.account || null,
  }
  if (formData.created_by) {
    updateData.created_by = formData.created_by
  }
  if (formData.upload_date !== undefined) {
    updateData.upload_date = formData.upload_date || null
  }
  if (formData.view_count !== undefined) {
    updateData.view_count = formData.view_count ?? null
  }

  const { error } = await supabase
    .from('portfolio_items')
    .update(updateData)
    .eq('id', id)

  if (error) throw error
  revalidatePath('/portfolio')
}

export async function refreshPortfolioMetadata(id: string, metadata: {
  upload_date?: string
  view_count?: number
  thumbnail_url?: string
}) {
  const supabase = await createClient()
  const updateData: Record<string, unknown> = {}
  if (metadata.upload_date !== undefined) updateData.upload_date = metadata.upload_date || null
  if (metadata.view_count !== undefined) updateData.view_count = metadata.view_count ?? null
  if (metadata.thumbnail_url) updateData.thumbnail_url = metadata.thumbnail_url

  const { error } = await supabase
    .from('portfolio_items')
    .update(updateData)
    .eq('id', id)

  if (error) throw error
  revalidatePath('/portfolio')
}

export async function deletePortfolioItem(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('portfolio_items').delete().eq('id', id)

  if (error) throw error
  revalidatePath('/portfolio')
}

export async function getDistinctAccounts(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('portfolio_items')
    .select('account')
    .not('account', 'is', null)
    .order('account')

  if (error) throw error
  const accounts = new Set(data?.map((d) => d.account).filter(Boolean) as string[])
  return Array.from(accounts)
}
