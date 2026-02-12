'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Pencil, Trash2, Kanban, Archive, RotateCcw, ChevronDown, Crown, Square, CheckSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format, getWeek } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

import { createClient } from '@/lib/supabase/client'
import { getTasks, createTask, updateTask, updateTaskStatus, deleteTask, updateTaskChecklist } from '@/actions/board'
import { archiveCompletedTasks, getArchivedTasks, restoreTask } from '@/actions/board-archive'
import { BOARD_COLUMNS } from '@/lib/constants'
import type { Task, TaskStatus, TaskPriority, ChecklistItem } from '@/types'
import { TASK_PRIORITY_LABELS } from '@/types'
import { getUserColor } from '@/lib/colors'

const PRIORITY_VARIANT: Record<TaskPriority, 'secondary' | 'default' | 'destructive'> = {
  low: 'secondary',
  medium: 'default',
  high: 'destructive',
}

const COLUMN_STYLES: Record<TaskStatus, { bg: string; border: string; headerBg: string; dot: string }> = {
  todo: {
    bg: 'bg-blue-50/60 dark:bg-blue-950/20',
    border: 'border-blue-200/60 dark:border-blue-800/40',
    headerBg: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  in_progress: {
    bg: 'bg-amber-50/60 dark:bg-amber-950/20',
    border: 'border-amber-200/60 dark:border-amber-800/40',
    headerBg: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  done: {
    bg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
    border: 'border-emerald-200/60 dark:border-emerald-800/40',
    headerBg: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
}

function TaskCardContent({
  task,
  onEdit,
  onDelete,
  onChecklistToggle,
  showActions = true,
}: {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onChecklistToggle?: (task: Task, index: number) => void
  showActions?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const authorName = task.profiles?.display_name ?? '알 수 없음'
  const authorInitials = authorName.slice(0, 1).toUpperCase()
  const userColor = getUserColor(task.profiles?.id || task.created_by, task.profiles)
  const checklist = task.checklist || []
  const checkedCount = checklist.filter((item) => item.checked).length
  const totalCount = checklist.length

  return (
    <Card
      className="relative gap-1 py-2 shadow-sm !bg-white/40 dark:!bg-black/40 backdrop-blur-md border-white/20 cursor-pointer overflow-hidden transition-all"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: userColor.hex }} />

      <CardHeader className="pl-4 pr-3 py-0 mb-[-4px]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 mt-1.5">
            <Badge variant={PRIORITY_VARIANT[task.priority]} className="h-4.5 px-1.5 text-[10px] shrink-0">
              {TASK_PRIORITY_LABELS[task.priority]}
            </Badge>
            <CardTitle className="text-sm font-medium leading-none truncate">{task.title}</CardTitle>
            {totalCount > 0 && (
              <span className={cn("text-[10px] shrink-0 font-mono", checkedCount === totalCount ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                [{checkedCount}/{totalCount}]
              </span>
            )}
          </div>
          {showActions && (
            <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="size-6" onClick={(e) => { e.stopPropagation(); onEdit(task) }}>
                <Pencil className="size-3" />
              </Button>
              <Button variant="ghost" size="icon" className="size-6 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}>
                <Trash2 className="size-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {(task.description || checklist.length > 0) && (
        <div className="mx-3 border-t border-black/[0.05] dark:border-white/10" />
      )}

      <CardContent className="pl-4 pr-3 py-0">
        {task.description && (
          <p className={`text-muted-foreground mt-1 mb-1.5 text-[11px] leading-relaxed transition-all ${isExpanded ? '' : 'line-clamp-1'}`}>
            {task.description}
          </p>
        )}
        {checklist.length > 0 && (
          <div className={`mt-1 mb-1.5 space-y-0.5 ${isExpanded ? '' : 'max-h-[60px] overflow-hidden'}`}>
            {checklist.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="flex items-center gap-1.5 w-full text-left group/check"
                onClick={(e) => { e.stopPropagation(); onChecklistToggle?.(task, idx) }}
              >
                {item.checked
                  ? <CheckSquare className="size-3 text-emerald-500 shrink-0" />
                  : <Square className="size-3 text-muted-foreground shrink-0 group-hover/check:text-foreground" />
                }
                <span className={cn("text-[11px] leading-relaxed truncate", item.checked && "line-through text-muted-foreground")}>
                  {item.text}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-[10px]">
            {format(new Date(task.created_at), 'M/d')}
          </span>
          <div className="flex items-center gap-1">
            <Avatar size="sm" className="size-4">
              <AvatarFallback
                className={cn("text-[8px] font-bold border !border-white/20 transition-colors", userColor.text)}
                style={{ backgroundColor: userColor.hex }}
              >
                {authorInitials}
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground truncate text-[10px] max-w-[60px] flex items-center gap-0.5">
              {authorName}
              {task.profiles?.role === 'master' && <Crown className="size-2.5 text-yellow-500 shrink-0" />}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DraggableTaskCard({
  task,
  onEdit,
  onDelete,
  onChecklistToggle,
  canModify,
}: {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onChecklistToggle: (task: Task, index: number) => void
  canModify: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="relative cursor-grab active:cursor-grabbing">
      <TaskCardContent task={task} onEdit={onEdit} onDelete={onDelete} onChecklistToggle={onChecklistToggle} showActions={canModify} />
    </div>
  )
}

function DroppableColumn({
  column,
  tasks,
  onEdit,
  onDelete,
  onChecklistToggle,
  canModify,
}: {
  column: (typeof BOARD_COLUMNS)[number]
  tasks: Task[]
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onChecklistToggle: (task: Task, index: number) => void
  canModify: (task: Task) => boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { status: column.id } })
  const colors = COLUMN_STYLES[column.id]

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[200px] flex-col rounded-xl border p-3 transition-colors ${colors.bg} ${colors.border} ${isOver ? 'ring-2 ring-primary/30 border-primary/50' : ''}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${colors.dot}`} />
          <h3 className={`text-sm font-semibold ${colors.headerBg}`}>{column.label}</h3>
          <Badge variant="outline" className="text-muted-foreground text-xs font-normal">{tasks.length}</Badge>
        </div>
      </div>
      <div className="flex-1">
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <DraggableTaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} onChecklistToggle={onChecklistToggle} canModify={canModify(task)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TaskDialog({ open, onOpenChange, task, defaultStatus, onSave }: {
  open: boolean; onOpenChange: (open: boolean) => void; task: Task | null; defaultStatus: TaskStatus; onSave: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [newCheckItem, setNewCheckItem] = useState('')
  const [saving, setSaving] = useState(false)
  const isEditing = !!task

  useEffect(() => {
    if (task) { setTitle(task.title); setDescription(task.description ?? ''); setPriority(task.priority); setChecklist(task.checklist || []) }
    else { setTitle(''); setDescription(''); setPriority('medium'); setChecklist([]) }
    setNewCheckItem('')
  }, [task, open])

  function addCheckItem() {
    if (!newCheckItem.trim()) return
    setChecklist([...checklist, { text: newCheckItem.trim(), checked: false }])
    setNewCheckItem('')
  }

  function removeCheckItem(index: number) {
    setChecklist(checklist.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      if (isEditing) { await updateTask(task.id, { title, description, priority, checklist }); toast.success('작업이 수정되었습니다.') }
      else { await createTask({ title, description, priority, checklist }); toast.success('작업이 생성되었습니다.') }
      onSave(); onOpenChange(false)
    } catch (err) { console.error('작업 저장 실패:', err); toast.error(isEditing ? '작업 수정에 실패했습니다.' : '작업 생성에 실패했습니다.') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEditing ? '작업 수정' : '새 작업'}</DialogTitle><DialogDescription>{isEditing ? '작업 내용을 수정합니다.' : '새로운 작업을 추가합니다.'}</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2"><Label htmlFor="title">제목</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="작업 제목을 입력하세요" required /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="description">설명</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="작업 설명을 입력하세요 (선택)" rows={3} /></div>
          <div className="flex flex-col gap-2">
            <Label>체크리스트</Label>
            {checklist.length > 0 && (
              <div className="space-y-1">
                {checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
                    <button type="button" onClick={() => setChecklist(checklist.map((c, i) => i === idx ? { ...c, checked: !c.checked } : c))}>
                      {item.checked ? <CheckSquare className="size-4 text-emerald-500" /> : <Square className="size-4 text-muted-foreground" />}
                    </button>
                    <span className={cn("flex-1 truncate", item.checked && "line-through text-muted-foreground")}>{item.text}</span>
                    <button type="button" onClick={() => removeCheckItem(idx)} className="text-muted-foreground hover:text-destructive">
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                placeholder="항목 추가..."
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem() } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addCheckItem} disabled={!newCheckItem.trim()}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>우선순위</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{TASK_PRIORITY_LABELS.low}</SelectItem>
                <SelectItem value="medium">{TASK_PRIORITY_LABELS.medium}</SelectItem>
                <SelectItem value="high">{TASK_PRIORITY_LABELS.high}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button type="submit" disabled={saving || !title.trim()}>{saving ? '저장 중...' : isEditing ? '수정' : '생성'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDialog({ open, onOpenChange, taskId, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; taskId: string | null; onConfirm: () => void }) {
  const [deleting, setDeleting] = useState(false)
  async function handleDelete() {
    if (!taskId) return
    setDeleting(true)
    try { await deleteTask(taskId); toast.success('작업이 삭제되었습니다.'); onConfirm(); onOpenChange(false) }
    catch (err) { console.error('작업 삭제 실패:', err); toast.error('작업 삭제에 실패했습니다.') }
    finally { setDeleting(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>작업 삭제</DialogTitle><DialogDescription>이 작업을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? '삭제 중...' : '삭제'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function groupArchivedByWeek(tasks: Task[]) {
  const groups: Record<string, Task[]> = {}
  tasks.forEach((task) => {
    if (!task.archived_at) return
    const date = new Date(task.archived_at)
    const weekNum = getWeek(date, { weekStartsOn: 1 })
    const key = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${weekNum}주차`
    if (!groups[key]) groups[key] = []
    groups[key].push(task)
  })
  return groups
}

export default function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isMaster, setIsMaster] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([])
  const [showArchive, setShowArchive] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        try {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
          if (profile?.role === 'master') setIsMaster(true)
        } catch { }
      }
    }
    loadUser()
  }, [])

  const canModify = (task: Task) => isMaster || task.created_by === currentUserId

  const fetchTasks = useCallback(async () => {
    try { const data = await getTasks(); setTasks(data as Task[]) }
    catch (err) { console.error('작업 목록 로딩 실패:', err); toast.error('작업 목록을 불러오는데 실패했습니다.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const tasksByStatus = BOARD_COLUMNS.reduce((acc, col) => { acc[col.id] = tasks.filter((t) => t.status === col.id); return acc }, {} as Record<TaskStatus, Task[]>)

  const doneTasks = tasksByStatus.done ?? []

  function handleDragStart(event: DragStartEvent) { const task = event.active.data.current?.task as Task | undefined; if (task) setActiveTask(task) }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return
    const task = active.data.current?.task as Task | undefined
    if (!task) return
    const newStatus = over.id as TaskStatus
    if (task.status === newStatus) return
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
    const targetTasks = tasks.filter((t) => t.status === newStatus)
    const maxPosition = targetTasks.length > 0 ? Math.max(...targetTasks.map((t) => t.position)) : -1
    try { await updateTaskStatus(task.id, newStatus, maxPosition + 1); await fetchTasks() }
    catch (err) { console.error('상태 변경 실패:', err); toast.error('상태 변경에 실패했습니다.'); await fetchTasks() }
  }

  async function handleChecklistToggle(task: Task, index: number) {
    const checklist = [...(task.checklist || [])]
    checklist[index] = { ...checklist[index], checked: !checklist[index].checked }
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, checklist } : t))
    try { await updateTaskChecklist(task.id, checklist) }
    catch (err) { console.error('체크리스트 업데이트 실패:', err); await fetchTasks() }
  }

  function handleAdd(status: TaskStatus) { setEditingTask(null); setDefaultStatus(status); setTaskDialogOpen(true) }
  function handleEdit(task: Task) { setEditingTask(task); setTaskDialogOpen(true) }
  function handleDeleteClick(id: string) { setDeletingTaskId(id); setDeleteDialogOpen(true) }

  const handleArchive = async () => {
    if (doneTasks.length === 0) { toast.error('아카이브할 완료 작업이 없습니다.'); return }
    setArchiving(true)
    try { await archiveCompletedTasks(); toast.success(`${doneTasks.length}개 작업이 아카이브되었습니다.`); await fetchTasks() }
    catch (err) { console.error('아카이브 실패:', err); toast.error('아카이브에 실패했습니다.') }
    finally { setArchiving(false) }
  }

  const loadArchive = async () => {
    try { const data = await getArchivedTasks(); setArchivedTasks(data as Task[]) }
    catch (err) { console.error('아카이브 로딩 실패:', err) }
  }

  const handleRestore = async (id: string) => {
    try { await restoreTask(id); toast.success('작업이 복원되었습니다.'); setArchivedTasks((prev) => prev.filter((t) => t.id !== id)); await fetchTasks() }
    catch (err) { console.error('복원 실패:', err); toast.error('복원에 실패했습니다.') }
  }

  const archivedGroups = groupArchivedByWeek(archivedTasks)

  if (loading) {
    return (<div className="flex h-full items-center justify-center"><p className="text-muted-foreground">로딩 중...</p></div>)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Kanban className="text-muted-foreground size-5 md:size-6" />
          <h1 className="text-xl md:text-2xl font-bold">보드</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {doneTasks.length > 0 && (
            <Button variant="outline" onClick={handleArchive} disabled={archiving}>
              <Archive className="size-4" />
              {archiving ? '아카이브 중...' : `완료 아카이브 (${doneTasks.length})`}
            </Button>
          )}
          <Button onClick={() => handleAdd('todo')}>
            <Plus className="mr-1.5 size-4" />
            새 작업
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 items-start md:grid-cols-3">
          {BOARD_COLUMNS.map((column) => (
            <DroppableColumn key={column.id} column={column} tasks={tasksByStatus[column.id] ?? []} onEdit={handleEdit} onDelete={handleDeleteClick} onChecklistToggle={handleChecklistToggle} canModify={canModify} />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="w-72 rotate-2 opacity-90">
              <TaskCardContent task={activeTask} onEdit={() => { }} onDelete={() => { }} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 아카이브 섹션 */}
      <Collapsible open={showArchive} onOpenChange={(open) => { setShowArchive(open); if (open) loadArchive() }}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full text-sm text-muted-foreground">
            <Archive className="size-4 mr-2" />
            <ChevronDown className={`size-3.5 mr-1 transition-transform ${showArchive ? 'rotate-180' : ''}`} />
            아카이브
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          {Object.keys(archivedGroups).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">아카이브된 작업이 없습니다.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(archivedGroups).map(([week, weekTasks]) => (
                <div key={week}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium text-muted-foreground shrink-0">{week}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {weekTasks.map((task) => (
                      <div key={task.id} className="relative opacity-60 hover:opacity-100 transition-opacity">
                        <TaskCardContent task={task} onEdit={() => { }} onDelete={() => { }} showActions={false} />
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute top-1 right-1 h-6 text-[10px]"
                          onClick={() => handleRestore(task.id)}
                        >
                          <RotateCcw className="size-3 mr-1" />
                          복원
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <TaskDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} task={editingTask} defaultStatus={defaultStatus} onSave={fetchTasks} />
      <DeleteDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} taskId={deletingTaskId} onConfirm={fetchTasks} />
    </div>
  )
}
