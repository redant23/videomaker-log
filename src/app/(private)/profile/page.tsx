'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { UserCog, Check } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { updateProfile, updatePassword } from '@/actions/profile'
import { COLOR_OPTIONS } from '@/lib/colors'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState('')
  const [userColor, setUserColor] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email ?? '')

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, user_color')
          .eq('id', user.id)
          .single()
        if (profile) {
          setDisplayName(profile.display_name)
          setUserColor(profile.user_color)
        }
      } catch {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .single()
        if (profile) setDisplayName(profile.display_name)
      }
    }
    load()
  }, [])

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      toast.error('닉네임을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await updateProfile({ display_name: displayName.trim(), user_color: userColor })
      toast.success('프로필이 저장되었습니다.')
    } catch (err) {
      console.error('프로필 저장 실패:', err)
      toast.error('프로필 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다.')
      return
    }
    setChangingPassword(true)
    try {
      await updatePassword(newPassword)
      toast.success('비밀번호가 변경되었습니다.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error('비밀번호 변경 실패:', err)
      toast.error('비밀번호 변경에 실패했습니다.')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">내 정보</h1>
        <p className="text-muted-foreground text-sm mt-1">프로필과 계정 설정을 관리합니다.</p>
      </div>

      {/* 프로필 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="size-5" />
            프로필 설정
          </CardTitle>
          <CardDescription>닉네임과 색상을 변경할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>이메일</Label>
            <Input value={email} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">닉네임</Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="닉네임을 입력하세요"
            />
          </div>

          <div className="space-y-2">
            <Label>색상</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  className="relative size-8 rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: color.hex,
                    borderColor: userColor === color.hex ? 'white' : 'transparent',
                    boxShadow: userColor === color.hex ? `0 0 0 2px ${color.hex}` : 'none',
                  }}
                  onClick={() => setUserColor(color.hex)}
                  title={color.name}
                >
                  {userColor === color.hex && (
                    <Check className="absolute inset-0 m-auto size-4 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? '저장 중...' : '프로필 저장'}
          </Button>
        </CardContent>
      </Card>

      {/* 비밀번호 변경 */}
      <Card>
        <CardHeader>
          <CardTitle>비밀번호 변경</CardTitle>
          <CardDescription>새 비밀번호를 입력하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_password">새 비밀번호</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="최소 6자 이상"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">비밀번호 확인</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호를 다시 입력하세요"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword}>
            {changingPassword ? '변경 중...' : '비밀번호 변경'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
