import styles from './FreelancerCard.module.css'

const BADGE_STYLE = { Top: styles.badgeTop, Pro: styles.badgePro, New: styles.badgeNew }

export default function FreelancerCard({ freelancer, onClick, onInvite, canInvite = false }) {
  const { name, role, avatarUrl, avatarBg, avatarColor, badge, rating, completedJobs, skills, online } = freelancer

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.top}>
        <div className={styles.avatarWrap}>
          <div className={styles.avatar} style={{ background: avatarUrl ? undefined : avatarBg, color: avatarColor }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className={styles.avatarImg} referrerPolicy="no-referrer" />
            ) : (
              name[0]
            )}
          </div>
          {online && <span className={styles.onlineDot} />}
        </div>
        <div className={styles.info}>
          <div className={styles.name}>{name}</div>
          <div className={styles.role}>{role}</div>
          <div className={styles.rating}><span className={styles.star}>★</span>{rating} · 완료 {completedJobs}건</div>
        </div>
        <span className={`${styles.badge} ${BADGE_STYLE[badge]}`}>{badge}</span>
      </div>

      <div className={styles.tags}>
        {(skills ?? []).map(sk => (
          <span key={sk.skill ?? sk} className={styles.tag}>
            {sk.skill ?? sk}
          </span>
        ))}
      </div>

      <div className={styles.footer}>
        <button className={styles.btn} onClick={e => { e.stopPropagation(); onClick?.() }}>
          프로필 보기
        </button>
        {canInvite && (
          <button className={styles.primaryBtn} onClick={e => { e.stopPropagation(); onInvite?.() }}>
            프로젝트 제안
          </button>
        )}
      </div>
    </div>
  )
}
