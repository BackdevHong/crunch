import { useEffect, useState } from 'react'
import { useApp } from '../context/useApp'
import api from '../lib/api'
import { cleanDisplayText } from '../lib/displayText'
import styles from './FreelancerDetail.module.css'

const BADGE_STYLE = { Top: styles.badgeTop, Pro: styles.badgePro, New: styles.badgeNew }

export default function FreelancerDetail({ onNavigate }) {
  const { selectedFreelancer: f, setSelectedFreelancer, currentUser } = useApp()
  const [myProjects, setMyProjects] = useState([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteProjectId, setInviteProjectId] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [toast, setToast] = useState('')

  const canInvite = currentUser?.role === 'client' || currentUser?.role === 'admin'

  useEffect(() => {
    if (!canInvite) {
      setMyProjects([])
      return
    }

    api.get('/api/projects/me')
      .then(({ data }) => setMyProjects(data.data ?? []))
      .catch(() => setMyProjects([]))
  }, [canInvite])

  if (!f) return null

  const skillNames = (f.skills ?? []).map(sk => sk.skill ?? sk)
  const name = f.user?.name ?? f.name ?? '프리랜서'
  const avatarUrl = f.user?.avatarUrl ?? f.avatarUrl
  const avatarBg = f.avatarBg ?? '#FFF0E8'
  const avatarColor = f.avatarColor ?? '#C04A1A'

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(''), 3000)
  }

  const openInviteModal = () => {
    setInviteProjectId(myProjects[0]?.id ?? '')
    setInviteMessage('')
    setInviteOpen(true)
  }

  const submitInvite = async () => {
    if (!inviteProjectId) {
      showToast('제안할 프로젝트를 선택해주세요.')
      return
    }

    setInviteLoading(true)
    try {
      await api.post(`/api/projects/${inviteProjectId}/invitations`, {
        freelancerId: f.id,
        message: inviteMessage.trim() || undefined,
      })
      showToast('프로젝트 제안을 보냈습니다.')
      setInviteOpen(false)
    } catch (err) {
      showToast(err.response?.data?.message ?? '프로젝트 제안을 보내지 못했습니다.')
    } finally {
      setInviteLoading(false)
    }
  }

  const openDirectMessage = async () => {
    const targetUserId = f.user?.id
    if (!currentUser) {
      showToast('로그인이 필요합니다.')
      return
    }
    if (!targetUserId) {
      showToast('메시지를 보낼 사용자를 찾을 수 없습니다.')
      return
    }

    setInviteLoading(true)
    try {
      const { data } = await api.post('/api/channels/direct', { userId: targetUserId })
      window.sessionStorage.setItem('crunch-open-channel-id', data.data.id)
      setSelectedFreelancer(null)
      onNavigate?.('chat')
    } catch (err) {
      showToast(err.response?.data?.message ?? '채팅방을 열지 못했습니다.')
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <button className={styles.back} onClick={() => setSelectedFreelancer(null)}>목록으로</button>

        <div className={styles.layout}>
          <div className={styles.main}>
            <div className={styles.profileCard}>
              <div className={styles.avatarWrap}>
                <div className={styles.avatar} style={{ background: avatarUrl ? undefined : avatarBg, color: avatarColor }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className={styles.avatarImg} referrerPolicy="no-referrer" />
                  ) : (
                    name[0]
                  )}
                </div>
                {f.online && <span className={styles.onlineDot} />}
              </div>
              <div className={styles.profileInfo}>
                <div className={styles.nameRow}>
                  <h1>{name}</h1>
                  {f.badge && <span className={`${styles.badge} ${BADGE_STYLE[f.badge] ?? ''}`}>{f.badge}</span>}
                </div>
                <div className={styles.role}>{f.role}</div>
                <div className={styles.meta}>
                  <span>평점 {Number(f.rating ?? 0).toFixed(1)}</span>
                  <span>완료 {f.completedJobs ?? 0}건</span>
                  <span>경력 {f.experience ?? '-'}</span>
                  {f.online && <span className={styles.onlineLabel}>지금 가능</span>}
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
                : <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>아직 자기소개가 없습니다.</p>
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
                : <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>경력 정보가 없습니다.</p>
              }
            </div>
          </div>

          <div className={styles.sidebar}>
            <div className={styles.priceCard}>
              {canInvite && (
                <button className={styles.btnContact} onClick={openInviteModal}>프로젝트 제안하기</button>
              )}
              <button className={styles.btnMsg} onClick={openDirectMessage} disabled={inviteLoading}>메시지 보내기</button>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoRow}><span>평점</span><strong>{Number(f.rating ?? 0).toFixed(1)}</strong></div>
              <div className={styles.infoRow}><span>완료 건수</span><strong>{f.completedJobs ?? 0}건</strong></div>
              <div className={styles.infoRow}><span>경력</span><strong>{f.experience ?? '-'}</strong></div>
              <div className={styles.infoRow}><span>분야</span><strong>{f.category ?? '-'}</strong></div>
              <div className={styles.infoRow}><span>상태</span><strong>{f.online ? '가능' : '오프라인'}</strong></div>
            </div>
          </div>
        </div>
      </div>

      {inviteOpen && (
        <div className={styles.overlay} onClick={() => setInviteOpen(false)}>
          <div className={styles.inviteModal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>프로젝트 제안</h2>
              <button onClick={() => setInviteOpen(false)}>×</button>
            </div>
            <p className={styles.modalLead}>
              {name}님에게 제안할 프로젝트를 선택해주세요.
            </p>
            {myProjects.length === 0 ? (
              <div className={styles.empty}>제안할 수 있는 내 프로젝트가 없습니다.</div>
            ) : (
              <>
                <label className={styles.modalLabel}>프로젝트</label>
                <select value={inviteProjectId} onChange={e => setInviteProjectId(e.target.value)}>
                  {myProjects.map(project => (
                    <option key={project.id} value={project.id}>{cleanDisplayText(project.title, '제목 없음')}</option>
                  ))}
                </select>
                <label className={styles.modalLabel}>메시지</label>
                <textarea
                  value={inviteMessage}
                  onChange={e => setInviteMessage(e.target.value)}
                  placeholder="함께 작업하고 싶은 이유나 요청사항을 남겨주세요."
                />
                <div className={styles.modalActions}>
                  <button onClick={() => setInviteOpen(false)} disabled={inviteLoading}>취소</button>
                  <button onClick={submitInvite} disabled={inviteLoading}>
                    {inviteLoading ? '전송 중...' : '제안 보내기'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
