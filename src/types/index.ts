export type Profile = {
  id: string
  display_name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Meeting = {
  id: string
  title: string
  meeting_date: string
  progress_review: string
  deliverable_review: string
  retrospective: string
  next_week_plan: string
  created_by: string
  created_at: string
  updated_at: string
  profiles?: Profile
}

export type Resource = {
  id: string
  content: string
  url: string | null
  author_id: string
  created_at: string
  profiles?: Profile
}

export type Task = {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  assignee_id: string | null
  position: number
  created_by: string
  created_at: string
  updated_at: string
  profiles?: Profile
}

export type PortfolioItem = {
  id: string
  title: string
  description: string | null
  video_url: string
  video_type: 'youtube' | 'instagram' | 'other'
  video_id: string
  thumbnail_url: string | null
  tags: string[]
  account: string | null
  is_public: boolean
  created_by: string
  created_at: string
  updated_at: string
  profiles?: Profile
}

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '할 일',
  in_progress: '진행 중',
  done: '완료',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
}
