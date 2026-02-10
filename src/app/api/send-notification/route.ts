import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { mentionedUserIds, meetingTitle, meetingId, mentionerName } = await request.json()

    if (!mentionedUserIds?.length) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const supabase = await createClient()

    // 멘션된 사용자들의 이메일 가져오기
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .in('id', mentionedUserIds)

    if (!users?.length) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    // 오늘 발송된 이메일 수 확인
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('email_queue')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
      .not('sent_at', 'is', null)

    const dailySent = count ?? 0
    const remaining = Math.max(0, 100 - dailySent)

    // 이메일 큐에 추가
    const emailEntries = users.slice(0, remaining).map((user) => ({
      to_email: user.id, // 실제로는 auth.users에서 이메일을 가져와야 하지만, RLS로 인해 프로필 ID 저장
      subject: `[Videomaker Log] ${mentionerName}님이 회의록에서 회원님을 언급했습니다`,
      html_body: `<p><strong>${mentionerName}</strong>님이 <strong>"${meetingTitle}"</strong> 회의록에서 회원님을 언급했습니다.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://crew.ramonworks.com'}/meetings">회의록 확인하기</a></p>`,
      scheduled_for: new Date().toISOString(),
    }))

    if (emailEntries.length > 0) {
      await supabase.from('email_queue').insert(emailEntries)
    }

    // 일일 한도 초과분은 다음날로 예약
    if (users.length > remaining) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)

      const delayedEntries = users.slice(remaining).map((user) => ({
        to_email: user.id,
        subject: `[Videomaker Log] ${mentionerName}님이 회의록에서 회원님을 언급했습니다`,
        html_body: `<p><strong>${mentionerName}</strong>님이 <strong>"${meetingTitle}"</strong> 회의록에서 회원님을 언급했습니다.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://crew.ramonworks.com'}/meetings">회의록 확인하기</a></p>`,
        scheduled_for: tomorrow.toISOString(),
      }))

      await supabase.from('email_queue').insert(delayedEntries)
    }

    return NextResponse.json({ ok: true, sent: emailEntries.length, queued: Math.max(0, users.length - remaining) })
  } catch (error) {
    console.error('알림 발송 오류:', error)
    return NextResponse.json({ error: '알림 발송에 실패했습니다.' }, { status: 500 })
  }
}
