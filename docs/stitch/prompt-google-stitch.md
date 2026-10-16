# Prompt para o Google Stitch: UI/UX do RA Funcional

Como usar: abra o Stitch, escolha **Mobile app** (depois repita com **Web**), cole o **Prompt principal** e gere. Se o resultado vier genérico, use os **prompts por tela** para refinar uma tela de cada vez. Traga de volta as telas que você mais gostar (prints ou exportação) para eu comparar com o app.

---

## Prompt principal (copie tudo abaixo)

```
Design the mobile app and the desktop web app for "RA Funcional", a class-booking app for a small, premium, in-person functional training studio in Brazil, run by one personal trainer (Rafael Alvarenga). All interface text must be in Brazilian Portuguese.

WHAT THE PRODUCT IS (important)
- Classes are IN PERSON at the studio, with the trainer. The app is NOT a workout-tracking or follow-along fitness app.
- Its one job: students reserve a spot in a class in two taps, see who is coming, and get notified. The trainer sees who is coming to each class.
- Core rules the UI must make obvious: each class has a limited number of spots; check-in and cancellation close 1 hour before the class; if a class is full the student can join a waiting list and is automatically moved up when someone cancels; each week the trainer posts a short "workout preview" (a title, a few lines of text, and an optional video link) so students know what is coming.
- Sign-up is by invitation only (the trainer sends a link).

USERS
1) Students (mostly on phones, often in a hurry, sometimes before 6 a.m.). 2) The trainer (phone and laptop).

TONE AND VISUAL DIRECTION
- Professional, confident, athletic, clean. Think of a serious boutique training studio and the clarity of a well-designed scoreboard or timetable, not a wellness app and not a generic SaaS template.
- Strong typographic hierarchy. Class times are the hero of the interface: large, tabular, condensed numerals.
- One accent color used only for the primary action. Use semantic colors only for status (confirmed, waiting list, full, closed).
- Brand colors are not defined yet: propose a distinctive palette that fits a training studio (avoid the common "warm cream + terracotta" look, avoid purple gradients, avoid dark-mode-with-neon). Show it as design tokens.
- Use real photography placeholders (people training, equipment, the studio) in a few moments, not illustrations or abstract blobs.
- Avoid: decorative circles and blobs, ticket/perforation metaphors, every item inside a rounded card with a shadow, small uppercase labels above every heading, emoji as icons, centered hero layouts, generic stock-dashboard look.
- Accessible: text contrast at least 4.5:1, touch targets at least 44px, status never shown by color alone.

SCREENS FOR THE STUDENT (mobile, 375px wide, then desktop 1440px)
1. Login: logo area, e-mail, password, "Entrar", a link "Recebeu um convite do seu treinador? Use seu código".
2. Sign-up by invitation: name, phone (optional), e-mail, password, invitation code, "Criar conta".
3. Home / Agenda: greeting, the selected day as the title, a day strip for the next 14 days (a dot only on days where the student has a class), a highlighted "Sua próxima aula" card (e.g. "Amanhã, 06:00 · Funcional Manhã"), and the list of that day's classes. Each class row: time, class name, "12 vagas · 60 min", and either a primary "Reservar" button, "Confirmado" with a check, "Na fila · Nº1", or "Lotada" with a secondary "Entrar na fila". Closed or finished classes appear muted.
4. Class detail: class name, time range, spots left with a thin progress bar, a short "Prévia do treino" (title + 2 to 4 lines, plus an optional small link "Ver demonstração no YouTube"; keep it secondary because the workout happens in person), and a sticky bottom bar with "Fazer check-in" and the note "Check-in aberto até 17:30". Variants: confirmed (shows "Cancelar" with a confirmation step), full (shows "Entrar na lista de espera"), closed ("Check-in encerrado: fecha 1 hora antes da aula"), cancelled by the trainer (shows the reason).
5. My classes: upcoming reservations and waiting-list entries, and a monthly attendance calendar ("Frequência em outubro", total classes, days attended filled).
6. Notifications: list with unread dots, e.g. "Vaga liberada! Você foi confirmado na aula de 19/10 às 07:00", "Aula cancelada", "Treinos da semana no ar".
7. Profile: name, phone, a card to turn on push notifications, a card to install the app on the home screen, quiet "Sair da conta".
On desktop: a left sidebar (Agenda, Minhas aulas, Perfil) and a two-column agenda: the day's list on the left, the selected class detail on the right.

SCREENS FOR THE TRAINER (desktop first, also mobile)
1. Day panel: the day as title with Ontem / Hoje / Amanhã and arrows, totals (classes, confirmed/capacity, waiting), and one card per class with time, name, confirmed count with progress bar, the list of confirmed students, and a highlighted waiting list when it exists. "Check-in fecha às 05:00" for open classes; a status tag only for exceptions (Lotada, Encerrada, Cancelada).
2. Class view: confirmed and waiting lists with a quiet "Remover" per student, and a calm "Cancelar esta aula" section that asks for a reason and warns that everyone is notified.
3. Classes (weekly schedule): a timetable grid, days as columns and start times as rows, each cell with class name, duration, spots, "Editar" and a quiet "Desativar". A "Nova turma" button opens a form (name, weekday, start time, duration, spots).
4. Workouts: a week view with seven day tiles (published = small green dot, draft, empty with "+ Cadastrar"), and an editor with title, description, optional video link, "Salvar rascunho" and "Publicar agora".
5. Students: searchable list (by name or phone) with filters Todos / Ativos / Inativos, columns name, phone, classes this month, status, and a quiet "Desativar"; plus an "Convidar aluno" panel that generates an invitation link with "Copiar link" and "Enviar no WhatsApp", and a list of invitations (pending, used, expired).

DELIVERABLES
- All screens above in a consistent design system, mobile and desktop.
- A small design system: color tokens, type scale (condensed display font for titles and numbers plus a neutral highly legible text font), spacing, radius, buttons, status tags, class row, day strip, empty states, loading skeletons, error and confirmation dialogs.
- Use realistic data in Brazilian Portuguese: classes "Funcional Manhã 06:00", "Funcional Cedo 07:00", "Funcional Noite 18:30"; students like Ana Souza, Bruno Lima, Carla Mendes.
```

---

## Prompts por tela (para refinar, um de cada vez)

**Agenda do aluno (celular)**
```
Redesign only the student's Agenda screen for mobile (375px). In-person training studio. The day's classes are the hero: large condensed tabular times, class name, "12 vagas · 60 min", one clear primary "Reservar" button per row; states: Confirmado (check), Na fila · Nº1, Lotada with secondary "Entrar na fila". A top card "Sua próxima aula: Amanhã, 06:00". A 14-day strip with a dot only on days the student has a class. Bottom tab bar: Agenda, Minhas aulas, Perfil. Professional, athletic, timetable-like. No cards with heavy shadows, no decorative shapes, no uppercase eyebrow labels. Portuguese (Brazil).
```

**Detalhe da aula**
```
Design the class detail screen for mobile. Top: class name, time range 18:30 – 19:20, spots left with a thin progress bar. Middle: a short secondary "Prévia do treino" (title and three short lines; an optional small text link "Ver demonstração" ; the workout itself happens in person at the studio, so do not make it look like a follow-along workout). Sticky bottom bar: primary "Fazer check-in" and the note "Check-in aberto até 17:30". Also show these variants: confirmed with "Cancelar" and a confirmation panel, full with "Entrar na lista de espera", closed ("Check-in encerrado, fecha 1 hora antes da aula"). Portuguese (Brazil).
```

**Painel do dia do treinador (desktop)**
```
Design the trainer's "Painel do dia" for desktop (1440px) for a boutique functional training studio. Left sidebar: Painel, Turmas, Treinos, Alunos. Header: the date as the title with Ontem / Hoje / Amanhã and arrows, plus three totals (Aulas 3, Confirmados 18/30, Na fila 2). Below, one column per class (06:00, 07:00, 18:30): big time, class name, "7/12 confirmados" with progress bar, the confirmed students list with small avatars, and a highlighted waiting list. Dense but calm, like a gym timetable board. No decorative shapes, no heavy shadows. Portuguese (Brazil).
```

**Turmas em grade semanal (treinador)**
```
Design a weekly timetable screen for a personal trainer: columns Monday to Friday, rows are start times (06:00, 07:00, 18:30), each cell shows class name, "60 min · 12 vagas", an "Editar" action and a quiet "Desativar". Top right: primary button "Nova turma". Clear, printable-looking, like a studio timetable pinned on a wall. Portuguese (Brazil).
```

**Alunos e convites (treinador)**
```
Design the trainer's Students screen for desktop: a search field ("Buscar por nome ou telefone"), segmented filter Todos / Ativos / Inativos with counts, a table (name with avatar, phone, "Aulas em outubro", status, quiet "Desativar"), and a right column "Convidar aluno" with a field, primary "Gerar link de convite", then "Copiar link" and "Enviar no WhatsApp", and below it a list of invitations with status Pendente / Usado / Expirado. Portuguese (Brazil).
```

**Sistema de design (tokens e componentes)**
```
Create a design system board for "RA Funcional" (in-person functional training studio booking app): a distinctive palette with one action color and semantic status colors, a type scale with a condensed display font for times and titles and a neutral text font, spacing and radius, primary/secondary/quiet buttons, status tags (Confirmado, Na fila, Lotada, Encerrada, Cancelada), a class row, a day strip, an empty state, a loading skeleton, and a confirmation dialog. Avoid warm cream with terracotta, purple gradients and decorative blobs.
```

---

## O que levar de volta para mim
- As 3 a 5 telas que você mais gostou (print ou exportação), mesmo que não sejam as "certas".
- A paleta e as fontes que o Stitch sugerir.
- O que você achou fraco ou diferente do que imaginava (uma frase por tela basta).

Com isso eu comparo com o app atual e ajusto o que fizer sentido, sem perder as regras de negócio.
