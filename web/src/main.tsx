import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/bebas-neue/latin-400.css'
import '@fontsource-variable/inter/wght.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/componentes.css'
import './styles/telas.css'
import './styles/treinador.css'
import './styles/camadas.css'
import './styles/polimento.css'
import './styles/simplificacao.css'
import { App } from './App'
import { ativarBarraDiscreta } from './lib/barraRolagem'
import { iniciarTema } from './lib/tema'
import { registrarPwa } from './pwa'

iniciarTema()
registrarPwa()
ativarBarraDiscreta()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
