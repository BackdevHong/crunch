import { useState } from 'react'
import { useApp } from '../context/useApp'
import api from '../lib/api'
import styles from './ServiceDetail.module.css'

export default function ServiceDetail() {
  const { selectedService: s, setSelectedService, currentUser } = useApp()
  const [ordering, setOrdering] = useState(false)
  const [requirements, setRequirements] = useState('')
  const [showRequirements, setShowRequirements] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)

  if (!s) return null

  const handleOrder = async () => {
    if (!currentUser) {
      alert('로그인이 필요합니다.')
      return
    }
    if (!showRequirements) {
      setShowRequirements(true)
      return
    }
    setOrdering(true)
    try {
      await api.post('/api/orders', {
        serviceId: s.id,
        requirements,
      })
      setOrderSuccess(true)
    } catch (err) {
      alert(err.response?.data?.message ?? '주문 중 오류가 발생했습니다.')
    } finally {
      setOrdering(false)
    }
  }

  if (orderSuccess) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.successBox}>
            <div className={styles.successIcon}>🎉</div>
            <h2>주문이 완료되었습니다!</h2>
            <p>판매자가 확인 후 작업을 시작합니다.</p>
            <button className={styles.btnOrder} onClick={() => setSelectedService(null)}>
              목록으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <button className={styles.back} onClick={() => setSelectedService(null)}>← 목록으로</button>

        <div className={styles.layout}>
          <div className={styles.main}>
            <div className={styles.thumb} style={{ background: s.thumbBg ?? '#FFF8F5' }}>
              <span className={styles.thumbEmoji}>{s.emoji ?? '🌐'}</span>
              {s.badge && <span className={styles.badge}>{s.badge}</span>}
            </div>

            <div className={styles.card}>
              <div className={styles.seller}>
                <div className={styles.avatar} style={{ background: s.avatarBg, color: s.avatarColor }}>
                  {s.seller ? s.seller.name[0] : s.sellerName?.[0]}
                </div>
                <div>
                  <div className={styles.sellerName}>{s.seller?.name ?? s.sellerName}</div>
                  <div className={styles.sellerSub}>⭐ {Number(s.rating).toFixed(1)} · 리뷰 {s.reviewCount}개</div>
                </div>
              </div>
              <h1 className={styles.title}>{s.title}</h1>
              <div className={styles.tags}>
                {(s.skills ?? []).map(sk => (
                  <span key={sk.skill ?? sk} className={styles.skill}>{sk.skill ?? sk}</span>
                ))}
                <span className={styles.category}>{s.category}</span>
              </div>
            </div>

            <div className={styles.card}>
              <h3>서비스 소개</h3>
              <p>{s.description ?? `안녕하세요! ${s.seller?.name ?? s.sellerName} 입니다. ${s.title} 서비스를 제공합니다.`}</p>
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

          <div className={styles.sidebar}>
            <div className={styles.priceCard}>
              <div className={styles.priceTop}>
                <span className={styles.priceLabel}>시작 가격</span>
                <span className={styles.price}>{Number(s.price).toLocaleString()}원</span>
              </div>
              <div className={styles.deliveryInfo}>
                <span>⏱ 납기일 {s.deliveryDays}일</span>
                <span>🔄 무제한 수정</span>
              </div>

              {showRequirements && (
                <textarea
                  className={styles.requirementsInput}
                  placeholder="요구사항을 입력해주세요. (선택)"
                  value={requirements}
                  onChange={e => setRequirements(e.target.value)}
                />
              )}

              <button className={styles.btnOrder} onClick={handleOrder} disabled={ordering}>
                {ordering ? '주문 중...' : showRequirements ? '주문 확정하기' : '주문하기'}
              </button>
              <button className={styles.btnContact}>문의하기</button>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoRow}><span>평점</span><strong>⭐ {Number(s.rating).toFixed(1)}</strong></div>
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