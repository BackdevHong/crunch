export const MOCK_USERS = [
  { id: 1, name: '홍길동', email: 'hong@test.com', password: 'test1234', avatar: '홍', avatarBg: '#FFF0E8', avatarColor: '#C04A1A' },
  { id: 2, name: '김철수', email: 'kim@test.com', password: 'test1234', avatar: '김', avatarBg: '#E6F1FB', avatarColor: '#185FA5' },
]

export const CATEGORY_META = [
  { icon: '💻', label: '개발·IT', bg: '#FFF0E8' },
  { icon: '🎨', label: '디자인', bg: '#EAF3DE' },
  { icon: '📱', label: '마케팅', bg: '#E6F1FB' },
  { icon: '✍️', label: '글쓰기·번역', bg: '#FAEEDA' },
  { icon: '🎬', label: '영상·사진', bg: '#FBEAF0' },
  { icon: '🎵', label: '음악·오디오', bg: '#E1F5EE' },
]

export const MOCK_SERVICES = [
  { id: 1, emoji: '🌐', thumbBg: '#FFF8F5', badge: '베스트', avatarBg: '#FFF0E8', avatarColor: '#C04A1A', sellerName: '김민준', title: '반응형 웹사이트 풀스택 개발해 드립니다', rating: 4.9, reviewCount: 124, price: 200000, category: '개발·IT', skills: ['React', 'Node.js'], deliveryDays: 14 },
  { id: 2, emoji: '📱', thumbBg: '#EAF3DE', badge: null, avatarBg: '#EAF3DE', avatarColor: '#3B6D11', sellerName: '이소연', title: 'iOS · Android 앱 개발 및 유지보수', rating: 4.8, reviewCount: 87, price: 500000, category: '개발·IT', skills: ['Swift', 'Flutter'], deliveryDays: 30 },
  { id: 3, emoji: '⚡', thumbBg: '#E6F1FB', badge: '인기', avatarBg: '#E6F1FB', avatarColor: '#185FA5', sellerName: '박재현', title: '쇼핑몰 · 커머스 플랫폼 제작 전문', rating: 5.0, reviewCount: 211, price: 350000, category: '개발·IT', skills: ['React', 'AWS'], deliveryDays: 21 },
  { id: 4, emoji: '🤖', thumbBg: '#FAEEDA', badge: null, avatarBg: '#FAEEDA', avatarColor: '#854F0B', sellerName: '최다은', title: 'AI · 챗봇 · 자동화 스크립트 개발', rating: 4.7, reviewCount: 56, price: 150000, category: '개발·IT', skills: ['Python', 'LangChain'], deliveryDays: 7 },
  { id: 5, emoji: '🛡️', thumbBg: '#FBEAF0', badge: null, avatarBg: '#FBEAF0', avatarColor: '#993556', sellerName: '정우성', title: '서버 보안 점검 · AWS 인프라 구축', rating: 4.9, reviewCount: 43, price: 300000, category: '개발·IT', skills: ['AWS', 'Docker'], deliveryDays: 5 },
  { id: 6, emoji: '📊', thumbBg: '#E1F5EE', badge: null, avatarBg: '#E1F5EE', avatarColor: '#0F6E56', sellerName: '한지원', title: '데이터 분석 · 시각화 대시보드 제작', rating: 4.8, reviewCount: 72, price: 180000, category: '개발·IT', skills: ['Python', 'SQL'], deliveryDays: 10 },
  { id: 7, emoji: '🎨', thumbBg: '#FBEAF0', badge: '베스트', avatarBg: '#FBEAF0', avatarColor: '#993556', sellerName: '송예린', title: '브랜드 아이덴티티 · 로고 디자인', rating: 4.9, reviewCount: 189, price: 250000, category: '디자인', skills: ['Figma', 'Illustrator'], deliveryDays: 7 },
  { id: 8, emoji: '🖼️', thumbBg: '#EAF3DE', badge: null, avatarBg: '#EAF3DE', avatarColor: '#3B6D11', sellerName: '윤서진', title: 'UI/UX 디자인 및 프로토타이핑', rating: 4.7, reviewCount: 63, price: 200000, category: '디자인', skills: ['Figma', 'Framer'], deliveryDays: 14 },
  { id: 9, emoji: '🎬', thumbBg: '#FFF8F5', badge: null, avatarBg: '#FFF0E8', avatarColor: '#C04A1A', sellerName: '오지훈', title: '유튜브 · 릴스 숏폼 영상 편집', rating: 4.7, reviewCount: 63, price: 80000, category: '영상·사진', skills: ['Premiere', 'After Effects'], deliveryDays: 3 },
  { id: 10, emoji: '📸', thumbBg: '#E6F1FB', badge: '인기', avatarBg: '#E6F1FB', avatarColor: '#185FA5', sellerName: '강민서', title: '제품 · 음식 상업 사진 촬영', rating: 5.0, reviewCount: 95, price: 120000, category: '영상·사진', skills: ['Lightroom', 'Photoshop'], deliveryDays: 5 },
  { id: 11, emoji: '✍️', thumbBg: '#FAEEDA', badge: null, avatarBg: '#FAEEDA', avatarColor: '#854F0B', sellerName: '임하은', title: 'SEO 최적화 블로그 · 마케팅 글쓰기', rating: 4.6, reviewCount: 41, price: 50000, category: '글쓰기·번역', skills: ['카피라이팅'], deliveryDays: 2 },
  { id: 12, emoji: '🌍', thumbBg: '#E1F5EE', badge: null, avatarBg: '#E1F5EE', avatarColor: '#0F6E56', sellerName: '박수현', title: '영한 · 한영 전문 번역 서비스', rating: 4.9, reviewCount: 118, price: 30000, category: '글쓰기·번역', skills: ['영어', '번역'], deliveryDays: 3 },
  { id: 13, emoji: '📣', thumbBg: '#FBEAF0', badge: null, avatarBg: '#FBEAF0', avatarColor: '#993556', sellerName: '최예나', title: '인스타그램 · 유튜브 SNS 마케팅', rating: 4.8, reviewCount: 77, price: 100000, category: '마케팅', skills: ['SNS', '콘텐츠'], deliveryDays: 7 },
  { id: 14, emoji: '🎵', thumbBg: '#E1F5EE', badge: null, avatarBg: '#E1F5EE', avatarColor: '#0F6E56', sellerName: '정도윤', title: '유튜브 · 광고용 배경음악 작곡', rating: 4.7, reviewCount: 29, price: 70000, category: '음악·오디오', skills: ['작곡', 'Logic Pro'], deliveryDays: 7 },
]

export const MOCK_FREELANCERS = [
  { id: 1, name: '김민준', role: '풀스택 개발자', avatarBg: '#FFF0E8', avatarColor: '#C04A1A', badge: 'Top', rating: 4.9, completedJobs: 124, skills: ['React', 'Node.js', 'AWS'], hourlyRate: 50000, online: true, experience: '5년 이상', category: '개발·IT' },
  { id: 2, name: '이소연', role: 'iOS / Android 개발자', avatarBg: '#E6F1FB', avatarColor: '#185FA5', badge: 'Pro', rating: 4.8, completedJobs: 87, skills: ['Swift', 'Kotlin', 'Flutter'], hourlyRate: 65000, online: false, experience: '3~5년', category: '개발·IT' },
  { id: 3, name: '박재현', role: 'UI/UX 디자이너', avatarBg: '#EAF3DE', avatarColor: '#3B6D11', badge: 'Top', rating: 5.0, completedJobs: 211, skills: ['Figma', 'Framer', 'React'], hourlyRate: 45000, online: true, experience: '5년 이상', category: '디자인' },
  { id: 4, name: '최다은', role: 'AI / ML 엔지니어', avatarBg: '#FAEEDA', avatarColor: '#854F0B', badge: 'New', rating: 4.7, completedJobs: 56, skills: ['Python', 'PyTorch', 'LangChain'], hourlyRate: 70000, online: false, experience: '1~3년', category: '개발·IT' },
  { id: 5, name: '정우성', role: 'DevOps / 클라우드', avatarBg: '#FBEAF0', avatarColor: '#993556', badge: 'Pro', rating: 4.9, completedJobs: 43, skills: ['AWS', 'Docker', 'Terraform'], hourlyRate: 80000, online: true, experience: '5년 이상', category: '개발·IT' },
  { id: 6, name: '한지원', role: '데이터 분석가', avatarBg: '#E1F5EE', avatarColor: '#0F6E56', badge: 'Pro', rating: 4.8, completedJobs: 72, skills: ['Python', 'SQL', 'Tableau'], hourlyRate: 55000, online: false, experience: '3~5년', category: '개발·IT' },
  { id: 7, name: '송예린', role: '브랜드 디자이너', avatarBg: '#FBEAF0', avatarColor: '#993556', badge: 'Top', rating: 4.9, completedJobs: 189, skills: ['Figma', 'Illustrator', 'Photoshop'], hourlyRate: 40000, online: true, experience: '5년 이상', category: '디자인' },
  { id: 8, name: '오지훈', role: '영상 편집자', avatarBg: '#FFF0E8', avatarColor: '#C04A1A', badge: 'New', rating: 4.7, completedJobs: 38, skills: ['Premiere', 'After Effects'], hourlyRate: 35000, online: false, experience: '1~3년', category: '영상·사진' },
]

export const SKILL_TAGS = ['React', 'Vue', 'Next.js', 'Node.js', 'Python', 'Swift', 'Flutter', 'Figma', 'AWS', 'Docker', 'TypeScript', 'MySQL']
export const COLLAB_TAGS = ['원격 가능', '대면 선호', '주 1회 미팅', '슬랙 소통', '노션 협업', '화상 미팅']
export const DEADLINE_OPTIONS = ['1주일 이내', '2주일 이내', '1개월 이내', '1~3개월', '3개월 이상', '협의']
export const BUDGET_PRESETS = [
  { label: '~50만원', sub: '소규모', max: 500000 },
  { label: '50~200만원', sub: '중규모', max: 2000000 },
  { label: '200만원+', sub: '대규모', max: Infinity },
]
