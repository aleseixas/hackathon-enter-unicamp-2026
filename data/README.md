# Dados demonstrativos

Esta pasta guarda somente artefatos fictícios ou agregados adequados à demonstração pública.

## Artefatos

| Arquivo | Versionamento | Descrição |
| --- | --- | --- |
| [synthetic_adherence_summary.json](synthetic_adherence_summary.json) | Versionado | Snapshot demonstrativo e agregado da última geração completa aprovada |
| `synthetic_adherence.csv` | Ignorado | Saída detalhada gerada localmente pelo simulador |
| `local/` | Ignorado | Execuções exploratórias e amostras descartáveis |

O JSON versionado permite inspecionar os indicadores da demonstração sem regenerar 60 mil registros. Ele não representa telemetria de produção, decisões reais nem uma medição atualizada automaticamente.

## Regeneração

Na raiz do repositório:

```bash
python src/synthetic_adherence.py
```

O comando lê `Hackaton_Enter_Base_Candidatos.xlsx`, grava o CSV local e atualiza o snapshot JSON. Para uma execução rápida sem substituir o snapshot oficial, use caminhos alternativos:

```bash
python src/synthetic_adherence.py \
  --limit 500 \
  --output-csv data/local/sample.csv \
  --output-json data/local/sample.json
```

O gerador usa somente a biblioteca padrão do Python 3.10+ e uma seed padrão para reprodutibilidade. A metodologia está descrita em [docs/behavioral_adherence_model.md](../docs/behavioral_adherence_model.md).

## Segurança e privacidade

Não versione:

- dados processuais reais ou identificáveis;
- documentos, subsídios ou anexos jurídicos;
- exports detalhados gerados para análise local;
- credenciais ou tokens.

Os diretórios `data/subsidios/` e `data/processos_exemplo/`, assim como arquivos CSV em `data/`, permanecem bloqueados pelo `.gitignore`.
