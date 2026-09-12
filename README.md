# Enter Policy · Hackathon Enter × Unicamp 2026

Repositório da equipe para o Hackathon Enter na Unicamp.

## Visão geral

Este projeto entrega somente o frontend de uma mesa de trabalho demonstrativa para análise de processos bancários, consulta de evidências e registro de decisões sobre acordos.

O protótipo foi construído com React, TypeScript e Vite. Ele expõe dois perfis demonstrativos:

- **Advogado** para analisar casos, confrontar evidências, registrar decisão e negociar.
- **Administrativo** para acompanhar aderência, efetividade e registros consolidados.

Não há backend, banco de dados, execução de modelo ou motor de política neste repositório. Os casos, documentos, indicadores e valores iniciais são fictícios.

## Execução

Entre na pasta do frontend e rode:

```sh
cd frontend
npm install
npm run dev
```

Depois abra a URL indicada pelo Vite no terminal.

## Comandos úteis

Dentro de `frontend`:

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento. |
| `npm run build` | Verifica os tipos e gera a aplicação em `dist`. |
| `npm run lint` | Executa o Oxlint. |
| `npm run test` | Executa os testes automatizados. |
| `npm run preview` | Disponibiliza localmente o build já gerado. |

## Documentação

- [Guia do frontend](frontend/README.md)
- [Contrato de integração](frontend/docs/frontend-api.md)
- [Link do desafio](https://www.hackathon.getenter.ai/desafio)

## Estrutura

```text
frontend/   # aplicação frontend completa
```

## Observações

O estado da demo é persistido localmente no navegador. Para um serviço real, ajuste `VITE_API_BASE_URL` em `frontend/.env.local`.
