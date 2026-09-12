import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  Clock3,
  FileCheck2,
  Files,
  Handshake,
  MousePointerClick,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { getCases } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { Badge, ErrorState, LoadingState } from '../components/ui';
import { money } from '../lib/format';
import { getLawyerCaseState, getViewedCaseIds, type LawyerCaseState } from '../lib/caseProgress';

const tabs: { id: 'all' | LawyerCaseState; label: string }[] = [
  { id: 'all', label: 'Todos os processos' },
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

export default function CasesPage({ mine = false }: { mine?: boolean }) {
  const { data: cases, loading, error, reload } = useAsync(getCases);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [uf, setUf] = useState('all');
  const [recommendation, setRecommendation] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const available = useMemo(
    () => (cases || []).filter((item) => !mine || item.assigned_to_me),
    [cases, mine],
  );
  const viewedCaseIds = getViewedCaseIds();
  const caseStates = new Map(
    available.map((item) => [
      item.case_id,
      getLawyerCaseState(item.case_id, item.status, viewedCaseIds),
    ]),
  );
  const filtered = available.filter(
    (item) =>
      (tab === 'all' || caseStates.get(item.case_id) === tab) &&
      (uf === 'all' || item.uf === uf) &&
      (recommendation === 'all' || item.recommendation === recommendation) &&
      `${item.plaintiff} ${item.case_number} ${item.city} ${item.uf}`
        .toLocaleLowerCase('pt-BR')
        .includes(query.toLocaleLowerCase('pt-BR')),
  );
  const nextCase =
    available.find((item) => caseStates.get(item.case_id) === 'NOVO') ??
    available.find((item) => caseStates.get(item.case_id) === 'VISUALIZADO');
  if (loading && !cases) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="cases-page page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <span className="accent-square" />
            MESA DO ADVOGADO
          </div>
          <h1 className="page-title">{mine ? 'Meus processos' : 'Todos os processos'}</h1>
          <p className="page-description">
            {mine
              ? 'Esta é a sua fila. Comece por um processo que está aguardando decisão.'
              : 'Consulte todos os processos ou use os filtros para encontrar um caso.'}
          </p>
        </div>
        <div className="header-meta">
          <Badge value="DEMO" />
          <span>Banco Unicamp · Consignado</span>
        </div>
      </div>
      <section className="quick-start" aria-labelledby="quick-start-title">
        <div className="quick-start-heading">
          <span className="quick-start-icon">
            <MousePointerClick size={22} aria-hidden="true" />
          </span>
          <div>
            <span className="quick-start-label">COMECE AQUI</span>
            <h2 id="quick-start-title">Analise um processo em três passos simples</h2>
            <p>O sistema mostra o caminho. Você pode voltar e conferir tudo antes de salvar.</p>
          </div>
        </div>
        <ol className="quick-start-steps">
          <li>
            <span>1</span>
            <strong>Abra o processo</strong>
          </li>
          <li>
            <span>2</span>
            <strong>Confira as provas</strong>
          </li>
          <li>
            <span>3</span>
            <strong>Registre sua decisão</strong>
          </li>
        </ol>
        {nextCase && (
          <Link
            className="button accent quick-start-button"
            to={`/processos/${nextCase.case_id}`}
            aria-label={`Começar pelo processo de ${nextCase.plaintiff}`}
          >
            <FileCheck2 size={18} aria-hidden="true" />
            Analisar próximo processo
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        )}
      </section>
      <section className="queue-summary" aria-label="Resumo da fila">
        <div>
          <span className="queue-icon">
            <Files size={20} />
          </span>
          <section>
            <span>Processos disponíveis</span>
            <strong>{available.length.toString().padStart(2, '0')}</strong>
          </section>
        </div>
        <div>
          <span className="queue-icon amber">
            <Clock3 size={20} />
          </span>
          <section>
            <span>Aguardando sua decisão</span>
            <strong>
              {available
                .filter((item) => item.status === 'AGUARDANDO_DECISAO')
                .length.toString()
                .padStart(2, '0')}
            </strong>
          </section>
        </div>
        <div>
          <span className="queue-icon">
            <Handshake size={20} />
          </span>
          <section>
            <span>Em negociação</span>
            <strong>
              {available
                .filter((item) => item.status === 'EM_NEGOCIACAO')
                .length.toString()
                .padStart(2, '0')}
            </strong>
          </section>
        </div>
        <div>
          <span className="queue-icon green">
            <CheckCheck size={20} />
          </span>
          <section>
            <span>Decisões registradas</span>
            <strong>
              {available
                .filter(
                  (item) => item.status === 'DECISAO_REGISTRADA' || item.status === 'CONCLUIDO',
                )
                .length.toString()
                .padStart(2, '0')}
            </strong>
          </section>
        </div>
      </section>
      <section className="panel case-list-panel">
        <div className="case-list-heading">
          <div>
            <h2>{mine ? 'Processos atribuídos a mim' : 'Processos em acompanhamento'}</h2>
            <p>Da análise das evidências ao registro da decisão.</p>
          </div>
          <span className="table-count">{available.length} processos</span>
        </div>
        <div className="case-tabs" aria-label="Filtrar por situação">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={tab === item.id ? 'selected' : ''}
              aria-pressed={tab === item.id}
            >
              {item.label}
              {item.id === 'NOVO' && (
                <span>
                  {available.filter((item) => caseStates.get(item.case_id) === 'NOVO').length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <label className="search-input">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por autor, número do processo ou UF"
              aria-label="Buscar processos"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Limpar busca">
                ×
              </button>
            )}
          </label>
          <button
            className={`button secondary ${showFilters ? 'is-selected' : ''}`}
            aria-expanded={showFilters}
            onClick={() => setShowFilters((value) => !value)}
          >
            <SlidersHorizontal size={15} />
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
            <button
              className="button ghost"
              onClick={() => {
                setUf('all');
                setRecommendation('all');
                setQuery('');
                setTab('all');
              }}
            >
              Limpar filtros
            </button>
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
                <th>
                  <span className="sr-only">Ação</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const state = caseStates.get(item.case_id) ?? 'NOVO';
                const presentation = statePresentation[state];
                return (
                  <tr
                    key={item.case_id}
                    className={state === 'NOVO' ? 'case-needs-action' : undefined}
                  >
                    <td>
                      <Link className="case-person" to={`/processos/${item.case_id}`}>
                        {item.plaintiff}
                        <ArrowUpRight size={13} />
                      </Link>
                      <span className="case-number">{item.case_number}</span>
                      <span className="case-city">
                        {item.city} <span>·</span> {item.uf}
                      </span>
                    </td>
                    <td className="money-cell">
                      <span className="mobile-cell-label">Valor da causa</span>
                      {money(item.claim_value, true)}
                    </td>
                    <td>
                      <span className="mobile-cell-label">Risco</span>
                      <Badge value={item.risk_level} />
                    </td>
                    <td>
                      <span className="mobile-cell-label">Recomendação</span>
                      <Badge value={item.recommendation} />
                    </td>
                    <td>
                      <span className="mobile-cell-label">Situação</span>
                      <span className={`case-status status-${state.toLowerCase()}`}>
                        <span />
                        {presentation.label}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="open-case"
                        to={`/processos/${item.case_id}`}
                        aria-label={`${presentation.cta}: processo de ${item.plaintiff}`}
                      >
                        {presentation.cta}
                        <ArrowRight size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="empty-state">
            <Search size={28} />
            <h3>Nenhum processo encontrado</h3>
            <p>Experimente outro nome ou ajuste os filtros da sua fila.</p>
            <button
              className="button secondary"
              onClick={() => {
                setQuery('');
                setUf('all');
                setRecommendation('all');
                setTab('all');
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}
        <div className="table-footer">
          <span>
            {filtered.length} de {available.length} processos
          </span>
          <span>
            <ShieldIcon />
            Dados demonstrativos · Análise sujeita à decisão do advogado
          </span>
        </div>
      </section>
      <div className="cases-bottom-note">
        <span className="mini-symbol">
          <ArrowUpRight size={18} />
        </span>
        <p>
          <strong>A evidência vem primeiro.</strong> Consulte a origem de cada informação antes de
          registrar sua decisão.
        </p>
      </div>
    </div>
  );
}
function ShieldIcon() {
  return <CheckCheck size={13} />;
}
