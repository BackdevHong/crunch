import { useApp } from '../context/AppContext'
import styles from './HomePage.module.css'

const STATS = [
  { num: '28,400+', label: '등록된 전문가' },
  { num: '142,000+', label: '완료된 프로젝트' },
  { num: '4.9 / 5', label: '평균 만족도' },
  { num: '97%', label: '기한 내 완료율' },
]

const HOW_STEPS = [
  { title: '프로젝트 등록', desc: '원하는 작업과 예산을 간단히 입력하세요. 5분이면 충분합니다.' },
  { title: '전문가 제안 수신', desc: '48시간 내 평균 5.2개의 맞춤 제안이 도착합니다. 포트폴리오를 비교해보세요.' },
  { title: '안전하게 완료', desc: '에스크로 결제로 작업 완료 후 대금이 지급됩니다. 검수까지 완벽하게.' },
]

const CATEGORIES = [
  { icon: '💻', label: '개발 · IT', count: '8,204', bg: '#FFF0E8' },
  { icon: '🎨', label: '디자인', count: '6,812', bg: '#EAF3DE' },
  { icon: '📱', label: '마케팅', count: '3,401', bg: '#E6F1FB' },
  { icon: '✍️', label: '글쓰기 · 번역', count: '2,970', bg: '#FAEEDA' },
  { icon: '🎬', label: '영상 · 사진', count: '2,115', bg: '#FBEAF0' },
  { icon: '🎵', label: '음악 · 오디오', count: '987', bg: '#E1F5EE' },
]

const WHY_ITEMS = [
  { icon: '🔒', title: '안전한 에스크로 결제', desc: '작업 완료 후 자동 정산. 결과물이 마음에 들어야만 대금이 지급됩니다.' },
  { icon: '✅', title: '검증된 전문가', desc: '포트폴리오 심사와 실력 테스트를 통과한 전문가만 활동할 수 있습니다.' },
  { icon: '💬', title: '실시간 소통', desc: '내장 메신저로 언제든지 진행 상황을 확인하고 피드백을 주고받으세요.' },
  { icon: '⚡', title: '빠른 매칭', desc: '프로젝트 등록 후 평균 4시간 내 첫 번째 전문가 제안이 도착합니다.' },
  { icon: '🛡️', title: '분쟁 조정 지원', desc: '작업 결과에 이견이 있을 경우 크런치 팀이 중립적으로 조정해 드립니다.' },
  { icon: '📊', title: '투명한 이력 관리', desc: '모든 거래 이력과 리뷰가 기록되어 신뢰할 수 있는 평판을 만들어 드립니다.' },
]

const REVIEWS = [
  { stars: 5, text: '"기획부터 개발까지 완벽하게 맞춰주셨어요. 일정도 딱 맞게 지켜주시고 소통도 너무 원활했습니다."', name: '오성준', role: '스타트업 대표', avatarBg: '#FFF0E8', avatarColor: '#C04A1A' },
  { stars: 5, text: '"로고 디자인을 맡겼는데 기대 이상의 결과물이 나왔습니다. 수정 요청도 빠르게 반영해 주셨어요."', name: '이지현', role: '온라인 쇼핑몰 운영', avatarBg: '#E6F1FB', avatarColor: '#185FA5' },
  { stars: 5, text: '"에스크로 결제 덕분에 안심하고 진행할 수 있었어요. 결과물 확인 후 정산되니 믿음이 갔습니다."', name: '박현우', role: '마케팅 담당자', avatarBg: '#EAF3DE', avatarColor: '#3B6D11' },
]

const TRUST_AVATARS = [
  { bg: '#FFF0E8', color: '#C04A1A', label: '김' },
  { bg: '#E6F1FB', color: '#185FA5', label: '이' },
  { bg: '#EAF3DE', color: '#3B6D11', label: '박' },
  { bg: '#FAEEDA', color: '#854F0B', label: '최' },
]

export default function HomePage({ onNavigate, onSignup }) {
  const { freelancers, setSelectedFreelancer } = useApp()
  const topFreelancers = freelancers.filter(f => f.badge === 'Top' || f.badge === 'Pro').slice(0, 4)

  return (
    <div className={styles.page}>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroEyebrow}>
          <span className={styles.eyebrowDot} />
          실시간 · 28,400명 활동 중
        </div>
        <h1>당신의 아이디어를<br /><em>현실로</em> 만들어 드립니다</h1>
        <p>국내 최고의 프리랜서들이 당신의 프로젝트를 기다립니다.<br />지금 바로 시작해보세요.</p>
        <div className={styles.heroBtns}>
          <button className={styles.btnPrimary} onClick={() => onNavigate('services')}>서비스 찾기</button>
          <button className={styles.btnGhost} onClick={() => onNavigate('freelancers')}>프리랜서 찾기</button>
        </div>
        <div className={styles.heroTrust}>
          <div className={styles.trustAvatars}>
            {TRUST_AVATARS.map(a => (
              <div key={a.label} className={styles.trustAv} style={{ background: a.bg, color: a.color }}>{a.label}</div>
            ))}
          </div>
          <span>이미 <strong>142,000+</strong>개의 프로젝트가 완료되었습니다</span>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className={styles.statsBar}>
        {STATS.map(s => (
          <div key={s.label} className={styles.stat}>
            <div className={styles.statNum}>{s.num}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className={styles.howSection}>
        <div className={styles.inner}>
          <div className={styles.sectionLabel}>이용 방법</div>
          <h2>3단계로 끝나는 외주 매칭</h2>
          <p className={styles.sectionSub}>복잡한 절차 없이, 빠르고 안전하게</p>
          <div className={styles.stepsGrid}>
            {HOW_STEPS.map((step, i) => (
              <div key={step.title} className={styles.stepCard}>
                <div className={styles.stepNum}>{i + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
                {i < HOW_STEPS.length - 1 && <span className={styles.stepArrow}>→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section className={styles.catsSection}>
        <div className={styles.inner}>
          <div className={styles.sectionLabel}>카테고리</div>
          <h2>어떤 도움이 필요하신가요?</h2>
          <p className={styles.sectionSub}>6개 분야, 8,200명 이상의 전문가</p>
          <div className={styles.catsGrid}>
            {CATEGORIES.map(cat => (
              <div key={cat.label} className={styles.catCard} onClick={() => onNavigate('services')}>
                <div className={styles.catIcon} style={{ background: cat.bg }}>{cat.icon}</div>
                <div>
                  <div className={styles.catName}>{cat.label}</div>
                  <div className={styles.catCount}>{cat.count}개 서비스</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED FREELANCERS ── */}
      <section className={styles.flSection}>
        <div className={styles.inner}>
          <div className={styles.sectionLabel}>주목받는 전문가</div>
          <h2>지금 활동 중인 Top 프리랜서</h2>
          <p className={styles.sectionSub}>검증된 실력, 빠른 응답</p>
          <div className={styles.flGrid}>
            {topFreelancers.map(fl => (
              <div key={fl.id} className={styles.flCard} onClick={() => setSelectedFreelancer(fl)}>
                <div className={styles.flAvWrap}>
                  <div className={styles.flAv} style={{ background: fl.avatarBg, color: fl.avatarColor }}>{fl.name[0]}</div>
                  {fl.online && <span className={styles.flDot} />}
                </div>
                <div className={styles.flName}>{fl.name}</div>
                <div className={styles.flRole}>{fl.role}</div>
                <div className={styles.flRating}>⭐ {fl.rating} · {fl.completedJobs}건</div>
                <div className={styles.flRate}>₩{fl.hourlyRate.toLocaleString()} / 시간</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY ── */}
      <section className={styles.whySection}>
        <div className={styles.inner}>
          <div className={styles.sectionLabel}>왜 크런치인가요</div>
          <h2>믿고 맡길 수 있는 이유</h2>
          <p className={styles.sectionSub}>안전하고 투명한 외주 거래</p>
          <div className={styles.whyGrid}>
            {WHY_ITEMS.map(item => (
              <div key={item.title} className={styles.whyCard}>
                <div className={styles.whyIcon}>{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section className={styles.reviewsSection}>
        <div className={styles.inner}>
          <div className={styles.sectionLabel}>고객 후기</div>
          <h2>실제 이용자들의 이야기</h2>
          <p className={styles.sectionSub}>142,000개의 성공 사례 중 일부</p>
          <div className={styles.reviewsGrid}>
            {REVIEWS.map(r => (
              <div key={r.name} className={styles.reviewCard}>
                <div className={styles.reviewStars}>{'★'.repeat(r.stars)}</div>
                <p className={styles.reviewText}>{r.text}</p>
                <div className={styles.reviewAuthor}>
                  <div className={styles.reviewAv} style={{ background: r.avatarBg, color: r.avatarColor }}>{r.name[0]}</div>
                  <div>
                    <div className={styles.reviewName}>{r.name}</div>
                    <div className={styles.reviewRole}>{r.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={styles.ctaSection}>
        <h2>지금 바로 시작해보세요</h2>
        <p>가입 후 5분이면 첫 프로젝트를 올릴 수 있어요</p>
        <div className={styles.ctaBtns}>
          <button className={styles.ctaBtnPrimary} onClick={onSignup}>무료로 시작하기</button>
          <button className={styles.ctaBtnGhost} onClick={() => onNavigate('services')}>서비스 둘러보기</button>
        </div>
      </section>

    </div>
  )
}
