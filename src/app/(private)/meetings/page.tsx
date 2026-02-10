'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  Plus,
  MoreHorizontal,
  Calendar,
  Pencil,
  Trash2,
  Eye,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'

import { Meeting } from '@/types'
import { getUserColor } from '@/lib/colors'
import {
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
} from '@/actions/meetings'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
  CardFooter,
} from '@/components/ui/card'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type FormData = {
  title: string
  meeting_date: string
  progress_review: string
  deliverable_review: string
  retrospective: string
  next_week_plan: string
}

function getEmptyForm(): FormData {
  return {
    title: '',
    meeting_date: format(new Date(), 'yyyy-MM-dd'),
    progress_review: '',
    deliverable_review: '',
    retrospective: '',
    next_week_plan: '',
  }
}

function truncate(text: string, maxLength: number = 80) {
  if (!text) return ''
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Form and selection state
  const [formData, setFormData] = useState<FormData>(getEmptyForm)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchMeetings = useCallback(async () => {
    try {
      const data = await getMeetings()
      setMeetings(data)
    } catch (err) {
      console.error('회의록 로딩 실패:', err)
      toast.error('회의록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast.error('제목을 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      await createMeeting(formData)
      toast.success('회의록이 생성되었습니다.')
      setCreateOpen(false)
      setFormData(getEmptyForm())
      await fetchMeetings()
    } catch (err) {
      console.error('회의록 생성 실패:', err)
      toast.error('회의록 생성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedMeeting) return
    if (!formData.title.trim()) {
      toast.error('제목을 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      await updateMeeting(selectedMeeting.id, formData)
      toast.success('회의록이 수정되었습니다.')
      setEditOpen(false)
      setSelectedMeeting(null)
      setFormData(getEmptyForm())
      await fetchMeetings()
    } catch (err) {
      console.error('회의록 수정 실패:', err)
      toast.error('회의록 수정에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedMeeting) return
    setSubmitting(true)
    try {
      await deleteMeeting(selectedMeeting.id)
      toast.success('회의록이 삭제되었습니다.')
      setDeleteOpen(false)
      setSelectedMeeting(null)
      await fetchMeetings()
    } catch (err) {
      console.error('회의록 삭제 실패:', err)
      toast.error('회의록 삭제에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (meeting: Meeting) => {
    setSelectedMeeting(meeting)
    setFormData({
      title: meeting.title,
      meeting_date: meeting.meeting_date,
      progress_review: meeting.progress_review,
      deliverable_review: meeting.deliverable_review,
      retrospective: meeting.retrospective,
      next_week_plan: meeting.next_week_plan,
    })
    setEditOpen(true)
  }

  const openDetail = (meeting: Meeting) => {
    setSelectedMeeting(meeting)
    setDetailOpen(true)
  }

  const openDelete = (meeting: Meeting) => {
    setSelectedMeeting(meeting)
    setDeleteOpen(true)
  }

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const formFields = (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="title">제목</Label>
        <Input
          id="title"
          placeholder="회의 제목을 입력하세요"
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="meeting_date">회의 날짜</Label>
        <Input
          id="meeting_date"
          type="date"
          value={formData.meeting_date}
          onChange={(e) => updateField('meeting_date', e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="progress_review">진행 상황 리뷰</Label>
        <Textarea
          id="progress_review"
          placeholder="진행 상황을 입력하세요"
          rows={3}
          value={formData.progress_review}
          onChange={(e) => updateField('progress_review', e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="deliverable_review">산출물 리뷰</Label>
        <Textarea
          id="deliverable_review"
          placeholder="산출물 리뷰를 입력하세요"
          rows={3}
          value={formData.deliverable_review}
          onChange={(e) => updateField('deliverable_review', e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="retrospective">회고</Label>
        <Textarea
          id="retrospective"
          placeholder="회고 내용을 입력하세요"
          rows={3}
          value={formData.retrospective}
          onChange={(e) => updateField('retrospective', e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="next_week_plan">다음 주 계획</Label>
        <Textarea
          id="next_week_plan"
          placeholder="다음 주 계획을 입력하세요"
          rows={3}
          value={formData.next_week_plan}
          onChange={(e) => updateField('next_week_plan', e.target.value)}
        />
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">회의록</h1>
          <p className="text-muted-foreground text-sm mt-1">
            팀 회의 기록을 관리합니다.
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (!open) setFormData(getEmptyForm())
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus />
              새 회의록
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>새 회의록 작성</DialogTitle>
              <DialogDescription>
                회의 내용을 기록합니다.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              {formFields}
            </ScrollArea>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">취소</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? '생성 중...' : '생성'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty State */}
      {meetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="text-muted-foreground mb-4 size-12" />
            <p className="text-muted-foreground text-lg font-medium">
              아직 회의록이 없습니다
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              첫 번째 회의록을 작성해보세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Meeting Cards */
        <div className="grid gap-4">
          {meetings.map((meeting) => (
            <Card key={meeting.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">
                  {meeting.title}
                </CardTitle>
                <CardDescription className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    {format(new Date(meeting.meeting_date), 'yyyy년 M월 d일', {
                      locale: ko,
                    })}
                  </span>
                  {meeting.profiles?.display_name && (
                    <>
                      <Separator orientation="vertical" className="h-3.5" />
                      <div className="flex items-center gap-1.5">
                        <Avatar className="size-4.5">
                          {meeting.profiles.avatar_url && (
                            <AvatarImage src={meeting.profiles.avatar_url} />
                          )}
                          <AvatarFallback className={`text-[9px] font-bold ${getUserColor(meeting.created_by).bg} ${getUserColor(meeting.created_by).text}`}>
                            {meeting.profiles.display_name.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{meeting.profiles.display_name}</span>
                      </div>
                    </>
                  )}
                </CardDescription>
                <CardAction>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">메뉴</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openDetail(meeting)}>
                        <Eye className="mr-2 size-4" />
                        상세 보기
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(meeting)}>
                        <Pencil className="mr-2 size-4" />
                        수정
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => openDelete(meeting)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {meeting.progress_review && (
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        진행 상황
                      </p>
                      <p className="text-sm leading-relaxed">
                        {truncate(meeting.progress_review)}
                      </p>
                    </div>
                  )}
                  {meeting.deliverable_review && (
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        산출물 리뷰
                      </p>
                      <p className="text-sm leading-relaxed">
                        {truncate(meeting.deliverable_review)}
                      </p>
                    </div>
                  )}
                  {meeting.retrospective && (
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        회고
                      </p>
                      <p className="text-sm leading-relaxed">
                        {truncate(meeting.retrospective)}
                      </p>
                    </div>
                  )}
                  {meeting.next_week_plan && (
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        다음 주 계획
                      </p>
                      <p className="text-sm leading-relaxed">
                        {truncate(meeting.next_week_plan)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  작성일:{' '}
                  {format(new Date(meeting.created_at), 'yyyy년 M월 d일 HH:mm', {
                    locale: ko,
                  })}
                </p>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedMeeting(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          {selectedMeeting && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedMeeting.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    {format(
                      new Date(selectedMeeting.meeting_date),
                      'yyyy년 M월 d일',
                      { locale: ko }
                    )}
                  </span>
                  {selectedMeeting.profiles?.display_name && (
                    <>
                      <Separator orientation="vertical" className="h-3.5" />
                      <span>{selectedMeeting.profiles.display_name}</span>
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="grid gap-4">
                  {selectedMeeting.progress_review && (
                    <div>
                      <Badge variant="outline" className="mb-2">
                        진행 상황 리뷰
                      </Badge>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedMeeting.progress_review}
                      </p>
                    </div>
                  )}
                  {selectedMeeting.deliverable_review && (
                    <>
                      <Separator />
                      <div>
                        <Badge variant="outline" className="mb-2">
                          산출물 리뷰
                        </Badge>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedMeeting.deliverable_review}
                        </p>
                      </div>
                    </>
                  )}
                  {selectedMeeting.retrospective && (
                    <>
                      <Separator />
                      <div>
                        <Badge variant="outline" className="mb-2">
                          회고
                        </Badge>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedMeeting.retrospective}
                        </p>
                      </div>
                    </>
                  )}
                  {selectedMeeting.next_week_plan && (
                    <>
                      <Separator />
                      <div>
                        <Badge variant="outline" className="mb-2">
                          다음 주 계획
                        </Badge>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedMeeting.next_week_plan}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">닫기</Button>
                </DialogClose>
                <Button
                  onClick={() => {
                    setDetailOpen(false)
                    openEdit(selectedMeeting)
                  }}
                >
                  <Pencil />
                  수정
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setSelectedMeeting(null)
            setFormData(getEmptyForm())
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>회의록 수정</DialogTitle>
            <DialogDescription>
              회의 내용을 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {formFields}
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">취소</Button>
            </DialogClose>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setSelectedMeeting(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>회의록 삭제</DialogTitle>
            <DialogDescription>
              &ldquo;{selectedMeeting?.title}&rdquo; 회의록을 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">취소</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
