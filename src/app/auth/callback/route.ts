import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { COLOR_OPTIONS } from '@/lib/colors'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/meetings'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // 신규 가입 유저에게 중복되지 않는 색상 자동 배정
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_color')
            .eq('id', user.id)
            .single()

          if (profile && !profile.user_color) {
            // 이미 사용 중인 색상 조회
            const { data: usedColors } = await supabase
              .from('profiles')
              .select('user_color')
              .not('user_color', 'is', null)

            const usedSet = new Set(usedColors?.map((p) => p.user_color) ?? [])
            const allHexes = COLOR_OPTIONS.map((c) => c.hex)

            // 미사용 색상 중 첫 번째 선택, 없으면 가장 적게 쓰인 색상
            let assignedColor = allHexes.find((hex) => !usedSet.has(hex))
            if (!assignedColor) {
              // 모든 색상이 사용 중이면 가장 적게 사용된 색상 선택
              const colorCounts: Record<string, number> = {}
              allHexes.forEach((hex) => (colorCounts[hex] = 0))
              usedColors?.forEach((p) => {
                if (p.user_color && colorCounts[p.user_color] !== undefined) {
                  colorCounts[p.user_color]++
                }
              })
              assignedColor = allHexes.reduce((a, b) => (colorCounts[a] <= colorCounts[b] ? a : b))
            }

            await supabase
              .from('profiles')
              .update({ user_color: assignedColor })
              .eq('id', user.id)
          }
        }
      } catch {
        // user_color 컬럼이 아직 없는 경우 무시
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
