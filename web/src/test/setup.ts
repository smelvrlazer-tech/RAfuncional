// Fuso do "aparelho" propositalmente diferente de São Paulo: prova que a
// apresentação nunca depende do fuso do dispositivo.
process.env.TZ = 'Asia/Tokyo'

import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())
