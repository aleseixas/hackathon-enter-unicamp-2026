# Setup e Execução

> Atualize este arquivo conforme a solução evoluir.

## Pré-requisitos

Liste aqui as dependências necessárias para rodar a solução:

- [ ] Python / Node / outra stack utilizada
- [ ] Dependências do projeto

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as variáveis necessárias:

```env
OPENAI_API_KEY=sua_chave_aqui
```

> Nunca commite o arquivo `.env` com credenciais reais. Use `.env.example` como referência.

## Instalação

```bash
# Adicione aqui os passos de instalação
```

## Execução

```bash
python src/synthetic_adherence.py
```

O comando acima:

- le o arquivo `Hackaton_Enter_Base_Candidatos.xlsx`
- gera uma camada operacional sintetica de aderencia
- exporta `data/synthetic_adherence.csv`
- exporta `data/synthetic_adherence_summary.json`

Opcoes uteis:

```bash
python src/synthetic_adherence.py --limit 500
python src/synthetic_adherence.py --seed 7
```

## Frontend

Para abrir a interface principal:

```bash
cd frontend
npm install
npm run dev
```

O frontend usa os mocks comportamentais em `frontend/src/mocks/behavioralFixtures.ts`, alinhados com os perfis sinteticos de advogado e com os indicadores de aderencia e efetividade.

`src/adherence_dashboard.py` nao e mais a interface recomendada; ele ficou somente como placeholder desativado.

## Dados

Coloque arquivos de dados necessários na pasta `data/`, respeitando o `.gitignore` e sem versionar dados sensíveis.

## Estrutura do Projeto

```text
├── src/          # código-fonte
├── data/         # dados e exemplos
├── docs/         # apresentação e documentação
├── .env.example  # variáveis de ambiente necessárias
├── SETUP.md      # este arquivo
└── README.md     # visão geral do projeto
```
