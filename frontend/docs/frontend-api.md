# Integração de dados do frontend

`src/services/api.ts` concentra toda a leitura e gravação de dados. Os componentes devem importar suas funções, sem usar `fetch` diretamente. Os contratos TypeScript ficam em `src/types/index.ts`.

Sem `VITE_API_BASE_URL`, o serviço usa `src/mocks/behavioralFixtures.ts`, com latência simulada de 100 ms. Todos os nomes, números de processo, documentos, probabilidades, valores, versões de política e modelo são fictícios. Não há execução de política, modelo, extração de PDF ou cálculo financeiro. Documentos presentes e inconclusivos têm prévias textuais `demo_pages`; referências de evidência identificam essas prévias MOCK e uma página existente. Documentos ausentes têm zero páginas.

Os casos `caso-1` a `caso-8` têm sete categorias documentais. Os casos 1–3 começam aguardando decisão; os casos 4–8 incluem registros demonstrativos iniciais. O caso 2 contém a divergência entre a alegação sobre conta na Caixa e a atribuição ao tomador na consulta BACEN MOCK, sem tratar essa consulta como comprovação independente do crédito. A próxima evidência é uma sugestão acompanhada de SIMULAÇÃO explícita e nunca recalcula a recomendação.

## API pública

| Função | Retorno | Endpoint futuro |
| --- | --- | --- |
| `getCases()` | `Promise<CaseSummary[]>` | `GET /cases` |
| `getCase(id)` | `Promise<CaseDetail>` | `GET /cases/:id` |
| `getRecommendation(id)` | `Promise<RecommendationResponse>` | `GET /cases/:id/recommendation` |
| `getDecision(caseId)` | `Promise<DecisionRecord \| null>` | `GET /cases/:id/decision` |
| `getNegotiation(caseId)` | `Promise<NegotiationRecord \| null>` | `GET /cases/:id/negotiation` |
| `submitLawyerDecision(input)` | `Promise<DecisionRecord>` | `POST /cases/:id/decision` |
| `submitOverride(input)` | `Promise<DecisionRecord>` | `POST /cases/:id/override` |
| `submitNegotiation(input)` | `Promise<NegotiationRecord>` | `POST /cases/:id/negotiation` |
| `getAdminDashboard()` | `Promise<AdminDashboard>` | `GET /admin/dashboard` |
| `resetDemoData()` | `Promise<void>` | Apenas local; não existe chamada de reset remoto |

Também são exportados `isMockMode`, `DATA_CHANGED_EVENT`, `DEMO_STORAGE_KEY` e `ApiError` (com `message` e `status`). Consultas a registro ainda inexistente retornam JSON `null`; consultas a caso inexistente devem falhar com 404. POSTs recebem o objeto tipado completo, incluindo `case_id`, e retornam o registro persistido. As respostas HTTP devem ser JSON, sem envelope. Mensagens de falha podem usar `{ "message": "..." }` ou `{ "detail": "..." }`.

Para integrar um serviço real, configure, por exemplo, `VITE_API_BASE_URL=/api` no ambiente Vite. O prefixo é concatenado aos endpoints acima. A camada central oferece GET/POST tipados e timeout de 15 segundos. Autenticação, autorização, auditoria durável e validação do contrato recebido pertencem à integração futura; os tipos de resposta são contratos de compilação, não validadores de schema em runtime. Não há fallback automático para mocks se a API real falhar.

## Gravação e atualização

As decisões e negociações locais são persistidas em `localStorage['policy:demo-data:v1']`, com versão de schema. A última decisão e a última negociação de cada caso são mantidas entre recargas. Os registros iniciais de demonstração são usados quando não existe gravação local. A restauração remove somente essa chave e repõe as fixtures. Objetos retornados no modo mock são cópias, para evitar alteração acidental das fixtures. Erros de armazenamento são apresentados como falhas, sem afirmar que um registro foi salvo.

Após uma gravação bem-sucedida ou restauração, o serviço emite `window` event `policy:data-changed`. Hooks devem refazer as consultas relevantes e remover seus listeners no cleanup. `event.detail` contém `action`, `case_id` opcional e `demo_data`. Alterações da mesma chave em outra aba também emitem esse evento.

A confirmação exige uma decisão igual à recomendação; uma divergência exige decisão diferente, motivo enumerado e justificativa não vazia. Negociações exigem decisão de acordo registrada e valores positivos finitos. Uma contraproposta exige `counterproposal_value`; aceite exige `final_value`. Faixas sugeridas não são usadas para calcular valores ou inferir novas recomendações. Negociações anteriores ficam preservadas se a estratégia for alterada, mas deixam de determinar o estado ativo e a tabela administrativa enquanto a decisão for defesa ou revisão.

O estado do caso passa para `EM_NEGOCIACAO` após decisão de acordo e para `CONCLUIDO` após aceite; decisões de defesa ou revisão ficam em `DECISAO_REGISTRADA`. Negociações pendentes, recusadas e com contraproposta mantêm `EM_NEGOCIACAO`. A recomendação original, sua versão e seus números permanecem iguais às fixtures.

## Dashboard demonstrativo

Os KPIs, séries, distribuição, motivos de divergência e a simulação histórica são valores sintéticos de um cenário demonstrativo maior, não totais da tabela visível. Taxas e `percentage` usam a escala de 0 a 1. A interface deve rotular esses agregados como demonstração; a simulação histórica é separada dos registros efetivamente inseridos no navegador e não representa economia realizada.

`getAdminDashboard()` combina as linhas iniciais com a última decisão/negociação local por caso, sem duplicar o caso. `is_local: true` identifica linhas com interação persistida no navegador, ainda dentro da demonstração. A tabela e `updated_at` acompanham essas gravações; KPIs financeiros, séries e premissas históricas não são recalculados.
