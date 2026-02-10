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
import { Plus, GripVertical, Pencil, Trash2, Kanban, User } from 'lucide-react'
import { toast } from 'sonner'

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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

import { getTasks, createTask, updateTask, updateTaskStatus, deleteTask } from '@/actions/board'
import { BOARD_COLUMNS } from '@/lib/constants'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import { TASK_PRIORITY_LABELS } from '@/types'
import { getUserColor } from '@/lib/colors'

// ─── Priority badge variant mapping ───────────────────────────────────────────
const PRIORITY_VARIANT: Record<TaskPriority, 'secondary' | 'default' | 'destructive'> = {
  low: 'secondary',
  medium: 'default',
  high: 'destructive',
}

// ─── Column color styles ──────────────────────────────────────────────────────
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



// ─── Task Card (static, used both inline and in DragOverlay) ──────────────────
function TaskCardContent({
  task,
  onEdit,
  onDelete,
}: {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const authorName = task.profiles?.display_name ?? '알 수 없음'
  const authorInitials = authorName.slice(0, 1).toUpperCase()
  const userColor = getUserColor(task.profiles?.id || task.created_by)

  return (
    <Card
      className="relative gap-1 py-2 shadow-sm !bg-white/40 dark:!bg-black/40 backdrop-blur-md border-white/20 cursor-pointer overflow-hidden transition-all"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* User Indicator Bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${userColor.indicator}`} />

      <CardHeader className="pl-4 pr-3 py-0 mb-[-4px]">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium leading-none mt-1.5">{task.title}</CardTitle>
          <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(task)
              }}
            >
              <Pencil className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(task.id)
              }}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {task.description && (
        <div className="mx-3 border-t border-black/[0.05] dark:border-white/10" />
      )}

      <CardContent className="pl-4 pr-3 py-0">
        {task.description && (
          <p className={`text-muted-foreground mt-1 mb-1.5 text-[11px] leading-relaxed transition-all ${isExpanded ? '' : 'line-clamp-1'}`}>
            {task.description}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <Badge variant={PRIORITY_VARIANT[task.priority]} className="h-4.5 px-1.5 text-[10px]">
            {TASK_PRIORITY_LABELS[task.priority]}
          </Badge>
          <div className="flex items-center gap-1">
            <Avatar size="sm" className="size-4">
              <AvatarFallback className={`text-[8px] font-bold border !border-white/20 transition-colors ${userColor.bg} ${userColor.text}`}>
                {authorInitials}
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground truncate text-[10px] max-w-[60px]">
              {authorName}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Draggable Task Card ──────────────────────────────────────────────────────
function DraggableTaskCard({
  task,
  onEdit,
  onDelete,
}: {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
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
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="relative cursor-grab active:cursor-grabbing"
    >
      <TaskCardContent task={task} onEdit={onEdit} onDelete={onDelete} />
    </div>
  )
}

// ─── Droppable Column ─────────────────────────────────────────────────────────
function DroppableColumn({
  column,
  tasks,
  onEdit,
  onDelete,
}: {
  column: (typeof BOARD_COLUMNS)[number]
  tasks: Task[]
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { status: column.id },
  })

  const colors = COLUMN_STYLES[column.id]

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[200px] flex-col rounded-xl border p-3 transition-colors ${colors.bg} ${colors.border} ${isOver ? 'ring-2 ring-primary/30 border-primary/50' : ''
        }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${colors.dot}`} />
          <h3 className={`text-sm font-semibold ${colors.headerBg}`}>{column.label}</h3>
          <Badge variant="outline" className="text-muted-foreground text-xs font-normal">
            {tasks.length}
          </Badge>
        </div>

      </div>

      <div className="flex-1">
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Task Dialog (Create / Edit) ──────────────────────────────────────────────
function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultStatus,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  defaultStatus: TaskStatus
  onSave: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [saving, setSaving] = useState(false)

  const isEditing = !!task

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? '')
      setPriority(task.priority)
    } else {
      setTitle('')
      setDescription('')
      setPriority('medium')
    }
  }, [task, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    try {
      if (isEditing) {
        await updateTask(task.id, { title, description, priority })
        toast.success('작업이 수정되었습니다.')
      } else {
        await createTask({ title, description, priority })
        toast.success('작업이 생성되었습니다.')
      }
      onSave()
      onOpenChange(false)
    } catch (err) {
      console.error('작업 저장 실패:', err)
      toast.error(isEditing ? '작업 수정에 실패했습니다.' : '작업 생성에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? '작업 수정' : '새 작업'}</DialogTitle>
          <DialogDescription>
            {isEditing ? '작업 내용을 수정합니다.' : '새로운 작업을 추가합니다.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="작업 제목을 입력하세요"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="작업 설명을 입력하세요 (선택)"
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>우선순위</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{TASK_PRIORITY_LABELS.low}</SelectItem>
                <SelectItem value="medium">{TASK_PRIORITY_LABELS.medium}</SelectItem>
                <SelectItem value="high">{TASK_PRIORITY_LABELS.high}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? '저장 중...' : isEditing ? '수정' : '생성'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Confirmation Dialog ───────────────────────────────────────────────
function DeleteDialog({
  open,
  onOpenChange,
  taskId,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string | null
  onConfirm: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!taskId) return
    setDeleting(true)
    try {
      await deleteTask(taskId)
      toast.success('작업이 삭제되었습니다.')
      onConfirm()
      onOpenChange(false)
    } catch (err) {
      console.error('작업 삭제 실패:', err)
      toast.error('작업 삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>작업 삭제</DialogTitle>
          <DialogDescription>이 작업을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Board Page ───────────────────────────────────────────────────────────────
export default function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo')

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)

  // Drag state
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const fetchTasks = useCallback(async () => {
    try {
      const data = await getTasks()
      setTasks(data as Task[])
    } catch (err) {
      console.error('작업 목록 로딩 실패:', err)
      toast.error('작업 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Group tasks by status
  const tasksByStatus = BOARD_COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = tasks.filter((t) => t.status === col.id)
      return acc
    },
    {} as Record<TaskStatus, Task[]>
  )

  // ─── Handlers ─────────────────────────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task as Task | undefined
    if (task) setActiveTask(task)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)

    const { active, over } = event
    if (!over) return

    const task = active.data.current?.task as Task | undefined
    if (!task) return

    const newStatus = over.id as TaskStatus
    if (task.status === newStatus) return

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: newStatus } : t
      )
    )

    // Get position at end of new column
    const targetTasks = tasks.filter((t) => t.status === newStatus)
    const maxPosition = targetTasks.length > 0
      ? Math.max(...targetTasks.map((t) => t.position))
      : -1

    try {
      await updateTaskStatus(task.id, newStatus, maxPosition + 1)
      await fetchTasks()
    } catch (err) {
      console.error('상태 변경 실패:', err)
      toast.error('상태 변경에 실패했습니다.')
      await fetchTasks() // revert
    }
  }

  function handleAdd(status: TaskStatus) {
    setEditingTask(null)
    setDefaultStatus(status)
    setTaskDialogOpen(true)
  }

  function handleEdit(task: Task) {
    setEditingTask(task)
    setTaskDialogOpen(true)
  }

  function handleDeleteClick(id: string) {
    setDeletingTaskId(id)
    setDeleteDialogOpen(true)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Kanban className="text-muted-foreground size-6" />
          <h1 className="text-2xl font-bold">보드</h1>
        </div>
        <Button onClick={() => handleAdd('todo')}>
          <Plus className="mr-1.5 size-4" />
          새 작업
        </Button>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 items-start md:grid-cols-3">
          {BOARD_COLUMNS.map((column) => (
            <DroppableColumn
              key={column.id}
              column={column}
              tasks={tasksByStatus[column.id] ?? []}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-72 rotate-2 opacity-90">
              <TaskCardContent
                task={activeTask}
                onEdit={() => { }}
                onDelete={() => { }}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Dialogs */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask}
        defaultStatus={defaultStatus}
        onSave={fetchTasks}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        taskId={deletingTaskId}
        onConfirm={fetchTasks}
      />
    </div>
  )
}
