import { useState, useEffect, useRef } from 'react'

// ── LOCAL date string helpers (IST aware) ─────────────────────────────────────
// toISOString() always returns UTC, which at midnight IST (00:00) is still
// 18:30 of the PREVIOUS day in UTC — so it would return the wrong date.
// These helpers use the browser's local time instead, which for Indian users
// is IST (UTC+5:30), giving the correct date from IST midnight onward.
const getTodayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getMonthStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Milliseconds until the next LOCAL midnight (IST midnight for Indian users)
const getMsUntilMidnight = () => {
  const midnight = new Date()
  midnight.setHours(24, 0, 0, 0)   // setHours uses LOCAL time — correct
  return midnight.getTime() - Date.now()
}

// useTodayDate(onNewDay, showToast)
//
// Returns today's date as "YYYY-MM-DD" (local time, IST-correct), and
// fires a timeout that re-calculates at exactly local midnight.
// Re-schedules itself each time, so it works across multiple midnights
// without the tab ever being reloaded.
const useTodayDate = (onNewDay = null, showToast = false) => {
  const [today, setToday] = useState(getTodayStr)
  const callbackRef = useRef(onNewDay)
  callbackRef.current = onNewDay

  useEffect(() => {
    let timeoutId

    const scheduleNextMidnight = () => {
      timeoutId = setTimeout(() => {
        const newDate  = getTodayStr()
        const newMonth = getMonthStr()
        setToday(newDate)

        if (typeof callbackRef.current === 'function') {
          callbackRef.current(newDate, newMonth)
        }

        if (showToast) {
          import('react-hot-toast').then(({ default: toast }) => {
            toast(
              `🌅 Naya din shuru — ${new Date().toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}`,
              { duration: 6000, icon: '📅' }
            )
          })
        }

        scheduleNextMidnight()
      }, getMsUntilMidnight())
    }

    scheduleNextMidnight()
    return () => clearTimeout(timeoutId)
  }, [showToast])

  return today
}

export default useTodayDate