# Agente de teste de usabilidade

Este agente simula um advogado externo usando somente a interface renderizada do frontend. Ele não abre arquivos da repo, não lê README ou documentação interna e não usa seletores derivados do código. A cada rodada, o modelo recebe uma screenshot, o texto visível e o contexto da tarefa; escolhe no máximo uma ação baseada em rótulo, texto ou papel acessível; e o Playwright executa essa ação.

## Preparar

Com o frontend rodando em outro terminal:

```powershell
cd frontend
npm run dev -- --host 127.0.0.1
```

Em outro terminal, instale as dependências do agente:

```powershell
cd usability-agent
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m playwright install chromium
```

Defina a chave apenas no ambiente:

```powershell
$env:OPENAI_API_KEY = "sua-chave"
$env:OPENAI_MODEL = "gpt-4.1-mini"
python run_test.py
```

O modelo padrão usa visão. Para trocar a porta, use `--base-url http://127.0.0.1:5174`. Para limitar o custo, rode um subconjunto e menos ações:

```powershell
python run_test.py --tests test-1-compreensao-imediata test-2-entender-recomendacao --max-actions 8
```

Antes de usar a API, é possível validar Playwright, screenshots e geração de relatório:

```powershell
python run_test.py --dry-run
```

## Saídas

- `reports/UX_REPORT.md`: resumo executivo, resultado por tarefa, ações, confusões, telas, notas e melhorias.
- `reports/UX_REPORT.json`: os mesmos dados estruturados.
- `screenshots/`: uma screenshot de cada rodada de cada teste.

Os relatórios e screenshots são gerados localmente e não contêm chave da OpenAI. O limite padrão é de 14 ações por teste. Uma falha de locator é registrada como evidência de usabilidade e enviada à próxima rodada para que o agente tente se recuperar.

## Testes da infraestrutura

```powershell
python -m unittest discover -s tests -v
```
