import ChatPanel from '../components/ChatPanel'
import styles from './ChatPage.module.css'

export default function ChatPage({ onStartCall, activeCallChannelId }) {
  return (
    <div className={styles.page}>
      <ChatPanel onStartCall={onStartCall} activeCallChannelId={activeCallChannelId} />
    </div>
  )
}
