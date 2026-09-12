# Utilitários de dados

Esta pasta contém o gerador da camada sintética de aderência usada na demonstração. O frontend principal está em `frontend/`.

## Arquivos

| Arquivo | Estado | Finalidade |
| --- | --- | --- |
| [synthetic_adherence.py](synthetic_adherence.py) | Ativo | Lê o XLSX de entrada e gera registros comportamentais sintéticos e um resumo agregado |
| [adherence_dashboard.py](adherence_dashboard.py) | Legado desativado | Preservado apenas como referência; encerra a execução e direciona para o frontend React |

## Gerador sintético

Requisitos:

- Python `>= 3.10`;
- `Hackaton_Enter_Base_Candidatos.xlsx` na raiz, salvo se outro caminho for informado;
- nenhuma dependência externa: o script usa apenas a biblioteca padrão.

Execute a partir da raiz:

```bash
python src/synthetic_adherence.py
```

O processo é reproduzível pela seed e gera:

- `data/synthetic_adherence.csv`, base detalhada local;
- `data/synthetic_adherence_summary.json`, snapshot agregado demonstrativo.

Exemplos:

```bash
python src/synthetic_adherence.py --help
python src/synthetic_adherence.py --limit 500 --seed 7 --output-csv data/local/sample.csv --output-json data/local/sample.json
```

As opções `--xlsx`, `--output-csv` e `--output-json` permitem alterar os caminhos padrão. Use o diretório ignorado `data/local/` para testes que não devem atualizar o snapshot oficial. Mais detalhes sobre a metodologia estão em [docs/behavioral_adherence_model.md](../docs/behavioral_adherence_model.md), e a política de dados está em [data/README.md](../data/README.md).

## Interface recomendada

Use o frontend React/Vite:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Consulte o [guia de configuração](../SETUP.md) para o fluxo completo.
