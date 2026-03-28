# Sobradinho TEM! 🌇

> Guia local inteligente de Sobradinho-DF — tudo que você precisa, aqui mesmo.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS + Framer Motion |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Banco | PostgreSQL 15 |
| Auth | JWT (access 15min) + Refresh Token (30d, httpOnly cookie) |
| IA | Anthropic Claude API (agente + análise de lugares) |
| Places | Google Places API (fotos, nota, endereço) |
| Email | SendGrid |
| WhatsApp | Meta Cloud API |
| Deploy | Railway (backend + postgres) + Vercel (frontend) |

---

## Estrutura do projeto

```
sobradinhotem/
├── backend/
│   └── src/
│       ├── index.ts              # Entry point Express
│       ├── prisma/
│       │   ├── schema.prisma     # Modelo de dados completo
│       │   └── client.ts         # Singleton Prisma
│       ├── routes/
│       │   ├── auth.ts           # Register user/owner, login, refresh, logout
│       │   ├── users.ts          # Perfil, onboarding, preference-log, opt-in
│       │   ├── places.ts         # CRUD de lugares, Google Places sync
│       │   ├── chat.ts           # Salvar conversas, histórico
│       │   ├── owner.ts          # Dashboard dono, enrich, patrocínio
│       │   └── notifications.ts  # Triggers email/whatsapp
│       ├── middleware/
│       │   └── auth.ts           # authMiddleware, ownerMiddleware, adminMiddleware
│       └── services/
│           └── notificationService.ts  # SendGrid + WhatsApp
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Onboarding.tsx    # Wizard de gostos + opt-in canais
│       │   ├── chat/             # ChatWindow, MessageBubble, PlaceBlock
│       │   ├── cards/            # PlaceCard, AnaliseCard, GoogleCard
│       │   ├── auth/             # LoginModal, RegisterUser, RegisterOwner
│       │   └── owner/            # OwnerDashboard, PlaceEnrichForm
│       ├── services/
│       │   └── chatService.ts    # Sistema prompt, parser PLACES, análise IA, logInteraction
│       ├── store/
│       │   └── authStore.ts      # Zustand: user, token, preferences, opt-ins
│       └── hooks/
│           ├── useChat.ts        # Gerencia histórico + envio de msgs
│           └── usePreferences.ts # Atualiza pesos com base em interações
```

---

## Modelo de dados principal

### `User`
- `preferences` (jsonb) — pesos por categoria: `{ gastronomia: 0.9, natureza: 0.4 }`
- `acceptEmail` / `acceptWhatsapp` — opt-in explícito
- `referralCode` — código de convite único
- `onboardingDone` — se já passou pelo wizard de gostos

### `UserPreferenceLog`
- Registra cada interação: save (+0.10), maps_click (+0.07), dismiss (-0.05)
- Permite reconstruir o histórico de aprendizado

### `Place`
- `enrichment` (jsonb) — dados do dono: fotos, horários, menu, diferenciais
- `sponsored` / `sponsorBudget` — modelo de patrocínio futuro

### `Owner`
- Vinculado a um `User` com `role: OWNER`
- Pode ter múltiplos `Place`s

---

## Como rodar

```bash
# 1. Banco de dados
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=senha postgres:15

# 2. Backend
cd backend
cp .env.example .env   # preencher variáveis
npm install
npx prisma migrate dev
npm run dev

# 3. Frontend
cd frontend
npm install
npm run dev
```

### Variáveis de ambiente (.env backend)

```
DATABASE_URL=postgresql://postgres:senha@localhost:5432/sobradinhotem
JWT_SECRET=segredo_super_secreto_aqui
JWT_REFRESH_SECRET=outro_segredo_aqui
FRONTEND_URL=http://localhost:5173
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_PLACES_KEY=AIza...
SENDGRID_API_KEY=SG....
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_ID=...
NODE_ENV=development
PORT=3001
```

---

## Fluxos principais

### Cadastro de usuário
1. Preenche nome, email, senha, bairro
2. **Onboarding wizard**: seleciona categorias e intensidade (slider 0–1)
3. **Opt-in canais**: escolhe receber por email e/ou WhatsApp
4. Preferências salvas em `user.preferences` (jsonb) e logadas em `UserPreferenceLog`

### Cadastro de dono
1. Preenche dados pessoais + nome do estabelecimento + CNPJ
2. Acesso ao dashboard de enriquecimento
3. Pode adicionar fotos, horários, menu, diferenciais
4. Futuro: patrocínio com orçamento diário

### Aprendizado contínuo
- Cada interação com um card ajusta o peso da categoria:
  - Salvar lugar: +0.10
  - Clicar no Maps: +0.07
  - Compartilhar: +0.08
  - Ver sem interagir: +0.02
  - Fechar/ignorar: -0.05
- O agente usa os pesos no system prompt pra personalizar recomendações

### Modelo de receita (futuro)
1. Donos pagam por patrocínio (R$/dia) — lugar aparece primeiro nas buscas relevantes
2. Email semanal patrocinado — um lugar em destaque por cidade
3. Dados anonimizados de tendências para prefeitura/pesquisadores

---

## Deploy sugerido

| Serviço | O que hospedar | Custo estimado |
|---------|---------------|----------------|
| **Railway** | Backend Node.js + PostgreSQL | ~R$30/mês |
| **Vercel** | Frontend React | Grátis |
| **Cloudflare R2** | Fotos dos estabelecimentos | ~R$5/mês |
| **SendGrid** | Email (até 100/dia) | Grátis |

---

Feito com ❤️ pela comunidade de Sobradinho.
