import { useEffect, useState } from 'react'
import { useApp } from '../context/useApp'
import api from '../lib/api'
import styles from './HomePage.module.css'

const HOW_STEPS = [
  { title: '프로젝트 등록', desc: '원하는 작업과 예산을 간단히 입력하세요. 5분이면 충분합니다.' },
  { title: '전문가 제안 수신', desc: '48시간 내 평균 5.2개의 맞춤 제안이 도착합니다. 포트폴리오를 비교해보세요.' },
  { title: '안전하게 완료', desc: '에스크로 결제로 작업 완료 후 대금이 지급됩니다. 검수까지 완벽하게.' },
]

const WHY_ITEMS = [
  { icon: '🔒', title: '안전한 에스크로 결제', desc: '작업 완료 후 자동 정산. 결과물이 마음에 들어야만 대금이 지급됩니다.' },
  { icon: '✅', title: '검증된 전문가', desc: '포트폴리오 심사와 실력 테스트를 통과한 전문가만 활동할 수 있습니다.' },
  { icon: '💬', title: '실시간 소통', desc: '내장 메신저로 언제든지 진행 상황을 확인하고 피드백을 주고받으세요.' },
  { icon: '⚡', title: '빠른 매칭', desc: '프로젝트 등록 후 평균 4시간 내 첫 번째 전문가 제안이 도착합니다.' },
  { icon: '🛡️', title: '분쟁 조정 지원', desc: '작업 결과에 이견이 있을 경우 크런치 팀이 중립적으로 조정해 드립니다.' },
  { icon: '📊', title: '투명한 이력 관리', desc: '모든 거래 이력과 리뷰가 기록되어 신뢰할 수 있는 평판을 만들어 드립니다.' },
]

const DEFAULT_CATEGORIES = [
  { icon: '💻', label: '개발·IT', count: 0, bg: '#FFF0E8' },
  { icon: '🎨', label: '디자인', count: 0, bg: '#EAF3DE' },
  { icon: '📱', label: '마케팅', count: 0, bg: '#E6F1FB' },
  { icon: '✍️', label: '글쓰기·번역', count: 0, bg: '#FAEEDA' },
  { icon: '🎬', label: '영상·사진', count: 0, bg: '#FBEAF0' },
  { icon: '🎵', label: '음악·오디오', count: 0, bg: '#E1F5EE' },
]

const formatCount = (value) => Number(value || 0).toLocaleString('ko-KR')
const formatRating = (value) => Number(value || 0).toFixed(1)
const getInitial = (name) => name?.[0] ?? '?'
const getAvatarTone = (index) => [
  { bg: '#FFF0E8', color: '#C04A1A' },
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#EAF3DE', color: '#3B6D11' },
  { bg: '#FAEEDA', color: '#854F0B' },
][index % 4]

export default function HomePage({ onNavigate, onSignup }) {
  const { setSelectedFreelancer } = useApp()
  const [homeData, setHomeData] = useState({
    stats: {
      freelancers: 0,
      activeFreelancers: 0,
      completedProjects: 0,
      averageRating: 0,
      onTimeRate: 0,
    },
    categories: DEFAULT_CATEGORIES,
    topFreelancers: [],
    reviews: [],
  })

  useEffect(() => {
    let mounted = true

    api.get('/api/home')
      .then(({ data }) => {
        if (mounted) setHomeData(prev => ({ ...prev, ...data.data }))
      })
      .catch(console.error)

    return () => { mounted = false }
  }, [])

  const stats = [
    { num: `${formatCount(homeData.stats.freelancers)}명`, label: '등록된 전문가' },
    { num: `${formatCount(homeData.stats.completedProjects)}건`, label: '완료된 프로젝트' },
    { num: `${formatRating(homeData.stats.averageRating)} / 5`, label: '평균 만족도' },
    { num: `${formatCount(homeData.stats.activeFreelancers)}명`, label: '실시간 활동 중' },
  ]
  const trustFreelancers = homeData.topFreelancers.slice(0, 4)

  return (
    <div className={styles.page}>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroEyebrow}>
          <span className={styles.eyebrowDot} />
          실시간 · {formatCount(homeData.stats.activeFreelancers)}명 활동 중
        </div>
        <h1>당신의 아이디어를<br /><em>현실로</em> 만들어 드립니다</h1>
        <p>국내 최고의 프리랜서들이 당신의 프로젝트를 기다립니다.<br />지금 바로 시작해보세요.</p>
        <div className={styles.heroBtns}>
          <button className={styles.btnPrimary} onClick={() => onNavigate('services')}>서비스 찾기</button>
          <button className={styles.btnGhost} onClick={() => onNavigate('freelancers')}>프리랜서 찾기</button>
        </div>
        <div className={styles.heroTrust}>
          <div className={styles.trustAvatars}>
            {trustFreelancers.map((freelancer, index) => {
              const tone = getAvatarTone(index)
              return (
                <div key={freelancer.id} className={styles.trustAv} style={{ background: tone.bg, color: tone.color }}>
                  {freelancer.avatarUrl ? (
                    <img src={freelancer.avatarUrl} alt="" className={styles.avatarImg} referrerPolicy="no-referrer" />
                  ) : (
                    getInitial(freelancer.name)
                  )}
                </div>
              )
            })}
            {trustFreelancers.length === 0 && (
              <div className={styles.trustAv} style={{ background: '#FFF0E8', color: '#C04A1A' }}>?</div>
            )}
          </div>
          <span>이미 <strong>{formatCount(homeData.stats.completedProjects)}건</strong>의 프로젝트가 완료되었습니다</span>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className={styles.statsBar}>
        {stats.map(s => (
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
          <p className={styles.sectionSub}>실제 등록된 서비스 기준으로 집계됩니다</p>
          <div className={styles.catsGrid}>
            {homeData.categories.map(cat => (
              <div key={cat.label} className={styles.catCard} onClick={() => onNavigate('services')}>
                <div className={styles.catIcon} style={{ background: cat.bg }}>{cat.icon}</div>
                <div>
                  <div className={styles.catName}>{cat.label}</div>
                  <div className={styles.catCount}>{formatCount(cat.count)}개 서비스</div>
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
            {homeData.topFreelancers.map((fl, index) => {
              const tone = getAvatarTone(index)
              return (
              <div key={fl.id} className={styles.flCard} onClick={() => setSelectedFreelancer(fl)}>
                <div className={styles.flAvWrap}>
                  <div className={styles.flAv} style={{ background: tone.bg, color: tone.color }}>
                    {fl.avatarUrl ? (
                      <img src={fl.avatarUrl} alt="" className={styles.avatarImg} referrerPolicy="no-referrer" />
                    ) : (
                      getInitial(fl.name)
                    )}
                  </div>
                  {fl.online && <span className={styles.flDot} />}
                </div>
                <div className={styles.flName}>{fl.name}</div>
                <div className={styles.flRole}>{fl.role}</div>
                <div className={styles.flRating}>⭐ {fl.rating} · {fl.completedJobs}건</div>
                <div className={styles.flRate}>₩{fl.hourlyRate.toLocaleString()} / 시간</div>
              </div>
              )
            })}
            {homeData.topFreelancers.length === 0 && (
              <div className={styles.emptyInline}>아직 등록된 프리랜서가 없습니다.</div>
            )}
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
          <p className={styles.sectionSub}>최근 작성된 실제 후기입니다</p>
          <div className={styles.reviewsGrid}>
            {homeData.reviews.map((r, index) => {
              const tone = getAvatarTone(index)
              return (
              <div key={r.name} className={styles.reviewCard}>
                <div className={styles.reviewStars}>{'★'.repeat(r.stars)}</div>
                <p className={styles.reviewText}>"{r.text}"</p>
                <div className={styles.reviewAuthor}>
                  <div className={styles.reviewAv} style={{ background: tone.bg, color: tone.color }}>
                    {r.avatarUrl ? (
                      <img src={r.avatarUrl} alt="" className={styles.avatarImg} referrerPolicy="no-referrer" />
                    ) : (
                      getInitial(r.name)
                    )}
                  </div>
                  <div>
                    <div className={styles.reviewName}>{r.name}</div>
                    <div className={styles.reviewRole}>{r.role}</div>
                  </div>
                </div>
              </div>
              )
            })}
            {homeData.reviews.length === 0 && (
              <div className={styles.emptyInline}>아직 작성된 후기가 없습니다.</div>
            )}
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
