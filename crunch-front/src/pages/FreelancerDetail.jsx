import { useApp } from '../context/useApp'
import styles from './FreelancerDetail.module.css'

const BADGE_STYLE = { Top: styles.badgeTop, Pro: styles.badgePro, New: styles.badgeNew }

export default function FreelancerDetail() {
  const { selectedFreelancer: f, setSelectedFreelancer } = useApp()
  if (!f) return null

  // API 응답({ skill: "React" })과 mock 데이터("React") 둘 다 대응
  const skillNames = (f.skills ?? []).map(sk => sk.skill ?? sk)

  // API 응답은 user.name, mock 데이터는 name 직접
  const name = f.user?.name ?? f.name ?? '?'
  const avatarBg = f.avatarBg ?? '#FFF0E8'
  const avatarColor = f.avatarColor ?? '#C04A1A'

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <button className={styles.back} onClick={() => setSelectedFreelancer(null)}>← 목록으로</button>

        <div className={styles.layout}>
          {/* LEFT */}
          <div className={styles.main}>
            <div className={styles.profileCard}>
              <div className={styles.avatarWrap}>
                <div className={styles.avatar} style={{ background: avatarBg, color: avatarColor }}>
                  {name[0]}
                </div>
                {f.online && <span className={styles.onlineDot} />}
              </div>
              <div className={styles.profileInfo}>
                <div className={styles.nameRow}>
                  <h1>{name}</h1>
                  <span className={`${styles.badge} ${BADGE_STYLE[f.badge]}`}>{f.badge}</span>
                </div>
                <div className={styles.role}>{f.role}</div>
                <div className={styles.meta}>
                  <span>⭐ {Number(f.rating).toFixed(1)}</span>
                  <span>완료 {f.completedJobs}건</span>
                  <span>경력 {f.experience}</span>
                  {f.online && <span className={styles.onlineLabel}>🟢 지금 가능</span>}
                </div>
                <div className={styles.skills}>
                  {skillNames.map(sk => (
                    <span key={sk} className={styles.skill}>{sk}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h3>자기소개</h3>
              {f.bio
                ? <p>{f.bio}</p>
                : <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>자기소개를 아직 작성하지 않았습니다.</p>
              }
            </div>

            <div className={styles.card}>
              <h3>주요 경력</h3>
              {f.experience
                ? (
                  <div className={styles.careerItem}>
                    <div className={styles.careerDot} />
                    <div>
                      <div className={styles.careerTitle}>{f.role}</div>
                      <div className={styles.careerPeriod}>경력 {f.experience}</div>
                    </div>
                  </div>
                )
                : <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>경력 정보를 아직 입력하지 않았습니다.</p>
              }
            </div>
          </div>

          {/* RIGHT */}
          <div className={styles.sidebar}>
            <div className={styles.priceCard}>
              <div className={styles.priceTop}>
                <span className={styles.priceLabel}>시간당 단가</span>
                <span className={styles.price}>{Number(f.hourlyRate).toLocaleString()}원</span>
              </div>
              <button className={styles.btnContact}>프로젝트 제안하기</button>
              <button className={styles.btnMsg}>메시지 보내기</button>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoRow}><span>평점</span><strong>⭐ {Number(f.rating).toFixed(1)}</strong></div>
              <div className={styles.infoRow}><span>완료 건수</span><strong>{f.completedJobs}건</strong></div>
              <div className={styles.infoRow}><span>경력</span><strong>{f.experience}</strong></div>
              <div className={styles.infoRow}><span>분야</span><strong>{f.category}</strong></div>
              <div className={styles.infoRow}><span>상태</span><strong>{f.online ? '🟢 가능' : '⚫ 바쁨'}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}