import { useState } from 'react'

export function usePlatform() {
  const [isMac] = useState(() => navigator.userAgent.toLowerCase().includes('mac'))

  return { isMac }
}
