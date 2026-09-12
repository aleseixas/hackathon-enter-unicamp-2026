# Enter Policy · Frontend

Aplicação demonstrativa do Hackathon Enter × Unicamp 2026 para consultar processos, confrontar evidências e registrar decisões sobre acordos. Desenvolvida com React, TypeScript, Vite, React Router, Radix UI e Lucide.

O perfil **Advogado** reúne lista de processos, fila atribuída, análise documental, decisão e negociação. O perfil **Administrativo** reúne visão geral, aderência, efetividade e tabela de decisões. Os perfis são uma navegação de demonstração, sem autenticação ou autorização de servidor.

## Requisitos e execução

Use **Node.js 22.12 ou superior** e npm. O ambiente de desenvolvimento utiliza Node.js 24.

Partindo da raiz do repositório:

```sh
cd frontend
npm install
npm run dev
```

Abra a URL indicada pelo Vite no terminal. O modo mock funciona sem arquivo de ambiente ou backend.

| Comando, dentro de `frontend` | Finalidade |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento. |
| `npm run build` | Verifica os tipos e gera a aplicação em `dist`. |
| `npm run lint` | Executa o Oxlint. |
| `npm run test` | Executa os testes automatizados. |
| `npm run preview` | Disponibiliza localmente o build já gerado. |

## Roteiro da experiência

1. Na entrada, escolha **Advogado**. A lista contém oito casos fictícios, com sete categorias documentais por caso. Os casos 1–3 começam aguardando decisão; os demais incluem registros iniciais para explorar situações posteriores do fluxo.
2. Abra **Maria Aparecida Santos (`caso-1`)**. A causa é de R$ 20.000, com recomendação demonstrativa de **defesa** e risco de perda de **23%**. Consulte os indicadores simulados de assinatura (**91%**) e face (**97,3%**), abra suas fontes e confira a página. Registre a confirmação da recomendação. Uma escolha diferente exige motivo e justificativa.
3. Abra **José Carlos Oliveira (`caso-2`)**. A causa é de R$ 25.000, com recomendação demonstrativa de **acordo** e risco de perda de **72%**. Em contradições, confronte a alegação de não possuir conta na Caixa com a atribuição ao tomador na consulta BACEN MOCK. Essa consulta não resolve as lacunas de comprovação independente do crédito e de liveness.
4. No caso 2, confira a faixa de **R$ 4.500 / R$ 5.200 / R$ 6.500** para abertura, alvo e teto. Os valores de condenação e custo esperado de defesa, **R$ 10.500 / R$ 7.560**, já vêm da fixture. Confirme a decisão de acordo e registre uma negociação. Para demonstrar uma conclusão, informe proposta de R$ 4.500, situação aceita e valor final de R$ 5.200. Pendência, recusa e contraproposta também têm estados próprios.
5. Saia pelo menu lateral e entre como **Administrativo**. Consulte **Visão geral**, **Aderência**, **Efetividade** e **Decisões**. Os registros salvos no navegador aparecem na tabela. Os KPIs e gráficos continuam sendo exemplos estáticos, e a simulação histórica tem premissas fictícias próprias.

O `caso-3` demonstra a recomendação **Revisar**, com dados numéricos indisponíveis e documentação insuficiente. A seção sobre a próxima evidência mostra uma **SIMULAÇÃO** textual; nenhuma interação executa um modelo ou recalcula a recomendação.

## Persistência e restauração

Decisões e negociações são gravadas em `localStorage['policy:demo-data:v1']`. A última decisão e a última negociação de cada caso sobrevivem à recarga e à troca de perfil no mesmo navegador. O perfil escolhido fica em `sessionStorage['enter-policy-role']`; sair encerra essa seleção, sem apagar os registros da demo.

Para recuperar o cenário inicial, abra **Guia da experiência** na navegação lateral e use **Restaurar demonstração**. Essa ação remove os registros locais da demonstração e recupera as fixtures, incluindo as decisões de exemplo dos casos 4–8. Ela está disponível somente no modo mock.

Uma decisão de acordo coloca o caso em negociação; um aceite o conclui. Decisões de defesa ou revisão ficam como decisão registrada. A recomendação original continua preservada, inclusive quando o advogado registra uma divergência. O serviço emite `policy:data-changed` após gravações e restaurações para atualizar as telas.

## Documentos e dados demonstrativos

Todos os casos, nomes, números processuais, documentos e valores iniciais são fictícios. Recomendações e números são fornecidos por mock ou API; o frontend não calcula risco, custos, limites de acordo ou economia e não executa uma política de decisão.

As sete categorias documentais têm estados **Presente**, **Ausente** ou **Inconclusivo**. As fixtures usam `demo_pages`, com campos e texto por página. São prévias textuais MOCK legíveis; não há criação, leitura ou extração de PDFs. Evidências e contradições apontam para o documento e a página correspondentes, com origem demonstrativa explícita.

Para documentos reais disponibilizados futuramente pela API em `CaseDocument.url`, o visualizador usa um `iframe` e acrescenta a página ao fragmento da URL, como `#page=2`. O comportamento de PDFs depende do visualizador do navegador e da permissão de incorporação do servidor de origem. A URL também pode ser aberta separadamente.

Os indicadores agregados e gráficos administrativos representam um cenário demonstrativo maior e não são totais da tabela visível. Registros locais atualizam a tabela e seu estado, sem recalcular KPIs financeiros. A simulação histórica permanece separada e não representa economia realizada.

## Integração futura

Todas as chamadas estão em [`src/services/api.ts`](src/services/api.ts), com contratos em [`src/types/index.ts`](src/types/index.ts). Os componentes não fazem `fetch` diretamente. Por padrão, o serviço retorna cópias das fixtures com pequena latência simulada.

Para direcionar o frontend a uma API, crie `frontend/.env.local` a partir da raiz do repositório:

```dotenv
VITE_API_BASE_URL=/api
```

Reinicie o Vite depois de alterar o ambiente. O valor pode ser o prefixo relativo de um serviço disponibilizado na mesma origem ou a URL-base de uma API. Este projeto não cria um backend nem configura automaticamente um proxy para `/api`. Ao definir essa variável, o serviço passa a usar requisições GET/POST centralizadas; falhas da API não são substituídas silenciosamente por mocks.

O [contrato de integração](docs/frontend-api.md) descreve os endpoints, retornos, validações, eventos e o formato dos registros. Autenticação, autorização, auditoria durável, processamento de documentos e execução de modelos são responsabilidades de uma integração futura.

## Organização

| Diretório | Responsabilidade |
| --- | --- |
| `src/pages` | Páginas dos dois perfis. |
| `src/components` | Layout, elementos de interface, evidências e visualizador de documentos. |
| `src/hooks` | Sessão demonstrativa e carregamento de dados. |
| `src/services` | API central, persistência e testes da camada de dados. |
| `src/mocks` | Casos, documentos, recomendações e indicadores demonstrativos. |
| `src/types` | Contratos compartilhados do frontend. |
| `src/styles` | Estilos e apresentação responsiva. |
