import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/league-gothic/400.css'
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/400-italic.css'
import '@fontsource/newsreader/500.css'
import '@fontsource/newsreader/600.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/componentes.css'
import './styles/telas.css'
import './styles/treinador.css'
import { App } from './App'
import { registrarPwa } from './pwa'

registrarPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
