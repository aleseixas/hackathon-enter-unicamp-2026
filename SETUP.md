# Configuração e execução

Este guia cobre os três componentes executáveis do repositório: o frontend demonstrativo, o gerador de aderência sintética e o agente de teste de usabilidade.

## Pré-requisitos

| Ferramenta | Versão | Uso |
| --- | --- | --- |
| Node.js | `>= 22.12.0` | Frontend React/Vite |
| npm | incluído com o Node.js | Dependências e scripts do frontend |
| Python | `>= 3.10` | Gerador sintético e agente de usabilidade |

O gerador em `src/synthetic_adherence.py` usa somente a biblioteca padrão do Python. O agente possui dependências próprias em `usability-agent/requirements.txt`.

## 1. Frontend demonstrativo

Na raiz do repositório:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Acesse `http://127.0.0.1:5173`.

Por padrão, a interface funciona inteiramente com mocks locais. Não é necessário configurar API, banco de dados ou credenciais para navegar pela demonstração.

### API opcional

Somente para integrar uma API externa, copie o exemplo para `frontend/.env.local` e informe a URL base:

```bash
cd frontend
cp .env.example .env.local
```

No PowerShell, use:

```powershell
Copy-Item .env.example .env.local
```

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Deixe `VITE_API_BASE_URL` vazio para continuar usando os mocks. Reinicie o servidor Vite após alterar o arquivo. O frontend não lê essa variável de um `.env` na raiz.

### Verificações do frontend

```bash
cd frontend
npm run lint
npm test
npm run build
```

## 2. Gerador de aderência sintética

O gerador lê `Hackaton_Enter_Base_Candidatos.xlsx` e cria uma camada operacional fictícia e reproduzível para a demonstração.

```bash
python src/synthetic_adherence.py
```

Saídas padrão:

- `data/synthetic_adherence.csv`: base detalhada gerada localmente e ignorada pelo Git;
- `data/synthetic_adherence_summary.json`: resumo demonstrativo versionado.

Opções úteis:

```bash
python src/synthetic_adherence.py --help
python src/synthetic_adherence.py --limit 500 --seed 7 --output-csv data/local/sample.csv --output-json data/local/sample.json
```

O diretório `data/local/` é ignorado pelo Git e serve para execuções exploratórias. O comando aceita caminhos alternativos por `--xlsx`, `--output-csv` e `--output-json`. Consulte [data/README.md](data/README.md) antes de atualizar o snapshot versionado.

`src/adherence_dashboard.py` é um legado desativado e encerra imediatamente com uma orientação para usar o frontend React. Ele não deve ser usado para iniciar a aplicação.

## 3. Agente de teste de usabilidade

Mantenha o frontend ativo em `http://127.0.0.1:5173`. Em outro terminal:

```bash
cd usability-agent
python -m venv .venv
```

Ative o ambiente virtual:

```powershell
.\.venv\Scripts\Activate.ps1
```

Em macOS ou Linux:

```bash
source .venv/bin/activate
```

Instale as dependências e o Chromium:

```bash
python -m pip install -r requirements.txt
python -m playwright install chromium
```

O agente lê `OPENAI_API_KEY` e `OPENAI_MODEL` diretamente das variáveis do processo. Ele **não carrega arquivos `.env` automaticamente**.

PowerShell:

```powershell
$env:OPENAI_API_KEY = "sua-chave"
$env:OPENAI_MODEL = "gpt-4.1-mini"
python run_test.py
```

Bash:

```bash
export OPENAI_API_KEY="sua-chave"
export OPENAI_MODEL="gpt-4.1-mini"
python run_test.py
```

`OPENAI_MODEL` é opcional. Para validar a infraestrutura sem chamar a OpenAI:

```bash
python run_test.py --dry-run
python -m unittest discover -s tests -v
```

Consulte [usability-agent/README.md](usability-agent/README.md) para os contratos das tarefas, métricas e relatórios gerados.

## Solução de problemas

- **Vite informa versão incompatível:** confirme `node --version`; a versão esperada está em `.nvmrc`.
- **A porta 5173 está ocupada:** execute o Vite em outra porta e passe a mesma URL ao agente com `--base-url`.
- **Chromium não encontrado:** rode novamente `python -m playwright install chromium` no ambiente virtual do agente.
- **A chave não foi encontrada:** defina `OPENAI_API_KEY` no mesmo terminal que executará `run_test.py`.

## Variáveis de ambiente

| Variável | Componente | Obrigatória |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Frontend | Não; vazia usa mocks locais |
| `OPENAI_API_KEY` | Agente de usabilidade | Sim, exceto no dry-run |
| `OPENAI_MODEL` | Agente de usabilidade | Não |

Nunca versione credenciais, `.env.local`, relatórios do agente ou dados processuais reais.
