import { useCallback, useEffect, useState } from 'react'

export function navigate(path: string, options: { replace?: boolean } = {}) {
  if (options.replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo(0, 0)
}

export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onChange = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])

  const go = useCallback((to: string, options?: { replace?: boolean }) => navigate(to, options), [])
  return { path, navigate: go }
}
