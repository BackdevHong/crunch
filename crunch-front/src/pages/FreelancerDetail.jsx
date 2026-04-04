import { useApp } from '../context/AppContext'
import styles from './FreelancerDetail.module.css'

const BADGE_STYLE = { Top: styles.badgeTop, Pro: styles.badgePro, New: styles.badgeNew }

export default function FreelancerDetail() {
  const { selectedFreelancer: f, setSelectedFreelancer } = useApp()
  if (!f) return null

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <button className={styles.back} onClick={() => setSelectedFreelancer(null)}>← 목록으로</button>

        <div className={styles.layout}>
          {/* LEFT */}
          <div className={styles.main}>
            <div className={styles.profileCard}>
              <div className={styles.avatarWrap}>
                <div className={styles.avatar} style={{ background: f.avatarBg, color: f.avatarColor }}>{f.name[0]}</div>
                {f.online && <span className={styles.onlineDot} />}
              </div>
              <div className={styles.profileInfo}>
                <div className={styles.nameRow}>
                  <h1>{f.name}</h1>
                  <span className={`${styles.badge} ${BADGE_STYLE[f.badge]}`}>{f.badge}</span>
                </div>
                <div className={styles.role}>{f.role}</div>
                <div className={styles.meta}>
                  <span>⭐ {f.rating}</span>
                  <span>완료 {f.completedJobs}건</span>
                  <span>경력 {f.experience}</span>
                  {f.online && <span className={styles.onlineLabel}>🟢 지금 가능</span>}
                </div>
                <div className={styles.skills}>
                  {f.skills.map(sk => <span key={sk} className={styles.skill}>{sk}</span>)}
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h3>자기소개</h3>
              <p>안녕하세요! {f.role}로 활동 중인 {f.name}입니다.</p>
              <p>{f.skills.join(', ')} 등의 기술을 활용하여 고품질의 결과물을 제공합니다. 총 {f.completedJobs}건의 프로젝트를 성공적으로 완료했습니다.</p>
              <p>언제든지 편하게 문의 주세요. 빠른 시일 내에 답변드리겠습니다!</p>
            </div>

            <div className={styles.card}>
              <h3>주요 경력</h3>
              <div className={styles.careerItem}>
                <div className={styles.careerDot} />
                <div>
                  <div className={styles.careerTitle}>시니어 {f.role}</div>
                  <div className={styles.careerPeriod}>2021 ~ 현재 · 프리랜서</div>
                </div>
              </div>
              <div className={styles.careerItem}>
                <div className={styles.careerDot} />
                <div>
                  <div className={styles.careerTitle}>{f.role}</div>
                  <div className={styles.careerPeriod}>2018 ~ 2021 · IT 스타트업</div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className={styles.sidebar}>
            <div className={styles.priceCard}>
              <div className={styles.priceTop}>
                <span className={styles.priceLabel}>시간당 단가</span>
                <span className={styles.price}>{f.hourlyRate.toLocaleString()}원</span>
              </div>
              <button className={styles.btnContact}>프로젝트 제안하기</button>
              <button className={styles.btnMsg}>메시지 보내기</button>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoRow}><span>평점</span><strong>⭐ {f.rating}</strong></div>
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
