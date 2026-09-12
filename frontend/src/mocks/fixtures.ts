import type {
  AdminDashboard,
  AdminDecisionRow,
  CaseDetail,
  CaseDocument,
  CaseStatus,
  Contradiction,
  DecisionRecord,
  DocumentStatus,
  Evidence,
  NegotiationRecord,
  Recommendation,
  RecommendationResponse,
  RiskLevel,
  SourceReference,
} from '../types';

/** Entirely synthetic demonstration data. No legal, financial or model inference runs here. */
export const DEMO_GENERATED_AT = '2026-09-12T12:00:00.000Z';
export const DEMO_POLICY_VERSION = 'politica-demo-v1.0';
export const DEMO_MODEL_VERSION = 'modelo-simulado-v1.0';

type SevenDocumentStatuses = [
  DocumentStatus,
  DocumentStatus,
  DocumentStatus,
  DocumentStatus,
  DocumentStatus,
  DocumentStatus,
  DocumentStatus,
];
interface CaseFixture {
  id: string;
  number: string;
  plaintiff: string;
  city: string;
  uf: string;
  claim: number;
  risk: RiskLevel;
  recommendation: Recommendation;
  probability: number | null;
  condemnation: number | null;
  defense: number | null;
  settlement: RecommendationResponse['settlement'];
  status: CaseStatus;
  lawyer: string;
  firm: string;
  lawyerProfileLabel: string;
  lawyerProfileDescription: string;
  officeCluster: string;
  adherenceBase: number;
  assigned: boolean;
  confidenceScore: number;
  confidenceBand: string;
  subsidyCount: number;
  criticalSubsidyCount: number;
  completenessBand: string;
  summary: string;
  allegation: string;
  contract: string;
  transfer: string;
  biometrics: string;
  bacen: string;
  statuses: SevenDocumentStatuses;
  reasons: string[];
  missing: string[];
}

const overrideReasonLabels = {
  NOVA_EVIDENCIA: 'Nova evidencia',
  ESTRATEGIA_PROCESSUAL: 'Estrategia processual',
  INFORMACAO_NAO_CONSIDERADA: 'Informacao nao considerada',
  POLITICA_INADEQUADA: 'Politica inadequada',
  OUTRO: 'Outro',
} as const;

const caseFixtures: CaseFixture[] = [
  {
    id: 'caso-1',
    number: '1004827-32.2026.8.26.0114',
    plaintiff: 'Maria Aparecida Santos',
    city: 'Campinas',
    uf: 'SP',
    claim: 20000,
    risk: 'BAIXO',
    recommendation: 'DEFESA',
    probability: 0.23,
    condemnation: 8400,
    defense: 1932,
    settlement: null,
    status: 'AGUARDANDO_DECISAO',
    lawyer: 'Marina Azevedo',
    firm: 'Prado Tavares',
    lawyerProfileLabel: 'Guardia da politica',
    lawyerProfileDescription: 'Segue a politica de forma disciplinada e diverge pouco.',
    officeCluster: 'alto desempenho',
    adherenceBase: 0.91,
    assigned: true,
    confidenceScore: 0.88,
    confidenceBand: 'Alta',
    subsidyCount: 5,
    criticalSubsidyCount: 3,
    completenessBand: 'Alta',
    summary:
      'Contestação de contratação de crédito consignado. O conjunto demonstrativo contém contrato, crédito ao titular e registros de assinatura e face; a análise humana permanece necessária.',
    allegation:
      'A autora afirma não reconhecer a contratação e contesta a autenticidade da assinatura apresentada.',
    contract:
      'Contrato demonstrativo nº CT-2026-0148, atribuído a Maria Aparecida Santos. A assinatura consta no documento; sua autenticidade é objeto da alegação.',
    transfer:
      'Comprovante MOCK registra crédito na conta identificada em nome de Maria Aparecida Santos. Os dados bancários foram inteiramente inventados para esta demonstração.',
    biometrics:
      'No cenário MOCK, similaridade da assinatura: 91%; similaridade facial: 97,3%. Esses percentuais são campos de uma fixture, não resultados de perícia ou de um modelo executado.',
    bacen:
      'Consulta BACEN MOCK atribui a conta beneficiária à autora. A consulta exibida é sintética e não foi obtida de um serviço do Banco Central.',
    statuses: [
      'PRESENTE',
      'PRESENTE',
      'PRESENTE',
      'PRESENTE',
      'PRESENTE',
      'INCONCLUSIVO',
      'PRESENTE',
    ],
    reasons: [
      'Contrato e comprovante de crédito constam no conjunto documental demonstrativo.',
      'Os indicadores simulados de assinatura (91%) e face (97,3%) favorecem a linha de defesa, sujeitos à revisão humana.',
      'A divergência sobre o reconhecimento da contratação deve ser enfrentada na contestação.',
    ],
    missing: [
      'Comprovação atualizada do endereço à época da contratação; documento disponível está inconclusivo.',
    ],
  },
  {
    id: 'caso-2',
    number: '0801634-18.2026.8.19.0001',
    plaintiff: 'José Carlos Oliveira',
    city: 'Rio de Janeiro',
    uf: 'RJ',
    claim: 25000,
    risk: 'ALTO',
    recommendation: 'ACORDO',
    probability: 0.72,
    condemnation: 10500,
    defense: 7560,
    settlement: { opening: 4500, target: 5200, ceiling: 6500 },
    status: 'AGUARDANDO_DECISAO',
    lawyer: 'Marina Azevedo',
    firm: 'Prado Tavares',
    lawyerProfileLabel: 'Guardia da politica',
    lawyerProfileDescription: 'Segue a politica de forma disciplinada e diverge pouco.',
    officeCluster: 'alto desempenho',
    adherenceBase: 0.91,
    assigned: true,
    confidenceScore: 0.59,
    confidenceBand: 'Baixa',
    subsidyCount: 4,
    criticalSubsidyCount: 2,
    completenessBand: 'Media',
    summary:
      'O autor nega a contratação e afirma não possuir conta na Caixa. A consulta BACEN do cenário atribui a conta ao tomador, mas faltam comprovação independente do crédito e prova de vida.',
    allegation:
      'O autor afirma: “Não possuo conta na Caixa e não recebi o valor do contrato questionado.” Trata-se de alegação da petição inicial demonstrativa.',
    contract:
      'Contrato demonstrativo nº CT-2026-0286, atribuído a José Carlos Oliveira. O arquivo contém dados cadastrais e registro de aceite; não comprova, isoladamente, a identidade do contratante.',
    transfer:
      'Registro interno MOCK indica envio para conta da Caixa atribuída ao tomador. Não consta recibo bancário independente ou extrato do destinatário confirmando o crédito.',
    biometrics:
      'O relatório MOCK contém uma imagem facial sem validação independente. Liveness (prova de vida): ausente. Não há resultado de prova de vida neste documento.',
    bacen:
      'Consulta BACEN MOCK atribui a conta da Caixa ao tomador José Carlos Oliveira. Essa atribuição documental contrasta com a alegação, mas não demonstra, por si só, a efetiva disponibilização do crédito.',
    statuses: [
      'PRESENTE',
      'PRESENTE',
      'INCONCLUSIVO',
      'INCONCLUSIVO',
      'PRESENTE',
      'AUSENTE',
      'PRESENTE',
    ],
    reasons: [
      'Não há comprovação independente do efetivo crédito ao tomador no conjunto demonstrativo.',
      'A prova de vida está ausente, limitando a força do registro de identificação.',
      'A consulta BACEN atribui a conta ao tomador, mas não elimina as lacunas sobre contratação e recebimento.',
    ],
    missing: [
      'Extrato do destinatário ou comprovante bancário independente de efetiva disponibilização do crédito.',
      'Relatório de liveness (prova de vida) vinculado ao momento da contratação.',
      'Comprovante de endereço à época da contratação.',
    ],
  },
  {
    id: 'caso-3',
    number: '5010382-74.2026.8.13.0024',
    plaintiff: 'Fernanda Ribeiro Costa',
    city: 'Belo Horizonte',
    uf: 'MG',
    claim: 15000,
    risk: 'MEDIO',
    recommendation: 'REVISAR',
    probability: null,
    condemnation: null,
    defense: null,
    settlement: null,
    status: 'AGUARDANDO_DECISAO',
    lawyer: 'Marina Azevedo',
    firm: 'Prado Tavares',
    lawyerProfileLabel: 'Guardia da politica',
    lawyerProfileDescription: 'Segue a politica de forma disciplinada e diverge pouco.',
    officeCluster: 'alto desempenho',
    adherenceBase: 0.91,
    assigned: true,
    confidenceScore: 0.48,
    confidenceBand: 'Baixa',
    subsidyCount: 2,
    criticalSubsidyCount: 0,
    completenessBand: 'Baixa',
    summary:
      'Documentação insuficiente para sustentar uma orientação conclusiva. O contrato integral não foi incluído e os registros de liberação e pagamentos estão inconclusivos.',
    allegation:
      'A autora questiona descontos de um contrato que afirma desconhecer e solicita a apresentação do instrumento integral.',
    contract: 'O instrumento contratual integral não foi incluído nesta fixture.',
    transfer:
      'Planilha interna MOCK menciona liberação, sem identificação suficiente da conta destinatária.',
    biometrics: 'Nenhum documento de biometria foi incluído nesta fixture.',
    bacen: 'Nenhuma consulta de titularidade foi incluída nesta fixture.',
    statuses: [
      'PRESENTE',
      'AUSENTE',
      'INCONCLUSIVO',
      'AUSENTE',
      'AUSENTE',
      'PRESENTE',
      'INCONCLUSIVO',
    ],
    reasons: [
      'O contrato integral está ausente.',
      'Os registros de liberação e pagamentos não permitem concluir sobre o recebimento.',
      'A recomendação demonstrativa solicita revisão humana antes de escolher uma estratégia.',
    ],
    missing: [
      'Contrato integral e anexos de formalização.',
      'Comprovante de liberação com titularidade do destinatário.',
      'Registros de identificação e consulta de titularidade.',
    ],
  },
  {
    id: 'caso-4',
    number: '1019204-65.2026.8.26.0100',
    plaintiff: 'Paulo Henrique Almeida',
    city: 'São Paulo',
    uf: 'SP',
    claim: 18000,
    risk: 'BAIXO',
    recommendation: 'DEFESA',
    probability: 0.31,
    condemnation: 7200,
    defense: 2232,
    settlement: null,
    status: 'DECISAO_REGISTRADA',
    lawyer: 'Gustavo Ribeiro',
    firm: 'Costa Ribeiro',
    lawyerProfileLabel: 'Orientado a meta',
    lawyerProfileDescription: 'Busca throughput e tende a seguir o fluxo padrao da politica.',
    officeCluster: 'alto desempenho',
    adherenceBase: 0.9,
    assigned: false,
    confidenceScore: 0.81,
    confidenceBand: 'Media',
    subsidyCount: 6,
    criticalSubsidyCount: 3,
    completenessBand: 'Alta',
    summary:
      'Contestação de empréstimo pessoal com contrato, registro de identificação e comprovante de crédito presentes no cenário demonstrativo.',
    allegation: 'O autor afirma não reconhecer o empréstimo e solicita a suspensão das cobranças.',
    contract:
      'Contrato MOCK nº CT-2026-0304 contém aceite e condições de um empréstimo pessoal fictício.',
    transfer: 'Comprovante MOCK indica crédito em conta atribuída a Paulo Henrique Almeida.',
    biometrics:
      'Relatório demonstrativo registra captura facial e prova de vida; nenhum modelo foi executado para este protótipo.',
    bacen: 'Consulta BACEN MOCK atribui a conta de destino ao autor; os dados são sintéticos.',
    statuses: [
      'PRESENTE',
      'PRESENTE',
      'PRESENTE',
      'PRESENTE',
      'PRESENTE',
      'PRESENTE',
      'INCONCLUSIVO',
    ],
    reasons: [
      'Contrato, identificação e comprovante de crédito estão presentes.',
      'A sequência documental favorece a defesa no cenário estático apresentado.',
    ],
    missing: ['Extrato completo do histórico de pagamentos; arquivo atual está parcial.'],
  },
  {
    id: 'caso-5',
    number: '0037618-29.2026.8.16.0014',
    plaintiff: 'Luciana Martins Ferreira',
    city: 'Londrina',
    uf: 'PR',
    claim: 22000,
    risk: 'ALTO',
    recommendation: 'ACORDO',
    probability: 0.67,
    condemnation: 9800,
    defense: 6566,
    settlement: { opening: 3800, target: 4600, ceiling: 5800 },
    status: 'EM_NEGOCIACAO',
    lawyer: 'Bianca Prado',
    firm: 'Silva Moura',
    lawyerProfileLabel: 'Pragmatica negociadora',
    lawyerProfileDescription: 'Tem vies negociador e aceita acordo com mais facilidade.',
    officeCluster: 'desempenho medio',
    adherenceBase: 0.83,
    assigned: true,
    confidenceScore: 0.61,
    confidenceBand: 'Baixa',
    subsidyCount: 4,
    criticalSubsidyCount: 2,
    completenessBand: 'Media',
    summary:
      'Formalização digital questionada. Os registros demonstrativos de identificação estão incompletos e uma proposta de acordo aguarda retorno.',
    allegation:
      'A autora questiona o aceite digital e afirma não ter participado da captura de identificação.',
    contract:
      'Contrato MOCK nº CT-2026-0331 inclui aceite eletrônico sem trilha completa de formalização.',
    transfer:
      'Registro de transferência MOCK apresenta conta de destino, mas não há confirmação independente do crédito.',
    biometrics:
      'Relatório MOCK contém captura incompleta e não permite confirmar o vínculo com o aceite.',
    bacen:
      'Consulta BACEN MOCK atribui a conta à autora, sem informação sobre o efetivo recebimento.',
    statuses: [
      'PRESENTE',
      'PRESENTE',
      'INCONCLUSIVO',
      'INCONCLUSIVO',
      'PRESENTE',
      'AUSENTE',
      'PRESENTE',
    ],
    reasons: [
      'A trilha de identificação e aceite está incompleta.',
      'O conjunto demonstrativo não contém confirmação independente do crédito.',
    ],
    missing: [
      'Trilha completa da formalização digital.',
      'Comprovação independente do recebimento do crédito.',
    ],
  },
  {
    id: 'caso-6',
    number: '5021840-92.2026.8.21.0001',
    plaintiff: 'Roberto Alves Souza',
    city: 'Porto Alegre',
    uf: 'RS',
    claim: 16000,
    risk: 'ALTO',
    recommendation: 'ACORDO',
    probability: 0.64,
    condemnation: 8000,
    defense: 5120,
    settlement: { opening: 3000, target: 3800, ceiling: 4800 },
    status: 'CONCLUIDO',
    lawyer: 'Eduardo Bastos',
    firm: 'Almeida Rocha',
    lawyerProfileLabel: 'Fechador de acordo',
    lawyerProfileDescription: 'Tem apetite alto por acordo e busca encerrar casos cedo.',
    officeCluster: 'alto desempenho',
    adherenceBase: 0.88,
    assigned: false,
    confidenceScore: 0.58,
    confidenceBand: 'Baixa',
    subsidyCount: 4,
    criticalSubsidyCount: 1,
    completenessBand: 'Media',
    summary:
      'O cenário registra acordo aceito após contestação da formalização. Os valores e a conclusão são dados de demonstração.',
    allegation: 'O autor alega descontos não reconhecidos e questiona a contratação por telefone.',
    contract:
      'Termo contratual MOCK nº CT-2026-0378 remete a uma gravação que não foi disponibilizada.',
    transfer: 'Registro interno MOCK indica liberação; o extrato independente não foi anexado.',
    biometrics: 'Não existe relatório de identificação nesta fixture.',
    bacen: 'Consulta BACEN MOCK atribui a conta de destino ao autor.',
    statuses: [
      'PRESENTE',
      'INCONCLUSIVO',
      'INCONCLUSIVO',
      'AUSENTE',
      'PRESENTE',
      'PRESENTE',
      'PRESENTE',
    ],
    reasons: [
      'A gravação referenciada pelo contrato não está disponível.',
      'Há lacunas de formalização no cenário demonstrativo.',
    ],
    missing: ['Gravação integral da contratação.', 'Comprovante independente de crédito.'],
  },
  {
    id: 'caso-7',
    number: '8002951-47.2026.8.05.0001',
    plaintiff: 'Ana Paula Nascimento',
    city: 'Salvador',
    uf: 'BA',
    claim: 30000,
    risk: 'MEDIO',
    recommendation: 'ACORDO',
    probability: 0.56,
    condemnation: 12000,
    defense: 6720,
    settlement: { opening: 4000, target: 5000, ceiling: 6200 },
    status: 'DECISAO_REGISTRADA',
    lawyer: 'Fernanda Lima',
    firm: 'Nogueira Bastos',
    lawyerProfileLabel: 'Independente',
    lawyerProfileDescription: 'Tem alta autonomia e diverge mais da recomendacao automatica.',
    officeCluster: 'autonomia alta',
    adherenceBase: 0.63,
    assigned: false,
    confidenceScore: 0.55,
    confidenceBand: 'Baixa',
    subsidyCount: 5,
    criticalSubsidyCount: 3,
    completenessBand: 'Alta',
    summary:
      'Recomendação demonstrativa de acordo com divergência registrada pelo advogado. A escolha humana de defesa não altera a recomendação original.',
    allegation:
      'A autora questiona a autenticidade do aceite e a suficiência dos documentos de contratação.',
    contract:
      'Contrato MOCK nº CT-2026-0412 contém aceite, mas o anexo de identificação está incompleto.',
    transfer: 'Comprovante MOCK registra transferência com identificação do destinatário.',
    biometrics:
      'Relatório de identificação MOCK está parcial e não permite avaliar toda a formalização.',
    bacen: 'Consulta BACEN MOCK atribui a conta de destino à autora.',
    statuses: [
      'PRESENTE',
      'PRESENTE',
      'PRESENTE',
      'INCONCLUSIVO',
      'PRESENTE',
      'PRESENTE',
      'INCONCLUSIVO',
    ],
    reasons: [
      'O anexo de identificação está incompleto.',
      'A comprovação de crédito favorece a defesa, mas não resolve a lacuna de formalização no cenário estático.',
    ],
    missing: ['Anexo integral de identificação e trilha de aceite.'],
  },
  {
    id: 'caso-8',
    number: '0706412-36.2026.8.07.0001',
    plaintiff: 'Carlos Eduardo Barros',
    city: 'Brasília',
    uf: 'DF',
    claim: 12500,
    risk: 'MEDIO',
    recommendation: 'REVISAR',
    probability: null,
    condemnation: null,
    defense: null,
    settlement: null,
    status: 'DECISAO_REGISTRADA',
    lawyer: 'Rafael Moura',
    firm: 'Duarte Fontes',
    lawyerProfileLabel: 'Cauteloso com baixa confianca',
    lawyerProfileDescription: 'Confia no modelo quando a confianca e alta, mas revisa casos cinzentos.',
    officeCluster: 'autonomia alta',
    adherenceBase: 0.66,
    assigned: false,
    confidenceScore: 0.46,
    confidenceBand: 'Baixa',
    subsidyCount: 3,
    criticalSubsidyCount: 1,
    completenessBand: 'Media',
    summary:
      'Revisão documental registrada. O contrato está parcial e a conta de destino não foi identificada de maneira suficiente.',
    allegation:
      'O autor solicita a apresentação da contratação e contesta o destino do valor informado.',
    contract:
      'Contrato MOCK nº CT-2026-0448 disponível somente em versão parcial, sem página de aceite.',
    transfer: 'Registro interno MOCK não identifica suficientemente a conta de destino.',
    biometrics: 'Não há documento de identificação biométrica nesta fixture.',
    bacen: 'Consulta MOCK sem elementos suficientes para atribuir a conta a um titular.',
    statuses: [
      'PRESENTE',
      'INCONCLUSIVO',
      'INCONCLUSIVO',
      'AUSENTE',
      'INCONCLUSIVO',
      'AUSENTE',
      'PRESENTE',
    ],
    reasons: [
      'O contrato disponível está incompleto.',
      'A titularidade da conta destinatária permanece inconclusiva.',
    ],
    missing: [
      'Contrato completo, incluindo a página de aceite.',
      'Identificação da conta destinatária e de seu titular.',
    ],
  },
];

const documentCategories = [
  ['inicial', 'Petição inicial'],
  ['contrato', 'Contrato'],
  ['credito', 'Comprovante de liberação'],
  ['biometria', 'Biometria e assinatura'],
  ['bacen', 'Consulta BACEN'],
  ['endereco', 'Comprovante de endereço'],
  ['pagamentos', 'Histórico de pagamentos'],
] as const;

function documentsFor(fixture: CaseFixture): CaseDocument[] {
  const texts = [
    fixture.summary,
    fixture.contract,
    fixture.transfer,
    fixture.biometrics,
    fixture.bacen,
    fixture.statuses[5] === 'INCONCLUSIVO'
      ? 'Comprovante MOCK com endereço parcial e sem referência temporal suficiente para a contratação.'
      : `Comprovante de endereço MOCK atribuído a ${fixture.plaintiff}, em ${fixture.city}/${fixture.uf}.`,
    fixture.statuses[6] === 'INCONCLUSIVO'
      ? 'Histórico MOCK parcial, sem conciliação suficiente de todos os pagamentos mencionados.'
      : 'Histórico de pagamentos MOCK com lançamentos fictícios. Este arquivo não comprova, isoladamente, a regularidade da contratação.',
  ];
  return documentCategories.map(([key, category], index) => {
    const status = fixture.statuses[index];
    const document: CaseDocument = {
      id: `${fixture.id}-${key}`,
      name: `${category} · MOCK`,
      category,
      status,
      page_count: status === 'AUSENTE' ? 0 : index === 0 ? 2 : 1,
      description:
        status === 'AUSENTE'
          ? 'Documento ausente no conjunto de demonstração.'
          : 'Prévia textual sintética para demonstração. Não é um PDF nem um documento processual real.',
    };
    if (status !== 'AUSENTE') {
      document.demo_pages = [
        {
          page: 1,
          title: `${category} — documento MOCK`,
          paragraphs: [
            'DADOS DE DEMONSTRAÇÃO — documento sintético, sem validade documental.',
            texts[index],
          ],
          fields: [
            { label: 'Processo fictício', value: fixture.number },
            { label: 'Parte fictícia', value: fixture.plaintiff },
          ],
        },
      ];
      if (index === 0)
        document.demo_pages.push({
          page: 2,
          title: 'Alegação da parte — MOCK',
          paragraphs: [fixture.allegation],
        });
      if (index === 3 && fixture.id === 'caso-1')
        document.demo_pages[0].fields?.push(
          { label: 'Similaridade da assinatura (simulada)', value: '91%' },
          { label: 'Similaridade facial (simulada)', value: '97,3%' },
        );
      if (index === 3 && fixture.id === 'caso-2')
        document.demo_pages[0].fields?.push({
          label: 'Liveness / prova de vida',
          value: 'Ausente',
        });
    }
    return document;
  });
}

export const demoCases: CaseDetail[] = caseFixtures.map((fixture) => ({
  case_id: fixture.id,
  case_number: fixture.number,
  plaintiff: fixture.plaintiff,
  city: fixture.city,
  uf: fixture.uf,
  claim_value: fixture.claim,
  status: fixture.status,
  risk_level: fixture.risk,
  recommendation: fixture.recommendation,
  updated_at: DEMO_GENERATED_AT,
  received_at: '2026-09-10T14:30:00.000Z',
  lawyer_name: fixture.lawyer,
  firm_name: fixture.firm,
  assigned_to_me: fixture.assigned,
  lawyer_profile_label: fixture.lawyerProfileLabel,
  lawyer_profile_description: fixture.lawyerProfileDescription,
  office_cluster: fixture.officeCluster,
  adherence_base: fixture.adherenceBase,
  subject: 'Contestação de contratação bancária',
  summary: fixture.summary,
  documents: documentsFor(fixture),
}));

function source(caseId: string, categoryIndex: number, page = 1): SourceReference {
  const document = demoCases.find((item) => item.case_id === caseId)!.documents[categoryIndex];
  const content = document.demo_pages?.find((item) => item.page === page);
  if (!content)
    throw new Error(`A fixture referencia uma página inexistente: ${document.id}, página ${page}.`);
  return {
    document_id: document.id,
    document_name: document.name,
    page,
    excerpt: content.paragraphs[content.paragraphs.length - 1],
    origin: 'MOCK · prévia textual demonstrativa; não extraído de PDF',
  };
}

function evidenceFor(fixture: CaseFixture): Evidence[] {
  const evidence: Evidence[] = [
    {
      id: `${fixture.id}-alegacao`,
      kind: 'ALEGACAO',
      title: 'Contratação questionada',
      description: fixture.allegation,
      source: source(fixture.id, 0, 2),
    },
  ];
  if (fixture.statuses[1] !== 'AUSENTE')
    evidence.push({
      id: `${fixture.id}-contrato`,
      kind: fixture.statuses[1] === 'PRESENTE' ? 'FAVORAVEL' : 'RISCO',
      title:
        fixture.statuses[1] === 'PRESENTE'
          ? 'Contrato disponível para conferência'
          : 'Contrato incompleto',
      description: fixture.contract,
      source: source(fixture.id, 1),
    });
  evidence.push({
    id: `${fixture.id}-credito`,
    kind: fixture.statuses[2] === 'PRESENTE' ? 'FAVORAVEL' : 'RISCO',
    title:
      fixture.statuses[2] === 'PRESENTE'
        ? 'Registro de crédito identificado'
        : 'Comprovação de crédito inconclusiva',
    description: fixture.transfer,
    source: source(fixture.id, 2),
  });
  if (fixture.statuses[3] !== 'AUSENTE')
    evidence.push({
      id: `${fixture.id}-identificacao`,
      kind: fixture.statuses[3] === 'PRESENTE' ? 'FAVORAVEL' : 'RISCO',
      title:
        fixture.id === 'caso-1'
          ? 'Assinatura 91% · face 97,3% (simulados)'
          : fixture.id === 'caso-2'
            ? 'Prova de vida ausente'
            : 'Registros de identificação',
      description: fixture.biometrics,
      source: source(fixture.id, 3),
    });
  if (fixture.id === 'caso-2')
    evidence.push({
      id: 'caso-2-titularidade',
      kind: 'FAVORAVEL',
      title: 'BACEN atribui a conta ao tomador',
      description: fixture.bacen,
      source: source(fixture.id, 4),
    });
  return evidence;
}

function contradictionsFor(fixture: CaseFixture): Contradiction[] {
  if (fixture.id === 'caso-2')
    return [
      {
        id: 'caso-2-conta-caixa',
        title: 'Alegação de inexistência de conta × atribuição ao tomador',
        description:
          'A atribuição de titularidade na consulta MOCK contrasta com a alegação. Ela não confirma o efetivo crédito e não resolve a ausência de comprovação independente ou de liveness.',
        allegation: {
          text: 'O autor afirma não possuir conta na Caixa.',
          source: source(fixture.id, 0, 2),
        },
        documentary_fact: {
          text: 'A consulta BACEN MOCK atribui a conta da Caixa ao tomador José Carlos Oliveira.',
          source: source(fixture.id, 4),
        },
      },
    ];
  if (fixture.id === 'caso-1')
    return [
      {
        id: 'caso-1-assinatura',
        title: 'Não reconhecimento da assinatura × registro de similaridade',
        description:
          'O relatório demonstrativo apresenta indicadores de similaridade que contrastam com a alegação. Os percentuais sintéticos não equivalem a uma conclusão pericial.',
        allegation: {
          text: 'A autora contesta a autenticidade da assinatura.',
          source: source(fixture.id, 0, 2),
        },
        documentary_fact: {
          text: 'O relatório MOCK registra similaridade de assinatura de 91% e facial de 97,3%.',
          source: source(fixture.id, 3),
        },
      },
    ];
  return [];
}

export const demoRecommendations: Record<string, RecommendationResponse> = Object.fromEntries(
  caseFixtures.map((fixture) => [
    fixture.id,
    {
      case_id: fixture.id,
      recommendation: fixture.recommendation,
      loss_probability: fixture.probability,
      expected_condemnation: fixture.condemnation,
      expected_defense_cost: fixture.defense,
      settlement: fixture.settlement,
      reasons: fixture.reasons,
      documents: demoCases.find((item) => item.case_id === fixture.id)!.documents,
      evidence: evidenceFor(fixture),
      contradictions: contradictionsFor(fixture),
      missing_evidence: fixture.missing,
      next_best_evidence: {
        title:
          fixture.id === 'caso-2'
            ? 'Obter comprovação independente do crédito'
            : fixture.recommendation === 'REVISAR'
              ? 'Completar a documentação de contratação'
              : 'Complementar a evidência documental',
        description: fixture.missing[0],
        simulation: {
          hypothesis:
            'SIMULAÇÃO: considerar a obtenção e a validação humana do documento indicado.',
          outcome:
            'SIMULAÇÃO ilustrativa: a nova evidência poderia subsidiar uma revisão. Este protótipo não estima impacto, executa modelo ou altera a recomendação.',
        },
      },
      policy_version: DEMO_POLICY_VERSION,
      model_version: DEMO_MODEL_VERSION,
      generated_at: DEMO_GENERATED_AT,
      demo_data: true,
      confidence_score: fixture.confidenceScore,
      confidence_band: fixture.confidenceBand,
      subsidy_count: fixture.subsidyCount,
      critical_subsidy_count: fixture.criticalSubsidyCount,
      completeness_band: fixture.completenessBand,
    },
  ]),
);

export const demoDecisions: DecisionRecord[] = [
  {
    id: 'demo-decisao-4',
    case_id: 'caso-4',
    recommendation: 'DEFESA',
    decision: 'DEFESA',
    is_override: false,
    notes: 'Registro de demonstração: documentação conferida.',
    policy_version: DEMO_POLICY_VERSION,
    created_at: '2026-09-11T11:10:00.000Z',
  },
  {
    id: 'demo-decisao-5',
    case_id: 'caso-5',
    recommendation: 'ACORDO',
    decision: 'ACORDO',
    is_override: false,
    notes: 'Registro de demonstração: seguir com tentativa de acordo.',
    policy_version: DEMO_POLICY_VERSION,
    created_at: '2026-09-11T13:20:00.000Z',
  },
  {
    id: 'demo-decisao-6',
    case_id: 'caso-6',
    recommendation: 'ACORDO',
    decision: 'ACORDO',
    is_override: false,
    notes: 'Registro de demonstração.',
    policy_version: DEMO_POLICY_VERSION,
    created_at: '2026-09-10T10:00:00.000Z',
  },
  {
    id: 'demo-decisao-7',
    case_id: 'caso-7',
    recommendation: 'ACORDO',
    decision: 'DEFESA',
    is_override: true,
    reason: 'ESTRATEGIA_PROCESSUAL',
    justification:
      'Divergência demonstrativa: o advogado registra a escolha de defesa após revisão da estratégia processual.',
    policy_version: DEMO_POLICY_VERSION,
    created_at: '2026-09-11T16:40:00.000Z',
  },
  {
    id: 'demo-decisao-8',
    case_id: 'caso-8',
    recommendation: 'REVISAR',
    decision: 'REVISAR',
    is_override: false,
    notes: 'Registro de demonstração: solicitar complementação documental.',
    policy_version: DEMO_POLICY_VERSION,
    created_at: '2026-09-12T09:15:00.000Z',
  },
];

export const demoNegotiations: NegotiationRecord[] = [
  {
    id: 'demo-negociacao-5',
    case_id: 'caso-5',
    proposal_value: 3800,
    status: 'PENDENTE',
    notes: 'Proposta fictícia aguardando retorno.',
    updated_at: '2026-09-11T14:00:00.000Z',
  },
  {
    id: 'demo-negociacao-6',
    case_id: 'caso-6',
    proposal_value: 3800,
    status: 'ACEITA',
    final_value: 3800,
    notes: 'Acordo fictício aceito para demonstração do fluxo concluído.',
    updated_at: '2026-09-11T15:30:00.000Z',
  },
];

const demoAdminRows: AdminDecisionRow[] = demoDecisions.map((decision) => {
  const caseDetail = demoCases.find((item) => item.case_id === decision.case_id)!;
  const negotiation = demoNegotiations.find((item) => item.case_id === decision.case_id);
  return {
    id: decision.id,
    case_id: decision.case_id,
    case_number: caseDetail.case_number,
    plaintiff: caseDetail.plaintiff,
    lawyer_name: caseDetail.lawyer_name,
    firm_name: caseDetail.firm_name,
    uf: caseDetail.uf,
    recommendation: decision.recommendation,
    decision: decision.decision,
    adherent: !decision.is_override,
    suggested_value: demoRecommendations[decision.case_id].settlement?.target ?? null,
    realized_value: negotiation?.status === 'ACEITA' ? (negotiation.final_value ?? null) : null,
    status: negotiation?.status ?? 'DECISAO_REGISTRADA',
    created_at: decision.created_at,
    is_local: false,
    ...(decision.justification ? { justification: decision.justification } : {}),
  };
});

/** Aggregate indicators and charts are a fixed, larger DEMO scenario, not totals of the table. */
export const demoAdminDashboard: AdminDashboard = {
  demo_data: true,
  period: 'Setembro de 2026 · cenário demonstrativo',
  updated_at: DEMO_GENERATED_AT,
  metrics: {
    decisions: 128,
    adherence_rate: 0.84375,
    overrides: 20,
    settlements: 71,
    acceptance_rate: 0.725,
    average_closed_value: 4320,
    average_offered_value: 5100,
    rejected: 17,
    counteroffers: 10,
    projected_cost: 306720,
  },
  distribution: [
    { label: 'Acordo', value: 71, percentage: 0.5547 },
    { label: 'Defesa', value: 43, percentage: 0.3359 },
    { label: 'Revisar', value: 14, percentage: 0.1094 },
  ],
  evolution: [
    { label: 'Abr', agreement: 32, defense: 24 },
    { label: 'Mai', agreement: 41, defense: 29 },
    { label: 'Jun', agreement: 48, defense: 31 },
    { label: 'Jul', agreement: 54, defense: 35 },
    { label: 'Ago', agreement: 63, defense: 39 },
    { label: 'Set', agreement: 71, defense: 43 },
  ],
  override_reasons: [
    { label: 'Nova evidência', value: 8, percentage: 0.4 },
    { label: 'Estratégia processual', value: 6, percentage: 0.3 },
    { label: 'Informação não considerada', value: 3, percentage: 0.15 },
    { label: 'Política inadequada', value: 2, percentage: 0.1 },
    { label: 'Outro', value: 1, percentage: 0.05 },
  ],
  historical_simulation: {
    sample_size: 100,
    acceptance_assumption: 0.7,
    baseline_cost: 980000,
    projected_cost: 652000,
    estimated_savings: 328000,
    description:
      'SIMULAÇÃO HISTÓRICA independente: amostra, taxa de aceitação e custos são premissas fictícias fixas. A economia estimada é ilustrativa, não realizada, e não é recalculada a partir das decisões registradas neste navegador.',
  },
  decisions: demoAdminRows,
};
