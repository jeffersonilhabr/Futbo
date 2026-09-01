# Bot de Palpites ao Vivo

Sistema automático que gera palpites sobre os 5 melhores jogos do dia a cada 1 hora.

## Como Funciona

1. **football.bot.ts** - Busca os fixtures do dia e analisa os melhores 5 jogos
2. **bot-runner.ts** - Executa o bot e salva os palpites no banco de dados
3. **API /api/bot-predictions** - Endpoint HTTP para disparar o bot manualmente

## Configuração

### Variáveis de Ambiente Necessárias

```env
# Já deve existir no seu projeto
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
API_FOOTBALL_KEY=your-api-football-key

# Para o bot funcionar
BOT_USER_ID=00000000-0000-0000-0000-000000000000  # ID fixo do usuário "bot"
```

### Criar Usuário Bot no Supabase

Você precisa criar um usuário de sistema para armazenar os palpites do bot:

```sql
-- Execute no console do Supabase
INSERT INTO auth.users (
  id, email, email_confirmed_at, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'bot@palpites.local',
  now(),
  now(),
  now()
);
```

## Agendamento

### Opção 1: Usar Render Cron (Recomendado)

Seu projeto está no Render. Adicione um job cron no `render.yaml`:

```yaml
services:
  - type: cron
    name: bot-predictions
    buildCommand: npm run build
    startCommand: curl -X GET https://seu-dominio.onrender.com/api/bot-predictions?secret=${BOT_SECRET}
    schedule: "0 * * * *"  # A cada hora, no início da hora
    envVars:
      - key: BOT_SECRET
        value: sua_chave_secreta
```

### Opção 2: Usar Serviço Externo (EasyCron, UptimeRobot, etc)

Configure um webhook para chamar:
```
GET https://seu-dominio.onrender.com/api/bot-predictions?secret=sua_chave_secreta
```

Intervalo: 1 hora (60 minutos)

### Opção 3: Usar GitHub Actions

Crie `.github/workflows/bot-predictions.yml`:

```yaml
name: Bot Predictions
on:
  schedule:
    - cron: '0 * * * *'  # A cada hora
jobs:
  bot:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Bot
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.BOT_SECRET }}" \
            https://seu-dominio.onrender.com/api/bot-predictions
```

## Fluxo de Dados

```
1. Cron Job / HTTP Request
   ↓
2. /api/bot-predictions endpoint
   ↓
3. runBotPredictions() em bot-runner.ts
   ↓
4. generateBotPredictions() em football.bot.ts
   ├─ Busca fixtures do dia
   ├─ Analisa cada time (últimos 10 jogos)
   ├─ Calcula score de cada jogo
   └─ Seleciona top 5
   ↓
5. Salva no Supabase
   ├─ user_id = BOT_USER_ID
   ├─ team_name = "Home vs Away"
   ├─ market = "Over 2.5 Gols", "Ambas Marcam", etc
   ├─ rate = confiança (0-100)
   └─ note = "[BOT] Predição..."
   ↓
6. Palpites ficam visíveis em /palpites (filtrados por [BOT])
```

## Metrics Utilizadas para Score

O bot calcula um score (0-100) para cada jogo baseado em:

- **Equilíbrio da Partida** (até 50 pontos): Jogos com times balanceados em força
- **Gols Esperados** (até 30 pontos): Média de gols histórica dos times
- **Forma Recente** (até 15 pontos): Vitórias nos últimos jogos
- **Dados Estatísticos** (até 10 pontos): Disponibilidade de dados de escanteios/cartões

## Tipos de Palpites Gerados

O bot pode gerar palpites para:

- **Over 2.5 Gols**: Baseado na média de gols dos times
- **Ambas Marcam (BTTS)**: Baseado na taxa de gols ofensivos/defensivos
- **Escanteios**: Baseado em histórico de escanteios (quando dados disponíveis)
- **Cartões**: Baseado em histórico de cartões (quando dados disponíveis)

## Monitoramento

### Verificar Últimos Palpites do Bot

```typescript
// Adicione isso em uma página de admin
import { listBotPredictionsFn } from "@/lib/palpites.functions";

const botPredictions = await listBotPredictionsFn({
  data: { limit: 10, hoursAgo: 24 }
});
```

### Logs

Os logs do bot aparecem em:

- **Console do Servidor**: `[BOT]` prefix
- **Console do Render**: Ver logs do serviço/cron job

### Debug

Para testar manualmente:

```bash
# Localmente
npm run dev
curl http://localhost:5173/api/bot-predictions

# Em produção
curl https://seu-dominio.onrender.com/api/bot-predictions?secret=chave_secreta
```

## Próximas Melhorias

- [ ] Integrar mais tipos de palpites (handicap, resultado exato, etc)
- [ ] ML para melhorar selection dos 5 melhores jogos
- [ ] Notificações quando novos palpites são gerados
- [ ] Dashboard admin para monitorar performance do bot
- [ ] Rate limiting e throttling para não exceder quotas da API

## Troubleshooting

**"Bot user not found"**
- Certifique-se que a variável `BOT_USER_ID` está correta
- Crie o usuário bot no Supabase conforme instruções acima

**"API key recusada"**
- Verifique `API_FOOTBALL_KEY` em dashboard.api-football.com
- Teste manualmente: `https://v3.football.api-sports.io/teams?search=Palmeiras` com sua chave

**"No fixtures found for today"**
- Verifique se há jogos no dia em que está rodando
- Mode demo retorna sempre 2 fixtures para teste

**"Error saving prediction"**
- Verifique permissões RLS no Supabase
- Confirme que BOT_USER_ID existe na tabela auth.users
