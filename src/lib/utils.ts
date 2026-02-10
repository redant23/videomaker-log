import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getURL() {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // 환경변수에 설정한 주소
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Vercel 배포 주소
    'http://localhost:3000/'; // 로컬 주소

  // 끝에 슬래시 포함 여부 확인하고 http 설정
  url = url.includes('http') ? url : `https://${url}`;
  return url.endsWith('/') ? url : `${url}/`;
}

