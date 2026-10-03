/** Ícones de traço simples (inline SVG, sem dependência). Sempre acompanhados de texto. */
const CAMINHOS = {
  check: 'M4 12.5l5 5L20 6.5',
  fila: 'M4 7h16M4 12h10M4 17h6M18 14v6M15 17h6',
  cadeado: 'M7 11V8a5 5 0 0110 0v3M5.5 11h13v9h-13z',
  x: 'M6 6l12 12M18 6L6 18',
  lotada: 'M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 18.4L18.4 5.6',
  sino: 'M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 20.5a2 2 0 004 0',
  play: 'M8 5.5v13l11-6.5z',
  voltar: 'M15 5l-7 7 7 7',
  seta: 'M9 5l7 7-7 7',
  sair: 'M14 5h4a1 1 0 011 1v12a1 1 0 01-1 1h-4M10 16l-4-4 4-4M6 12h10',
  instalar: 'M12 4v11M7 10.5l5 5 5-5M5 19h14',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5v.5',
  semRede: 'M3 3l18 18M8.5 16.5a5 5 0 017 0M5 13a10 10 0 015.2-2.8M14.5 10.4A10 10 0 0119 13M2 9.5a14 14 0 014.3-2.7M11 5.1A14 14 0 0122 9.5M12 20h.01',
  relogio: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3.5 2',
  compartilhar: 'M12 3v12M7.5 7.5L12 3l4.5 4.5M6 11H5v10h14V11h-1',
  grade: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  calendario: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
  prancheta: 'M9 3.5h6v3H9zM7 5H5v15.5h14V5h-2M8.5 11.5h7M8.5 15.5h5',
  pessoas: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.3a3.5 3.5 0 010 6.4M18 14.2a6.5 6.5 0 013.5 5.8',
  mais: 'M12 5v14M5 12h14',
  lapis: 'M4 20l4.5-1 10-10a2.1 2.1 0 00-3-3l-10 10zM13.5 7.5l3 3',
  copiar: 'M9 9h11v11H9zM5 15H4V4h11v1',
  mensagem: 'M4 5h16v11H9l-5 4z',
  email: 'M4 6h16v12H4zM4.6 6.8l7.4 6 7.4-6',
  telefone: 'M8 3h8v18H8zM11 18h2',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
  pessoa:'M12 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5 20a7 7 0 0114 0',
} as const

export type NomeIcone = keyof typeof CAMINHOS

export function Icone({ nome, tamanho = 18, className }: { nome: NomeIcone; tamanho?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill={nome === 'play' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={nome === 'play' ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  )
}
