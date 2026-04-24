// src/context/useApp.js (새 파일)
import { useContext } from 'react'
import { AppContext } from './AppContext'

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}