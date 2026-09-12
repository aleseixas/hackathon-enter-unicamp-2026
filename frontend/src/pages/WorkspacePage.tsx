import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleHelp,
  Clock3,
  FileCheck2,
  FileSearch,
  Files,
  ListChecks,
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
import { Badge, ErrorState, LoadingState, Notice, Provenance } from '../components/ui';
import { DocumentsPanel, DocumentViewer, EvidencePanel } from '../components/Evidence';
import { DecisionActions, NegotiationPanel } from '../components/DecisionActions';
import '../styles/workspace.css';

function RecommendationCard({
  data,
  actions,
}: {
  data: RecommendationResponse;
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
              ? 'Evidências que sustentam a defesa.'
              : 'Um caminho para resolver este caso.'}
        </p>
        {data.loss_probability !== null && (
          <div className="risk-summary">
            <div>
              <span>Risco estimado de perda</span>
              <strong>{percent(data.loss_probability)}</strong>
            </div>
            <span className="risk-caption">Estimativa da análise recebida</span>
          </div>
        )}
        {review && (
          <div className="review-message">
            <TriangleAlert size={17} />
            <p>Há evidências conflitantes ou insuficientes para uma recomendação conclusiva.</p>
          </div>
        )}
        <dl className="cost-summary">
          {data.expected_condemnation !== null && (
            <div>
              <dt>Condenação esperada</dt>
              <dd>{money(data.expected_condemnation)}</dd>
            </div>
          )}
          {data.expected_defense_cost !== null && (
            <div>
              <dt>Custo esperado da defesa</dt>
              <dd>{money(data.expected_defense_cost)}</dd>
            </div>
          )}
        </dl>
        {data.recommendation === 'ACORDO' && data.settlement && (
          <div className="settlement-range">
            <span className="rec-section-label">Faixa de negociação</span>
            <div>
              <span>Abertura</span>
              <strong>{money(data.settlement.opening)}</strong>
            </div>
            <div className="settlement-target">
              <span>
                Alvo <ArrowUpRight size={12} />
              </span>
              <strong>{money(data.settlement.target)}</strong>
            </div>
            <div>
              <span>Teto</span>
              <strong>{money(data.settlement.ceiling)}</strong>
            </div>
          </div>
        )}
      </div>
      {actions}
      <div className="recommendation-rationale">
        <h3>Por que esta recomendação?</h3>
        {data.reasons.map((reason) => (
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
            Informações a confirmar
          </h3>
          <ul>
            {data.missing_evidence.map((item) => (
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
            {recommendation.demo_data && <Badge value="DEMO" />}
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
          <div className="workspace-updated">
            <Clock3 size={13} />
            <span>
              Análise recebida
              <br />
              <strong>{shortDate(recommendation.generated_at)}</strong>
            </span>
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
      <nav className="workspace-steps" aria-label="Passos para analisar o processo">
        <div className="workspace-steps-title">
          <span>COMO ANALISAR</span>
          <strong>Siga esta ordem</strong>
        </div>
        <a href="#passo-entender">
          <span className="workspace-step-number">1</span>
          <span>
            <strong>Entenda o caso</strong>
            <small>Leia o resumo</small>
          </span>
          <ListChecks size={18} aria-hidden="true" />
        </a>
        <a href="#passo-provas">
          <span className="workspace-step-number">2</span>
          <span>
            <strong>Confira as provas</strong>
            <small>Abra as fontes</small>
          </span>
          <Files size={18} aria-hidden="true" />
        </a>
        <a href="#passo-decisao">
          <span className="workspace-step-number">3</span>
          <span>
            <strong>Registre a decisão</strong>
            <small>Salve sua escolha</small>
          </span>
          <FileCheck2 size={18} aria-hidden="true" />
        </a>
      </nav>
      <div className="workspace-grid">
        <div className="workspace-review">
          <section className="case-context" id="passo-entender">
            <div>
              <span className="workspace-step-number">1</span>
              <span className="context-icon" aria-hidden="true">
                <Scale size={17} />
              </span>
              <span className="eyebrow">PRIMEIRO: ENTENDA O CASO</span>
            </div>
            <h2>{caseDetail.subject}</h2>
            <p>{caseDetail.summary}</p>
          </section>
          <section className="workspace-proof-step" id="passo-provas">
            <div className="workspace-section-heading">
              <span className="workspace-step-number">2</span>
              <div>
                <span>DEPOIS: CONFIRA AS PROVAS</span>
                <h2>Abra os documentos e confira os pontos importantes</h2>
                <p>Clique em uma fonte sempre que quiser conferir de onde veio a informação.</p>
              </div>
            </div>
            <DocumentsPanel
              documents={recommendation.documents}
              onOpen={(document, page = 1) => setViewer({ document, page })}
            />
            <div className="workspace-evidence">
              <EvidencePanel
                key={caseId}
                recommendation={recommendation}
                onViewSource={viewSource}
              />
            </div>
          </section>
        </div>
        <aside
          className="workspace-recommendation"
          id="passo-decisao"
          aria-label="Recomendação e decisão"
        >
          <div className="workspace-section-heading decision-step-heading">
            <span className="workspace-step-number">3</span>
            <div>
              <span>POR ÚLTIMO: DECIDA</span>
              <h2>Escolha o próximo passo</h2>
              <p>Veja a recomendação e salve a sua decisão.</p>
            </div>
          </div>
          <section className="panel decision-panel">
            <RecommendationCard
              data={recommendation}
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
            <div className="recommendation-provenance">
              <Provenance
                policy={recommendation.policy_version}
                model={recommendation.model_version}
              />
            </div>
          </section>
          {decision?.decision === 'ACORDO' && (
            <NegotiationPanel
              key={caseId}
              recommendation={recommendation}
              negotiation={negotiation}
              onSaved={saved}
            />
          )}
          <div className="decision-authority">
            <ShieldCheck size={16} />
            <p>
              A política orienta.
              <br />
              <strong>O advogado decide.</strong>
            </p>
          </div>
        </aside>
      </div>
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
