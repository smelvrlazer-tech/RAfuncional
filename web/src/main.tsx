import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource-variable/public-sans/wght.css'
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
