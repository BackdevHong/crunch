import styles from './ServiceCard.module.css'

export default function ServiceCard({ card, onClick }) {
  const {
    emoji, thumbBg, badge,
    avatarBg, avatarColor,
    sellerName, seller,
    title, rating, reviewCount, price,
  } = card

  const displayName = seller?.name ?? sellerName ?? '?'

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.thumb} style={{ background: thumbBg ?? '#FFF8F5' }}>
        {badge && <span className={styles.badge}>{badge}</span>}
        <span className={styles.emoji}>{emoji ?? '🌐'}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.seller}>
          <div className={styles.avatar} style={{ background: avatarBg ?? '#FFF0E8', color: avatarColor ?? '#C04A1A' }}>
            {displayName[0]}
          </div>
          <span className={styles.sellerName}>{displayName}</span>
        </div>
        <div className={styles.title}>{title}</div>
        <div className={styles.footer}>
          <div className={styles.rating}>
            <span className={styles.star}>★</span>
            {Number(rating).toFixed(1)} ({reviewCount})
          </div>
          <div className={styles.price}>
            <span className={styles.priceLabel}>부터 </span>
            {Number(price).toLocaleString()}원
          </div>
        </div>
      </div>
    </div>
  )
}