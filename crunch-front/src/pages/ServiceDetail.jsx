import { useApp } from '../context/AppContext'
import styles from './ServiceDetail.module.css'

export default function ServiceDetail() {
  const { selectedService: s, setSelectedService } = useApp()
  if (!s) return null

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <button className={styles.back} onClick={() => setSelectedService(null)}>← 목록으로</button>

        <div className={styles.layout}>
          {/* LEFT */}
          <div className={styles.main}>
            <div className={styles.thumb} style={{ background: s.thumbBg }}>
              <span className={styles.thumbEmoji}>{s.emoji}</span>
              {s.badge && <span className={styles.badge}>{s.badge}</span>}
            </div>

            <div className={styles.card}>
              <div className={styles.seller}>
                <div className={styles.avatar} style={{ background: s.avatarBg, color: s.avatarColor }}>{s.sellerName[0]}</div>
                <div>
                  <div className={styles.sellerName}>{s.sellerName}</div>
                  <div className={styles.sellerSub}>⭐ {s.rating} · 리뷰 {s.reviewCount}개</div>
                </div>
              </div>
              <h1 className={styles.title}>{s.title}</h1>
              <div className={styles.tags}>
                {s.skills.map(sk => <span key={sk} className={styles.skill}>{sk}</span>)}
                <span className={styles.category}>{s.category}</span>
              </div>
            </div>

            <div className={styles.card}>
              <h3>서비스 소개</h3>
              <p>안녕하세요! 저는 {s.sellerName}입니다. {s.title} 서비스를 제공합니다.</p>
              <p>고객의 요구사항을 꼼꼼히 파악하여 최상의 결과물을 만들어 드립니다. 언제든지 문의 주세요!</p>
            </div>

            <div className={styles.card}>
              <h3>작업 방식</h3>
              <div className={styles.processSteps}>
                {['요구사항 파악', '기획 · 설계', '개발 · 제작', '검수 · 납품'].map((step, i) => (
                  <div key={step} className={styles.processStep}>
                    <div className={styles.stepNum}>{i + 1}</div>
                    <div className={styles.stepLabel}>{step}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className={styles.sidebar}>
            <div className={styles.priceCard}>
              <div className={styles.priceTop}>
                <span className={styles.priceLabel}>시작 가격</span>
                <span className={styles.price}>{s.price.toLocaleString()}원</span>
              </div>
              <div className={styles.deliveryInfo}>
                <span>⏱ 납기일 {s.deliveryDays}일</span>
                <span>🔄 무제한 수정</span>
              </div>
              <button className={styles.btnOrder}>주문하기</button>
              <button className={styles.btnContact}>문의하기</button>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoRow}><span>평점</span><strong>⭐ {s.rating}</strong></div>
              <div className={styles.infoRow}><span>리뷰</span><strong>{s.reviewCount}개</strong></div>
              <div className={styles.infoRow}><span>납기일</span><strong>{s.deliveryDays}일</strong></div>
              <div className={styles.infoRow}><span>카테고리</span><strong>{s.category}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
