'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, MoreHorizontal, Calendar, Pencil, Trash2, FileText, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import { Meeting, Profile } from '@/types'
import { getUserColor } from '@/lib/colors'
import { createClient } from '@/lib/supabase/client'
import {
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
} from '@/actions/meetings'
import { extractMentions } from '@/lib/mention-utils'
import { MarkdownRenderer, stripMarkdown } from '@/components/markdown-renderer'
import { MentionInput } from '@/components/mention-input'

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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
  const stripped = stripMarkdown(text)
  return stripped.length > maxLength ? stripped.slice(0, maxLength) + '...' : stripped
}

const STEP_LABELS = [
  { key: 'title', label: '제목 · 날짜' },
  { key: 'progress_review', label: '진행 상황' },
  { key: 'deliverable_review', label: '산출물 리뷰' },
  { key: 'retrospective', label: '회고' },
  { key: 'next_week_plan', label: '다음 주 계획' },
] as const

const MARKDOWN_HELP = '마크다운 지원: **굵게**, *기울임*, `코드`, - 목록, ## 제목, [링크](url)'

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isMaster, setIsMaster] = useState(false)

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Form and selection state
  const [formData, setFormData] = useState<FormData>(getEmptyForm)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          if (profile?.role === 'master') setIsMaster(true)
        } catch {
          // role 컬럼이 아직 없는 경우 무시
        }

        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: true })
        if (allProfiles) setMembers(allProfiles)
      }
    }
    loadUser()
  }, [])

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

  const canEditOrDelete = (meeting: Meeting) => {
    return isMaster || meeting.created_by === currentUserId
  }

  const sendMentionNotifications = async (text: string, meetingTitle: string) => {
    const allText = [
      formData.progress_review,
      formData.deliverable_review,
      formData.retrospective,
      formData.next_week_plan,
    ].join(' ')

    const mentioned = extractMentions(allText, members)
    const otherMentioned = mentioned.filter((m) => m.id !== currentUserId)

    if (otherMentioned.length > 0) {
      const currentMember = members.find((m) => m.id === currentUserId)
      try {
        await fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mentionedUserIds: otherMentioned.map((m) => m.id),
            meetingTitle,
            mentionerName: currentMember?.display_name ?? '팀원',
          }),
        })
      } catch (err) {
        console.error('멘션 알림 실패:', err)
      }
    }
  }

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast.error('제목을 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      await createMeeting(formData)
      await sendMentionNotifications(formData.title, formData.title)
      toast.success('회의록이 생성되었습니다.')
      setCreateOpen(false)
      setFormData(getEmptyForm())
      setStep(0)
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
      await sendMentionNotifications(formData.title, formData.title)
      toast.success('회의록이 수정되었습니다.')
      setEditOpen(false)
      setSelectedMeeting(null)
      setFormData(getEmptyForm())
      setStep(0)
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
    setStep(0)
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

  const stepContent = (
    <div className="grid gap-4">
      {/* Step indicators */}
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStep(i)}
            className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {step + 1}/{STEP_LABELS.length} · {STEP_LABELS[step].label}
      </p>

      {step === 0 && (
        <>
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
        </>
      )}
      {step === 1 && (
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="progress_review">진행 상황 리뷰</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {MARKDOWN_HELP}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <MentionInput
            id="progress_review"
            placeholder="진행 상황을 입력하세요 (@멘션 가능)"
            rows={6}
            value={formData.progress_review}
            onChange={(v) => updateField('progress_review', v)}
            members={members}
          />
        </div>
      )}
      {step === 2 && (
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="deliverable_review">산출물 리뷰</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {MARKDOWN_HELP}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <MentionInput
            id="deliverable_review"
            placeholder="산출물 리뷰를 입력하세요 (@멘션 가능)"
            rows={6}
            value={formData.deliverable_review}
            onChange={(v) => updateField('deliverable_review', v)}
            members={members}
          />
        </div>
      )}
      {step === 3 && (
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="retrospective">회고</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {MARKDOWN_HELP}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <MentionInput
            id="retrospective"
            placeholder="회고 내용을 입력하세요 (@멘션 가능)"
            rows={6}
            value={formData.retrospective}
            onChange={(v) => updateField('retrospective', v)}
            members={members}
          />
        </div>
      )}
      {step === 4 && (
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="next_week_plan">다음 주 계획</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {MARKDOWN_HELP}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <MentionInput
            id="next_week_plan"
            placeholder="다음 주 계획을 입력하세요 (@멘션 가능)"
            rows={6}
            value={formData.next_week_plan}
            onChange={(v) => updateField('next_week_plan', v)}
            members={members}
          />
        </div>
      )}
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
            if (!open) {
              setFormData(getEmptyForm())
              setStep(0)
            }
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
              {stepContent}
            </ScrollArea>
            <DialogFooter className="flex-row justify-end sm:justify-end">
              <div className="flex gap-2">
                {step > 0 && (
                  <Button variant="outline" onClick={() => setStep(step - 1)}>
                    <ChevronLeft className="size-4" />
                    이전
                  </Button>
                )}
                {step < STEP_LABELS.length - 1 ? (
                  <Button onClick={() => setStep(step + 1)}>
                    다음
                    <ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button onClick={handleCreate} disabled={submitting}>
                    {submitting ? '생성 중...' : '생성'}
                  </Button>
                )}
              </div>
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
          {meetings.map((meeting) => {
            const userColor = getUserColor(meeting.created_by, meeting.profiles)
            return (
              <Card key={meeting.id} className="transition-shadow hover:shadow-md cursor-pointer" onClick={() => openDetail(meeting)}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {meeting.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-3 flex-wrap">
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
                            <AvatarFallback
                              className={cn("text-[9px] font-bold", userColor.text)}
                              style={{ backgroundColor: userColor.hex }}
                            >
                              {meeting.profiles.display_name.slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{meeting.profiles.display_name}</span>
                        </div>
                      </>
                    )}
                    {meeting.edit_status === 'edited' && (
                      <>
                        <Separator orientation="vertical" className="h-3.5" />
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          수정됨
                          {(meeting as any).editor?.display_name && ` · ${(meeting as any).editor.display_name}`}
                          {meeting.edited_at && ` · ${format(new Date(meeting.edited_at), 'M/d HH:mm')}`}
                        </Badge>
                      </>
                    )}
                  </CardDescription>
                  {canEditOrDelete(meeting) && (
                    <CardAction onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">메뉴</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
                  )}
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
            )
          })}
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
                <DialogDescription className="flex items-center gap-3 flex-wrap">
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
                  {selectedMeeting.edit_status === 'edited' && (
                    <>
                      <Separator orientation="vertical" className="h-3.5" />
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        수정됨
                        {(selectedMeeting as any).editor?.display_name && ` · ${(selectedMeeting as any).editor.display_name}`}
                      </Badge>
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
                      <MarkdownRenderer content={selectedMeeting.progress_review} />
                    </div>
                  )}
                  {selectedMeeting.deliverable_review && (
                    <>
                      <Separator />
                      <div>
                        <Badge variant="outline" className="mb-2">
                          산출물 리뷰
                        </Badge>
                        <MarkdownRenderer content={selectedMeeting.deliverable_review} />
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
                        <MarkdownRenderer content={selectedMeeting.retrospective} />
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
                        <MarkdownRenderer content={selectedMeeting.next_week_plan} />
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">닫기</Button>
                </DialogClose>
                {canEditOrDelete(selectedMeeting) && (
                  <Button
                    onClick={() => {
                      setDetailOpen(false)
                      openEdit(selectedMeeting)
                    }}
                  >
                    <Pencil />
                    수정
                  </Button>
                )}
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
            setStep(0)
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
            {stepContent}
          </ScrollArea>
          <DialogFooter className="flex-row justify-end sm:justify-end">
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  <ChevronLeft className="size-4" />
                  이전
                </Button>
              )}
              {step < STEP_LABELS.length - 1 ? (
                <Button onClick={() => setStep(step + 1)}>
                  다음
                  <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button onClick={handleUpdate} disabled={submitting}>
                  {submitting ? '저장 중...' : '저장'}
                </Button>
              )}
            </div>
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
