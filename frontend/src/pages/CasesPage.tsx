import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  Clock3,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { getCases, getDecision, getNegotiation } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { Badge, ErrorState, LoadingState } from '../components/ui';
import { money } from '../lib/format';
import { getLawyerCaseState, getViewedCaseIds, type LawyerCaseState } from '../lib/caseProgress';
import type { CaseSummary, DecisionRecord, NegotiationRecord } from '../types';

type ListMode = 'queue' | 'history';
type CaseWithWorkflow = CaseSummary & {
  decision: DecisionRecord | null;
  negotiation: NegotiationRecord | null;
};

const historyTabs: { id: 'all' | LawyerCaseState; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'NOVO', label: 'Novos' },
  { id: 'VISUALIZADO', label: 'Visualizados' },
  { id: 'DECISAO_REGISTRADA', label: 'Decisão registrada' },
  { id: 'EM_NEGOCIACAO', label: 'Em negociação' },
  { id: 'CONCLUIDO', label: 'Concluídos' },
];

const statePresentation: Record<LawyerCaseState, { label: string; cta: string }> = {
  NOVO: { label: 'Novo', cta: 'Analisar agora' },
  VISUALIZADO: { label: 'Visualizado', cta: 'Continuar análise' },
  DECISAO_REGISTRADA: { label: 'Decisão registrada', cta: 'Ver decisão' },
  EM_NEGOCIACAO: { label: 'Em negociação', cta: 'Continuar negociação' },
  CONCLUIDO: { label: 'Concluído', cta: 'Ver processo' },
};

function needsLawyerAction(item: CaseWithWorkflow) {
  if (item.status === 'AGUARDANDO_DECISAO' || item.status === 'EM_NEGOCIACAO') return true;
  return (
    item.status === 'DECISAO_REGISTRADA' &&
    item.decision?.decision === 'ACORDO' &&
    !item.negotiation
  );
}

function presentationFor(item: CaseWithWorkflow, state: LawyerCaseState) {
  if (
    state === 'DECISAO_REGISTRADA' &&
    item.decision?.decision === 'ACORDO' &&
    !item.negotiation
  ) {
    return { label: 'Decisão registrada', cta: 'Registrar proposta' };
  }
  return statePresentation[state];
}

export default function CasesPage({ mode = 'history' }: { mode?: ListMode }) {
  const loader = useCallback(async () => {
    const cases = await getCases();
    return Promise.all(
      cases.map(async (item): Promise<CaseWithWorkflow> => {
        const [decision, negotiation] = await Promise.all([
          getDecision(item.case_id),
          getNegotiation(item.case_id),
        ]);
        return { ...item, decision, negotiation };
      }),
    );
  }, []);
  const { data: cases, loading, error, reload } = useAsync(loader);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | LawyerCaseState>('all');
  const [uf, setUf] = useState('all');
  const [recommendation, setRecommendation] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const isQueue = mode === 'queue';
  const viewedCaseIds = getViewedCaseIds();
  const source = useMemo(
    () => (cases || []).filter((item) => item.assigned_to_me),
    [cases],
  );
  const caseStates = new Map(
    source.map((item) => [
      item.case_id,
      getLawyerCaseState(item.case_id, item.status, viewedCaseIds),
    ]),
  );
  const available = useMemo(
    () => (isQueue ? source.filter(needsLawyerAction) : source),
    [isQueue, source],
  );
  const filtered = available.filter(
    (item) =>
      (isQueue || tab === 'all' || caseStates.get(item.case_id) === tab) &&
      (uf === 'all' || item.uf === uf) &&
      (recommendation === 'all' || item.recommendation === recommendation) &&
      `${item.plaintiff} ${item.case_number} ${item.city} ${item.uf}`
        .toLocaleLowerCase('pt-BR')
        .includes(query.toLocaleLowerCase('pt-BR')),
  );
  const nextCase =
    available.find((item) => caseStates.get(item.case_id) === 'VISUALIZADO') ??
    available.find((item) => caseStates.get(item.case_id) === 'NOVO') ??
    available.find((item) => item.status === 'EM_NEGOCIACAO') ??
    available[0];
  const newCount = available.filter((item) => caseStates.get(item.case_id) === 'NOVO').length;
  const negotiationCount = available.filter(
    (item) => item.status === 'EM_NEGOCIACAO' || item.decision?.decision === 'ACORDO',
  ).length;

  if (loading && !cases) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  function clearFilters() {
    setUf('all');
    setRecommendation('all');
    setQuery('');
    setTab('all');
  }

  return (
    <div className={`cases-page page-enter ${isQueue ? 'is-action-queue' : 'is-history'}`}>
      <div className="page-header lawyer-list-header">
        <div>
          <div className="eyebrow">
            <span className="accent-square" />
            MESA DO ADVOGADO
          </div>
          <h1 className="page-title">{isQueue ? 'Minha fila' : 'Meus processos'}</h1>
        </div>
        <div className="header-meta">
          <Badge value="DEMO" />
          <span>Banco Unicamp · Consignado</span>
        </div>
      </div>

      {isQueue && nextCase && (
        <section className="queue-focus" aria-labelledby="queue-focus-title">
          <span className="queue-focus-icon" aria-hidden="true">
            <Clock3 size={24} />
          </span>
          <div className="queue-focus-copy">
            <span className="queue-focus-label">PRÓXIMA AÇÃO</span>
            <h2 id="queue-focus-title">
              {available.length} {available.length === 1 ? 'caso precisa' : 'casos precisam'} da sua ação
            </h2>
            <div className="queue-focus-summary">
              <span>{newCount} {newCount === 1 ? 'novo' : 'novos'}</span>
              <span>{negotiationCount} em fluxo de acordo</span>
            </div>
          </div>
          <div className="queue-focus-case">
            <span>Comece por</span>
            <strong>{nextCase.plaintiff}</strong>
            <small>{nextCase.case_number}</small>
          </div>
          <Link
            className="button accent queue-focus-button"
            to={`/processos/${nextCase.case_id}`}
            aria-label={`Próxima ação: ${presentationFor(nextCase, caseStates.get(nextCase.case_id) ?? 'NOVO').cta} no processo de ${nextCase.plaintiff}`}
          >
            {presentationFor(nextCase, caseStates.get(nextCase.case_id) ?? 'NOVO').cta}
            <ArrowRight size={19} aria-hidden="true" />
          </Link>
        </section>
      )}

      <section className="panel case-list-panel">
        <div className="case-list-heading">
          <div>
            <h2>{isQueue ? 'Casos que exigem sua ação' : 'Histórico de processos'}</h2>
          </div>
          <span className="table-count">
            {available.length} {available.length === 1 ? 'processo' : 'processos'}
          </span>
        </div>
        {!isQueue && (
          <div className="case-tabs" aria-label="Filtrar por situação">
            {historyTabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={tab === item.id ? 'selected' : ''}
                aria-pressed={tab === item.id}
              >
                {item.label}
                {item.id !== 'all' && (
                  <span>{available.filter((row) => caseStates.get(row.case_id) === item.id).length}</span>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="table-toolbar">
          <label className="search-input">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por autor, processo ou UF"
              aria-label="Buscar processos"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Limpar busca">×</button>
            )}
          </label>
          <button
            className={`button secondary ${showFilters ? 'is-selected' : ''}`}
            aria-expanded={showFilters}
            onClick={() => setShowFilters((value) => !value)}
          >
            <SlidersHorizontal size={17} />
            Filtros
            {(uf !== 'all' || recommendation !== 'all') && <span className="active-filter-dot" />}
          </button>
        </div>
        {showFilters && (
          <div className="filter-row">
            <label className="field">
              UF
              <select className="select" value={uf} onChange={(event) => setUf(event.target.value)}>
                <option value="all">Todas as UFs</option>
                {[...new Set(available.map((item) => item.uf))].sort().map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Recomendação
              <select
                className="select"
                value={recommendation}
                onChange={(event) => setRecommendation(event.target.value)}
              >
                <option value="all">Todas as recomendações</option>
                <option value="ACORDO">Acordo</option>
                <option value="DEFESA">Defesa</option>
                <option value="REVISAR">Revisar</option>
              </select>
            </label>
            <button className="button ghost" onClick={clearFilters}>Limpar filtros</button>
          </div>
        )}
        <div className="table-scroll">
          <table className="cases-table">
            <thead>
              <tr>
                <th>Processo / Autor</th>
                <th>Valor da causa</th>
                <th>Risco</th>
                <th>Recomendação</th>
                <th>Situação</th>
                <th><span className="sr-only">Ação</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const state = caseStates.get(item.case_id) ?? 'NOVO';
                const presentation = presentationFor(item, state);
                return (
                  <tr key={item.case_id} className={needsLawyerAction(item) ? 'case-needs-action' : undefined}>
                    <td>
                      <Link className="case-person" to={`/processos/${item.case_id}`}>
                        {item.plaintiff}<ArrowUpRight size={15} />
                      </Link>
                      <span className="case-number">{item.case_number}</span>
                      <span className="case-city">{item.city} <span>·</span> {item.uf}</span>
                    </td>
                    <td className="money-cell">
                      <span className="mobile-cell-label">Valor da causa</span>
                      {money(item.claim_value, true)}
                    </td>
                    <td><span className="mobile-cell-label">Risco</span><Badge value={item.risk_level} /></td>
                    <td><span className="mobile-cell-label">Recomendação</span><Badge value={item.recommendation} /></td>
                    <td>
                      <span className="mobile-cell-label">Situação</span>
                      <span className={`case-status status-${state.toLowerCase()}`}><span />{presentation.label}</span>
                    </td>
                    <td>
                      <Link
                        className="open-case"
                        to={`/processos/${item.case_id}`}
                        aria-label={`${presentation.cta}: processo de ${item.plaintiff}`}
                      >
                        {presentation.cta}<ArrowRight size={17} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className={`empty-state ${isQueue && available.length === 0 ? 'queue-complete' : ''}`}>
            {isQueue && available.length === 0 ? <CheckCheck size={34} /> : <Search size={28} />}
            <h3>{isQueue && available.length === 0 ? 'Sua fila está em dia' : 'Nenhum processo encontrado'}</h3>
            <p>
              {isQueue && available.length === 0
                ? 'Nenhum caso exige sua ação agora. Consulte o histórico em Meus processos.'
                : 'Experimente outro nome ou ajuste os filtros.'}
            </p>
            {available.length > 0 && (
              <button className="button secondary" onClick={clearFilters}>Limpar filtros</button>
            )}
          </div>
        )}
        <div className="table-footer">
          <span>{filtered.length} de {available.length} processos</span>
          <span><CheckCheck size={14} /> Cada ação fica registrada</span>
        </div>
      </section>
    </div>
  );
}
