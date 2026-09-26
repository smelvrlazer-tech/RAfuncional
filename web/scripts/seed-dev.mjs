// Seed do projeto Supabase de DESENVOLVIMENTO (idempotente).
//
//   npm run seed:dev        (dentro de web/)
//
// Usa a service role key do .env.test da RAIZ do repositório. Essa chave nunca
// entra em web/src nem no bundle: este script roda só no Node, na sua máquina.
// Recusa rodar fora do projeto DEV. Senhas vão SOMENTE para web/.dev-credenciais.txt
// (gitignored); o console mostra apenas e-mails e o código de convite.
//
// Atenção: os testes do backend (npm test na raiz) apagam turmas, sessões, check-ins,
// treinos, convites e notificações do projeto DEV. Depois deles, rode o seed de novo.
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJETO_DEV = 'mixrbjskhftungppggow'
const FUSO = 'America/Sao_Paulo'
const aqui = dirname(fileURLToPath(import.meta.url))
const ARQ_ENV = join(aqui, '..', '..', '.env.test')
const ARQ_CRED = join(aqui, '..', '.dev-credenciais.txt')

// ------------------------------------------------------------------ ambiente
function lerEnv(arquivo) {
  if (!existsSync(arquivo)) throw new Error(`Arquivo não encontrado: ${arquivo}`)
  const env = {}
  for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

const env = lerEnv(ARQ_ENV)
const URL = env.SUPABASE_URL ?? ''
if (!URL.includes(PROJETO_DEV)) {
  console.error(`Recusado: SUPABASE_URL não é o projeto DEV (${PROJETO_DEV}).`)
  process.exit(1)
}
if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_ANON_KEY) {
  console.error('Recusado: .env.test sem SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY.')
  process.exit(1)
}

const opcoesCliente = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, opcoesCliente)

function checar(resultado, contexto) {
  if (resultado.error) throw new Error(`${contexto}: ${resultado.error.message}`)
  return resultado.data
}

// ------------------------------------------------------------------ datas (SP)
function chaveDiaSP(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
function somarDias(chave, n) {
  const [a, m, d] = chave.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10)
}
function diaSemana(chave) {
  const [a, m, d] = chave.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

// ------------------------------------------------------------------ credenciais
function lerCredenciais() {
  const mapa = {}
  if (!existsSync(ARQ_CRED)) return mapa
  for (const linha of readFileSync(ARQ_CRED, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^(\S+@\S+)\s+senha:\s+(\S+)/)
    if (m) mapa[m[1]] = m[2]
  }
  return mapa
}
const senhaAleatoria = () => randomBytes(12).toString('base64url')

const USUARIOS = [
  { chave: 'treinador', email: 'rafael.dev@ra-funcional.local', nome: 'Rafael (DEV)', papel: 'treinador', telefone: null },
  { chave: 'aluna', email: 'ana.dev@ra-funcional.local', nome: 'Ana Souza', papel: 'aluno', telefone: '(11) 98888-1111' },
  { chave: 'aluno', email: 'bruno.dev@ra-funcional.local', nome: 'Bruno Lima', papel: 'aluno', telefone: null },
]

async function buscarUsuarioPorEmail(email) {
  for (let page = 1; page < 50; page++) {
    const { users } = checar(await admin.auth.admin.listUsers({ page, perPage: 200 }), 'listUsers')
    const achado = users.find((u) => u.email?.toLowerCase() === email)
    if (achado) return achado
    if (users.length < 200) return null
  }
  return null
}

async function garantirUsuario(u, senhasAntigas) {
  let usuario = await buscarUsuarioPorEmail(u.email)
  let senha = senhasAntigas[u.email]
  if (!usuario) {
    senha = senhaAleatoria()
    usuario = checar(await admin.auth.admin.createUser({ email: u.email, password: senha, email_confirm: true }), 'createUser').user
  } else if (!senha) {
    // Existe no Auth mas a senha se perdeu: gera outra.
    senha = senhaAleatoria()
    checar(await admin.auth.admin.updateUserById(usuario.id, { password: senha, email_confirm: true }), 'updateUser')
  }
  checar(await admin.from('perfis').upsert(
    { id: usuario.id, nome: u.nome, telefone: u.telefone, papel: u.papel, ativo: true },
    { onConflict: 'id' },
  ), 'perfis')
  return { ...u, id: usuario.id, senha }
}

async function loginComo(u) {
  const c = createClient(URL, env.SUPABASE_ANON_KEY, opcoesCliente)
  checar(await c.auth.signInWithPassword({ email: u.email, password: u.senha }), `login ${u.email}`)
  return c
}

// ------------------------------------------------------------------ turmas
const TURMAS = [
  { nome: 'Funcional Manhã', hora_inicio: '06:00:00', duracao_min: 60, vagas: 12 },
  { nome: 'Funcional Cedo', hora_inicio: '07:00:00', duracao_min: 60, vagas: 8 },
  { nome: 'Funcional Noite', hora_inicio: '18:30:00', duracao_min: 50, vagas: 10 },
]

async function garantirTurmas() {
  const existentes = checar(await admin.from('turmas').select('id, nome, dia_semana, hora_inicio'), 'turmas')
  const novas = []
  for (const t of TURMAS) {
    for (let dia = 1; dia <= 5; dia++) {
      const ja = existentes.some((e) => e.nome === t.nome && e.dia_semana === dia && e.hora_inicio === t.hora_inicio)
      if (!ja) novas.push({ ...t, dia_semana: dia, ativa: true })
    }
  }
  if (novas.length) checar(await admin.from('turmas').insert(novas), 'insert turmas')
  return novas.length
}

// ------------------------------------------------------------------ treinos
const MODELOS = [
  {
    titulo: 'Circuito de força total',
    descricao: 'Aquecimento: 8 min de mobilidade articular e polichinelos.\n\nBloco principal (4 voltas, 40s de trabalho / 20s de pausa): agachamento com kettlebell, remada no TRX, avanço alternado, prancha com toque no ombro.\n\nFinalizador: 3 min de burpees no seu ritmo.',
  },
  {
    titulo: 'Potência e core',
    descricao: 'Aquecimento dinâmico com corda.\n\nEMOM 20 min: minuto 1 — 10 swings; minuto 2 — 12 abdominais canivete; minuto 3 — 8 saltos na caixa; minuto 4 — 30s de prancha lateral.\n\nAlongamento guiado no final.',
  },
  {
    titulo: 'Resistência em duplas',
    descricao: 'Treino em duplas: enquanto um executa, o outro descansa.\n\n5 estações de 3 min: remo, farmer walk, wall ball, sled push e escalador.\n\nFechamos com respiração e mobilidade de quadril.',
  },
]
const VIDEO = 'https://www.youtube.com/watch?v=ml6cT4AZdqI'

async function garantirTreinos(hoje) {
  const { inicio } = (() => {
    const dow = diaSemana(hoje)
    return { inicio: somarDias(hoje, 7 - ((dow + 6) % 7)) }
  })()
  // Publicados: hoje + 5 dias, e seg–qua da semana seguinte (aciona o banner do "spoiler").
  const publicados = new Set([0, 1, 2, 3, 4, 5].map((n) => somarDias(hoje, n)))
  for (const n of [0, 1, 2]) publicados.add(somarDias(inicio, n))
  // Rascunho (aluno vê "Em breve"): quinta da semana seguinte.
  const rascunho = somarDias(inicio, 3)

  const linhas = [...publicados].sort().map((data, i) => ({
    data,
    ...MODELOS[i % MODELOS.length],
    video_url: i % 3 === 2 ? null : VIDEO,
    publicado_em: new Date().toISOString(),
  }))
  linhas.push({ data: rascunho, titulo: 'Rascunho do treinador', descricao: 'Ainda não publicado.', video_url: null, publicado_em: null })
  // upsert por data. Não sobrescreve publicado_em de quem já está publicado com outro valor
  // (não importa em DEV); mantém o seed idempotente.
  checar(await admin.from('treinos').upsert(linhas, { onConflict: 'data' }), 'treinos')
  return linhas.length
}

// ------------------------------------------------------------------ check-ins
async function checkinIdempotente(cliente, sessaoId) {
  const { error } = await cliente.rpc('fazer_checkin', { p_sessao_id: sessaoId })
  if (error && error.message !== 'checkin_ja_existe') throw new Error(`fazer_checkin: ${error.message}`)
}

async function prepararCheckins(ana, bruno) {
  const agora = new Date()
  // Futuras e ainda não bloqueadas (margem de 2h além do limite de 1h).
  const limite = new Date(agora.getTime() + 3 * 3600_000).toISOString()
  const sessoes = checar(await admin.from('sessoes')
    .select('id, inicia_em, vagas, turmas!inner(nome)')
    .gte('inicia_em', limite).eq('cancelada', false)
    .order('inicia_em').limit(60), 'sessoes')

  const manha = sessoes.filter((s) => s.turmas.nome === 'Funcional Manhã')
  const cedo = sessoes.filter((s) => s.turmas.nome === 'Funcional Cedo')
  if (!manha.length || !cedo.length) throw new Error('Nenhuma sessão futura gerada.')

  // 1) Ana confirmada na próxima aula das 06:00.
  const cAna = await loginComo(ana)
  await checkinIdempotente(cAna, manha[0].id)

  // 2) Uma aula das 07:00 "lotada" (1 vaga, ocupada pelo Bruno) para exercitar a lista de espera.
  const lotada = cedo[0]
  if (lotada.vagas !== 1) checar(await admin.from('sessoes').update({ vagas: 1 }).eq('id', lotada.id), 'vagas=1')
  const cBruno = await loginComo(bruno)
  await checkinIdempotente(cBruno, lotada.id)

  // 3) Uma aula cancelada pelo treinador (com observação), sem check-ins.
  const cancelar = manha[2]
  if (cancelar) {
    checar(await admin.from('sessoes')
      .update({ cancelada: true, observacao: 'Manutenção no espaço. Nos vemos na aula seguinte!' })
      .eq('id', cancelar.id), 'cancelar sessão')
  }
  return { confirmada: manha[0].inicia_em, lotada: lotada.inicia_em }
}

// ------------------------------------------------------------------ notificações e convite
async function garantirNotificacoes(ana) {
  const atuais = checar(await admin.from('notificacoes').select('titulo').eq('perfil_id', ana.id), 'notificacoes')
  const desejadas = [
    { titulo: 'Treinos da semana no ar', corpo: 'Os treinos da próxima semana já estão disponíveis. Garanta sua vaga!', link: '/', lida_em: null },
    { titulo: 'Bem-vinda ao RA Funcional', corpo: 'Seu cadastro está pronto. Faça check-in nas aulas pela agenda.', link: '/', lida_em: new Date().toISOString() },
  ].filter((n) => !atuais.some((a) => a.titulo === n.titulo))
  if (desejadas.length) {
    checar(await admin.from('notificacoes').insert(desejadas.map((n) => ({ ...n, perfil_id: ana.id }))), 'insert notificacoes')
  }
}

async function garantirConvite() {
  const agora = new Date().toISOString()
  const pend = checar(await admin.from('convites').select('codigo')
    .eq('status', 'pendente').eq('nome_previsto', 'Convite DEV').gt('expira_em', agora).limit(1), 'convites')
  if (pend.length) return pend[0].codigo
  const codigo = randomBytes(6).toString('hex').toUpperCase() // mesmo formato de criar_convite (12 hex maiúsculos)
  checar(await admin.from('convites').insert({ codigo, nome_previsto: 'Convite DEV' }), 'insert convite')
  return codigo
}

// ------------------------------------------------------------------ main
const senhasAntigas = lerCredenciais()
const criados = []
for (const u of USUARIOS) criados.push(await garantirUsuario(u, senhasAntigas))

const turmasNovas = await garantirTurmas()
const geradas = checar(await admin.rpc('gerar_sessoes'), 'gerar_sessoes')
const hoje = chaveDiaSP(new Date())
const treinos = await garantirTreinos(hoje)
const cenarios = await prepararCheckins(criados[1], criados[2])
await garantirNotificacoes(criados[1])
const codigo = await garantirConvite()

const linhasCred = [
  '# RA Funcional — credenciais do projeto Supabase DEV (gerado por scripts/seed-dev.mjs).',
  '# NÃO COMMITAR. Arquivo listado no .gitignore.',
  '',
  ...criados.map((u) => `${u.email}  senha: ${u.senha}  (${u.papel === 'treinador' ? 'treinador' : 'aluno'} — ${u.nome})`),
  '',
  `Convite pendente: ${codigo}`,
  `Link local do convite: http://localhost:5173/convite/${codigo}`,
  '',
]
writeFileSync(ARQ_CRED, linhasCred.join('\n'), { encoding: 'utf8', mode: 0o600 })

console.log('Seed DEV concluído.')
console.log(`  Usuários: ${criados.map((u) => `${u.email} (${u.papel})`).join(', ')}`)
console.log(`  Turmas novas: ${turmasNovas} · sessões geradas agora: ${geradas} · treinos: ${treinos}`)
console.log(`  Check-in confirmado (Ana): ${cenarios.confirmada} · sessão lotada (Bruno): ${cenarios.lotada}`)
console.log(`  Código de convite: ${codigo}`)
console.log('  Senhas em web/.dev-credenciais.txt (não commitado).')
