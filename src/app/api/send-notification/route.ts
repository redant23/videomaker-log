import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { mentionedUserIds, meetingTitle, mentionerName, source, messagePreview } = await request.json()

    if (!mentionedUserIds?.length) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const supabase = await createClient()

    // 멘션된 사용자들의 이메일 가져오기 (profiles.email 컬럼)
    const { data: users } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('id', mentionedUserIds)

    if (!users?.length) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    // 이메일이 있는 사용자만 필터
    const usersWithEmail = users.filter((u) => u.email)
    if (!usersWithEmail.length) {
      console.warn('멘션된 사용자 중 이메일이 있는 사용자가 없습니다.')
      return NextResponse.json({ ok: true, sent: 0, reason: 'no_emails' })
    }

    // 오늘 발송된 이메일 수 확인 (Resend 무료 일일 한도 100건)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('email_queue')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
      .not('sent_at', 'is', null)

    const dailySent = count ?? 0
    const remaining = Math.max(0, 100 - dailySent)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://crew.ramonworks.com'

    // source에 따라 이메일 제목/본문 분기
    const isResource = source === 'resource'
    const subject = isResource
      ? `[Videomaker Log] ${mentionerName}님이 리소스에서 회원님을 언급했습니다`
      : `[Videomaker Log] ${mentionerName}님이 회의록에서 회원님을 언급했습니다`

    const preview = messagePreview ? `<blockquote style="border-left:3px solid #8b5cf6;padding:8px 12px;margin:12px 0;color:#555;">${messagePreview}</blockquote>` : ''

    const htmlBody = isResource
      ? `<p><strong>${mentionerName}</strong>님이 리소스 채팅에서 회원님을 언급했습니다.</p>${preview}<p><a href="${siteUrl}/resources">리소스 확인하기</a></p>`
      : `<p><strong>${mentionerName}</strong>님이 <strong>"${meetingTitle}"</strong> 회의록에서 회원님을 언급했습니다.</p>${preview}<p><a href="${siteUrl}/meetings">회의록 확인하기</a></p>`

    // 실제 이메일 발송 + 큐 기록
    let sentCount = 0
    const toSend = usersWithEmail.slice(0, remaining)

    for (const user of toSend) {
      try {
        await resend.emails.send({
          from: 'Videomaker Log <onboarding@resend.dev>',
          to: user.email,
          subject,
          html: htmlBody,
        })

        // 발송 성공 시 큐에 sent_at과 함께 기록
        await supabase.from('email_queue').insert({
          to_email: user.email,
          subject,
          html_body: htmlBody,
          scheduled_for: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        })

        sentCount++
      } catch (emailErr) {
        console.error(`이메일 발송 실패 (${user.email}):`, emailErr)
        // 실패 시 큐에 sent_at 없이 기록 (재시도 가능)
        await supabase.from('email_queue').insert({
          to_email: user.email,
          subject,
          html_body: htmlBody,
          scheduled_for: new Date().toISOString(),
        })
      }
    }

    return NextResponse.json({ ok: true, sent: sentCount, total: usersWithEmail.length })
  } catch (error) {
    console.error('알림 발송 오류:', error)
    return NextResponse.json({ error: '알림 발송에 실패했습니다.' }, { status: 500 })
  }
}
