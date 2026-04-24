import { ServiceCategory } from '@prisma/client'

export const CATEGORY_MAP: Record<string, ServiceCategory> = {
  '개발·IT':    ServiceCategory.DEV,
  '디자인':     ServiceCategory.DESIGN,
  '마케팅':     ServiceCategory.MARKETING,
  '글쓰기·번역': ServiceCategory.WRITING,
  '영상·사진':  ServiceCategory.VIDEO,
  '음악·오디오': ServiceCategory.MUSIC,
}

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MAP).map(([k, v]) => [v, k])
)