export const CATEGORY_MAP: Record<string, string> = {
  '개발·IT':    'DEV',
  '디자인':     'DESIGN',
  '마케팅':     'MARKETING',
  '글쓰기·번역': 'WRITING',
  '영상·사진':  'VIDEO',
  '음악·오디오': 'MUSIC',
}

// 역방향 (DB → 프론트 표시용)
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MAP).map(([k, v]) => [v, k])
)