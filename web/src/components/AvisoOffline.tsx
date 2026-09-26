import { useEffect, useState } from 'react'
import { Icone } from './Icone'

/** Faixa fixa quando o aparelho perde a conexão. O app shell abre offline; os dados, não. */
export function AvisoOffline() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return (
    <div className="offline" role="status" aria-live="polite" hidden={!offline}>
      {offline && (
        <>
          <Icone nome="semRede" tamanho={18} />
          <span>Você está sem internet. A agenda e o check-in voltam a funcionar quando a conexão voltar.</span>
        </>
      )}
    </div>
  )
}
