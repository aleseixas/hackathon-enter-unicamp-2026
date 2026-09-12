import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CircleHelp,
  FileSearch,
  MapPin,
  Scale,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { getCase, getDecision, getNegotiation, getRecommendation } from '../services/api';
import type { CaseDocument, RecommendationResponse, SourceReference } from '../types';
import { useAsync } from '../hooks/useAsync';
import { money, percent, shortDate } from '../lib/format';
import { markCaseAsViewed } from '../lib/caseProgress';
import { Badge, ErrorState, LoadingState, Notice, Provenance } from '../components/ui';
import { DocumentsPanel, DocumentViewer, EvidencePanel } from '../components/Evidence';
import { DecisionActions, NegotiationPanel } from '../components/DecisionActions';
import '../styles/workspace.css';

function RecommendationCard({
  data,
  claimValue,
  actions,
}: {
  data: RecommendationResponse;
  claimValue: number;
  actions: ReactNode;
}) {
  const review = data.recommendation === 'REVISAR';
  return (
    <>
      <div className={`recommendation-card recommendation-${data.recommendation.toLowerCase()}`}>
        <div className="recommendation-eyebrow">
          <span>
            <Sparkles size={13} />
            Recomendação
          </span>
          <span className="rec-status-dot" />
        </div>
        <div className="recommendation-title">
          <h2>{data.recommendation}</h2>
          {review ? (
            <FileSearch size={27} />
          ) : data.recommendation === 'DEFESA' ? (
            <ShieldCheck size={27} />
          ) : (
            <Scale size={27} />
          )}
        </div>
        <p className="recommendation-subtitle">
          {review
            ? 'Uma análise mais próxima faz a diferença.'
            : data.recommendation === 'DEFESA'
              ? 'Prosseguir com a defesa judicial, sem acordo neste momento.'
              : 'Um caminho para resolver este caso.'}
        </p>
        <div className="recommendation-key-facts">
          <div>
            <span>Valor da causa</span>
            <strong>{money(claimValue)}</strong>
          </div>
          {data.loss_probability !== null && (
            <div>
              <span>Risco estimado de perda</span>
              <strong>{percent(data.loss_probability)}</strong>
            </div>
          )}
        </div>
        {review && (
          <div className="review-message">
            <TriangleAlert size={17} />
            <p>Há evidências conflitantes ou insuficientes para uma recomendação conclusiva.</p>
          </div>
        )}
      </div>
      {actions}
      <div className="recommendation-rationale">
        <h3>Por que esta é a melhor opção agora</h3>
        {data.reasons.slice(0, 3).map((reason) => (
          <p key={reason}>
            <Check size={13} />
            <span>{reason}</span>
          </p>
        ))}
      </div>
      {data.missing_evidence.length > 0 && (
        <div className="missing-evidence">
          <h3>
            <CircleHelp size={14} />
            Ponto de atenção
          </h3>
          <ul>
            {data.missing_evidence.slice(0, 1).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default function WorkspacePage() {
  const { caseId = '' } = useParams();
  const loader = useCallback(async () => {
    const [caseDetail, recommendation, decision, negotiation] = await Promise.all([
      getCase(caseId),
      getRecommendation(caseId),
      getDecision(caseId),
      getNegotiation(caseId),
    ]);
    return { caseDetail, recommendation, decision, negotiation };
  }, [caseId]);
  const { data, loading, error, reload } = useAsync(loader);
  const [viewer, setViewer] = useState<{ document: CaseDocument; page: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'evidences' | 'documents' | 'details'>('evidences');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'warning'>('success');
  useEffect(() => {
    const resetFeedback = (event: Event) => {
      if ((event as CustomEvent).detail?.action === 'reset') {
        setMessage('');
        setViewer(null);
      }
    };
    window.addEventListener('policy:data-changed', resetFeedback);
    return () => window.removeEventListener('policy:data-changed', resetFeedback);
  }, []);
  useEffect(() => {
    if (data?.caseDetail.case_id) markCaseAsViewed(data.caseDetail.case_id);
  }, [data?.caseDetail.case_id]);
  if (loading && !data) return <LoadingState />;
  if (error)
    return (
      <>
        <Link className="back-link" to="/minha-fila">
          <ArrowLeft size={14} />
          Voltar à minha fila
        </Link>
        <ErrorState message={error} onRetry={reload} />
      </>
    );
  if (!data) return null;
  const { caseDetail, recommendation, decision, negotiation } = data;
  function viewSource(source: SourceReference) {
    const document = recommendation.documents.find((item) => item.id === source.document_id);
    if (document && document.status !== 'AUSENTE') setViewer({ document, page: source.page });
    else {
      setMessageTone('warning');
      setMessage('O documento desta fonte ainda não está disponível no acervo.');
    }
  }
  function saved(text: string) {
    setMessageTone('success');
    setMessage(text);
    reload();
  }
  return (
    <div className="workspace-page page-enter" key={caseId}>
      <header className="workspace-header">
        <div className="workspace-topline">
          <Link className="back-link" to="/minha-fila">
            <ArrowLeft size={14} />
            Minha fila
          </Link>
          <span className="workspace-case-reference">{caseDetail.case_number}</span>
          <div className="workspace-header-badges">
            <Badge value={caseDetail.status} />
          </div>
        </div>
        <div className="workspace-title-row">
          <div>
            <div className="eyebrow">Análise do processo</div>
            <h1>{caseDetail.plaintiff}</h1>
            <div className="workspace-meta">
              <span>
                <MapPin size={12} />
                {caseDetail.city} / {caseDetail.uf}
              </span>
              <span className="meta-separator" />
              <span>
                Valor da causa <strong>{money(caseDetail.claim_value)}</strong>
              </span>
              <span className="meta-separator" />
              <Badge value={caseDetail.risk_level} />
            </div>
          </div>
        </div>
      </header>
      {message && (
        <div className="workspace-feedback">
          <Notice tone={messageTone}>{message}</Notice>
          <button
            className="icon-button"
            onClick={() => setMessage('')}
            aria-label="Dispensar mensagem"
          >
            ×
          </button>
        </div>
      )}
      <div className="workspace-decision-overview">
        <section className="case-context case-context-brief">
          <div>
            <span className="context-icon" aria-hidden="true">
              <Scale size={17} />
            </span>
            <span className="eyebrow">PROCESSO</span>
          </div>
          <h2>{caseDetail.subject}</h2>
          <p>{caseDetail.summary}</p>
        </section>
        <aside className="workspace-recommendation" aria-label="Recomendação e decisão">
          <section className="panel decision-panel">
            <RecommendationCard
              data={recommendation}
              claimValue={caseDetail.claim_value}
              actions={
                <DecisionActions
                  key={`${caseId}-${decision?.id || 'pending'}`}
                  recommendation={recommendation}
                  decision={decision}
                  negotiation={negotiation}
                  onSaved={saved}
                />
              }
            />
          </section>
          {decision?.decision === 'ACORDO' && (
            <NegotiationPanel
              key={caseId}
              recommendation={recommendation}
              negotiation={negotiation}
              onSaved={saved}
            />
          )}
        </aside>
      </div>
      <nav className="workspace-content-tabs" aria-label="Conteúdo do processo">
        <button className={activeTab === 'evidences' ? 'active' : ''} onClick={() => setActiveTab('evidences')}>
          Evidências
        </button>
        <button className={activeTab === 'documents' ? 'active' : ''} onClick={() => setActiveTab('documents')}>
          Documentos
        </button>
        <button className={activeTab === 'details' ? 'active' : ''} onClick={() => setActiveTab('details')}>
          Detalhes
        </button>
      </nav>
      <section className="workspace-tab-content">
        {activeTab === 'evidences' && (
          <EvidencePanel key={caseId} recommendation={recommendation} onViewSource={viewSource} />
        )}
        {activeTab === 'documents' && (
          <DocumentsPanel
            documents={recommendation.documents}
            onOpen={(document, page = 1) => setViewer({ document, page })}
          />
        )}
        {activeTab === 'details' && (
          <section className="panel case-details-panel">
            <div className="panel-heading">
              <h2>Detalhes do processo</h2>
              {recommendation.demo_data && <Badge value="DEMO" />}
            </div>
            <div className="case-details-body">
              <dl className="cost-summary">
                {recommendation.expected_condemnation !== null && (
                  <div>
                    <dt>Condenação esperada</dt>
                    <dd>{money(recommendation.expected_condemnation)}</dd>
                  </div>
                )}
                {recommendation.expected_defense_cost !== null && (
                  <div>
                    <dt>Custo esperado da defesa</dt>
                    <dd>{money(recommendation.expected_defense_cost)}</dd>
                  </div>
                )}
                {recommendation.confidence_score !== undefined && (
                  <div>
                    <dt>Confianca da recomendacao</dt>
                    <dd>{percent(recommendation.confidence_score)}</dd>
                  </div>
                )}
                {recommendation.subsidy_count !== undefined && (
                  <div>
                    <dt>Subsidios considerados</dt>
                    <dd>
                      {recommendation.subsidy_count}
                      {recommendation.critical_subsidy_count !== undefined
                        ? ` (${recommendation.critical_subsidy_count} criticos)`
                        : ''}
                    </dd>
                  </div>
                )}
                {recommendation.completeness_band && (
                  <div>
                    <dt>Completude documental</dt>
                    <dd>{recommendation.completeness_band}</dd>
                  </div>
                )}
                {caseDetail.lawyer_profile_label && (
                  <div>
                    <dt>Perfil sintetico</dt>
                    <dd>{caseDetail.lawyer_profile_label}</dd>
                  </div>
                )}
              </dl>
              <div className="recommendation-provenance">
                <Provenance policy={recommendation.policy_version} model={recommendation.model_version} />
              </div>
              {caseDetail.lawyer_profile_description && (
                <div className="decision-authority">
                  <ShieldCheck size={16} />
                  <p>
                    Perfil comportamental da demo: <strong>{caseDetail.lawyer_profile_label}</strong>.{' '}
                    {caseDetail.lawyer_profile_description}
                  </p>
                </div>
              )}
              <div className="decision-authority">
                <ShieldCheck size={16} />
                <p>
                  A política orienta. <strong>O advogado decide.</strong>
                </p>
              </div>
              <span className="details-updated">Análise recebida em {shortDate(recommendation.generated_at)}</span>
            </div>
          </section>
        )}
      </section>
      {viewer && (
        <DocumentViewer
          key={`${viewer.document.id}-${viewer.page}`}
          document={viewer.document}
          initialPage={viewer.page}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
