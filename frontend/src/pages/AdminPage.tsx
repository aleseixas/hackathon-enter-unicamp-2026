import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Database,
  FileCheck2,
  GitBranch,
  Info,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge, ErrorState, LoadingState } from '../components/ui';
import { money, percent, shortDate } from '../lib/format';
import { getAdminDashboard } from '../services/api';
import type { AdminDashboard, AdminDecisionRow } from '../types';
import '../styles/admin.css';

type AdminSection = 'overview' | 'adherence' | 'effectiveness' | 'decisions';
type Metric = { label: string; value: string; hint: string; icon: LucideIcon; accent?: boolean };
type TableFilters = {
  search: string;
  lawyer: string;
  firm: string;
  uf: string;
  recommendation: string;
  adherence: string;
};

const count = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
const normalize = (value: string) =>
  value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const humanizeToken = (value: string) =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1).toLocaleLowerCase('pt-BR'))
    .join(' ');
const emptyFilters: TableFilters = {
  search: '',
  lawyer: '',
  firm: '',
  uf: '',
  recommendation: '',
  adherence: '',
};
const sectionCopy: Record<AdminSection, { title: string; description: string }> = {
  overview: {
    title: 'Visão geral',
    description: 'Uma visão clara das decisões, da aderência e dos resultados da política.',
  },
  adherence: {
    title: 'Aderência à política',
    description: 'Acompanhe as decisões dos advogados e os motivos de divergência.',
  },
  effectiveness: {
    title: 'Efetividade da política',
    description: 'Observe os resultados operacionais e explore o cenário histórico.',
  },
  decisions: {
    title: 'Decisões registradas',
    description: 'Recomendação, decisão e resultado. Todo o contexto em um só lugar.',
  },
};

function DemoLabel({ simulation = false }: { simulation?: boolean }) {
  return (
    <span className={`admin-data-label${simulation ? ' is-simulation' : ''}`}>
      <Database size={12} aria-hidden="true" />
      {simulation ? 'SIMULAÇÃO' : 'DEMO DATA'}
    </span>
  );
}

function MetricGrid({ items }: { items: Metric[] }) {
  return (
    <div className={`admin-metrics admin-metrics-${items.length}`}>
      {items.map(({ label, value, hint, icon: Icon, accent }) => (
        <article className={`admin-metric${accent ? ' admin-metric-accent' : ''}`} key={label}>
          <div className="admin-metric-top">
            <span>{label}</span>
            <Icon size={17} strokeWidth={1.65} aria-hidden="true" />
          </div>
          <strong className="admin-metric-value">{value}</strong>
          <span className="admin-metric-hint">{hint}</span>
        </article>
      ))}
    </div>
  );
}

function SnapshotNote({ updatedAt }: { updatedAt: string }) {
  return (
    <div className="admin-snapshot-note">
      <Info size={15} aria-hidden="true" />
      <p>
        Indicadores de um cenário de demonstração. As decisões registradas pelo advogado aparecem na
        tabela como <strong>“Nesta demo”</strong>.
      </p>
      <span>Atualizado {shortDate(updatedAt)}</span>
    </div>
  );
}

function DistributionChart({ data }: { data: AdminDashboard['distribution'] }) {
  return (
    <section
      className="panel admin-panel admin-distribution-panel"
      aria-labelledby="distribution-heading"
    >
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">DIRECIONAMENTO</span>
          <h2 id="distribution-heading">Recomendações da política</h2>
        </div>
        <Layers3 size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">Distribuição no cenário de demonstração.</p>
      {data.length ? (
        <div
          className="admin-distribution"
          role="img"
          aria-label={data
            .map((item) => `${item.label}: ${count(item.value)}, ${percent(item.percentage)}`)
            .join('. ')}
        >
          <div className="admin-distribution-total" aria-hidden="true">
            {data.map((item, index) => (
              <span
                key={item.label}
                className={`admin-chart-tone-${index % 3}`}
                style={{ flexGrow: Math.max(0, item.percentage) }}
              />
            ))}
          </div>
          <div className="admin-distribution-rows" aria-hidden="true">
            {data.map((item, index) => (
              <div className="admin-distribution-row" key={item.label}>
                <span className={`admin-chart-dot admin-chart-tone-${index % 3}`} />
                <span className="admin-distribution-name">{item.label}</span>
                <strong>{count(item.value)}</strong>
                <span className="admin-distribution-percent">{percent(item.percentage)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="admin-chart-empty">Sem distribuição disponível.</p>
      )}
    </section>
  );
}

function EvolutionChart({ data }: { data: AdminDashboard['evolution'] }) {
  const maximum = Math.max(1, ...data.flatMap((item) => [item.agreement, item.defense]));
  return (
    <section
      className="panel admin-panel admin-evolution-panel"
      aria-labelledby="evolution-heading"
    >
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">AO LONGO DO TEMPO</span>
          <h2 id="evolution-heading">Evolução das decisões</h2>
        </div>
        <div className="admin-chart-legend">
          <span>
            <i className="admin-chart-tone-0" />
            Acordo
          </span>
          <span>
            <i className="admin-chart-tone-1" />
            Defesa
          </span>
        </div>
      </div>
      <p className="admin-panel-description">
        Volume de decisões por período, em números absolutos.
      </p>
      {data.length ? (
        <div
          className="admin-evolution"
          role="img"
          aria-label={data
            .map(
              (item) =>
                `${item.label}: ${count(item.agreement)} acordos e ${count(item.defense)} defesas`,
            )
            .join('. ')}
        >
          <div className="admin-evolution-grid" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="admin-evolution-columns" aria-hidden="true">
            {data.map((item) => (
              <div className="admin-evolution-period" key={item.label}>
                <div className="admin-evolution-bars">
                  <div
                    className="admin-evolution-bar-wrap"
                    style={{ height: `${(Math.max(0, item.agreement) / maximum) * 100}%` }}
                  >
                    <span>{count(item.agreement)}</span>
                    <div className="admin-evolution-bar admin-chart-tone-0" />
                  </div>
                  <div
                    className="admin-evolution-bar-wrap"
                    style={{ height: `${(Math.max(0, item.defense) / maximum) * 100}%` }}
                  >
                    <span>{count(item.defense)}</span>
                    <div className="admin-evolution-bar admin-chart-tone-1" />
                  </div>
                </div>
                <span className="admin-evolution-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="admin-chart-empty">Sem evolução disponível.</p>
      )}
    </section>
  );
}

function OverrideReasons({ data }: { data: AdminDashboard['override_reasons'] }) {
  return (
    <section className="panel admin-panel" aria-labelledby="override-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">ESCUTA DA OPERAÇÃO</span>
          <h2 id="override-heading">Por que a decisão diverge?</h2>
        </div>
        <GitBranch size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">Motivos dos overrides no cenário de demonstração.</p>
      {data.length ? (
        <div className="admin-reasons">
          {data.map((item) => (
            <div className="admin-reason" key={item.label}>
              <div>
                <span>{item.label}</span>
                <strong>
                  {percent(item.percentage)} <small>({count(item.value)})</small>
                </strong>
              </div>
              <div className="admin-reason-track" aria-hidden="true">
                <span style={{ width: `${Math.min(1, Math.max(0, item.percentage)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="admin-chart-empty">Nenhum motivo registrado.</p>
      )}
    </section>
  );
}

function RecentDecisions({ rows }: { rows: AdminDecisionRow[] }) {
  return (
    <section className="panel admin-panel admin-recent-panel" aria-labelledby="recent-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">RASTREABILIDADE</span>
          <h2 id="recent-heading">Últimas decisões</h2>
        </div>
        <Link className="admin-text-link" to="/admin/decisions">
          Ver todas <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="admin-recent-list">
        {rows.slice(0, 4).map((row) => (
          <div className="admin-recent-row" key={row.id}>
            <div className={`admin-activity-icon${row.adherent ? '' : ' is-override'}`}>
              {row.adherent ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <GitBranch size={16} aria-hidden="true" />
              )}
            </div>
            <div className="admin-recent-content">
              <strong>{row.lawyer_name}</strong>
              <span>{row.case_number}</span>
              <span className="admin-recent-meta">
                {shortDate(row.created_at)}
                {row.is_local && <LocalLabel />}
              </span>
            </div>
            <Badge value={row.decision} />
          </div>
        ))}
      </div>
      {!rows.length && <p className="admin-chart-empty">Ainda não há decisões registradas.</p>}
    </section>
  );
}

function LocalLabel() {
  return (
    <span className="admin-local-label">
      <span aria-hidden="true" />
      Nesta demo
    </span>
  );
}

function DecisionTable({ rows }: { rows: AdminDecisionRow[] }) {
  const [filters, setFilters] = useState<TableFilters>(emptyFilters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const options = useMemo(
    () => ({
      lawyers: [...new Set(rows.map((row) => row.lawyer_name))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      firms: [...new Set(rows.map((row) => row.firm_name))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      states: [...new Set(rows.map((row) => row.uf))].sort(),
    }),
    [rows],
  );
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const query = normalize(filters.search.trim());
        return (
          (!query ||
            normalize(
              [row.case_number, row.plaintiff, row.lawyer_name, row.firm_name, row.uf].join(' '),
            ).includes(query)) &&
          (!filters.lawyer || row.lawyer_name === filters.lawyer) &&
          (!filters.firm || row.firm_name === filters.firm) &&
          (!filters.uf || row.uf === filters.uf) &&
          (!filters.recommendation || row.recommendation === filters.recommendation) &&
          (!filters.adherence || (filters.adherence === 'adherent' ? row.adherent : !row.adherent))
        );
      }),
    [rows, filters],
  );
  const hasFilters = Object.values(filters).some(Boolean);
  const updateFilter = (name: keyof TableFilters, value: string) =>
    setFilters((current) => ({ ...current, [name]: value }));

  return (
    <section className="panel admin-decisions-panel" aria-labelledby="decisions-heading">
      <div className="admin-table-heading">
        <div>
          <span className="admin-section-kicker">DECISÃO A DECISÃO</span>
          <h2 id="decisions-heading">Registro da operação</h2>
          <p>Explore cada processo e acompanhe a decisão registrada.</p>
        </div>
        <span className="admin-record-count" aria-live="polite">
          {count(filteredRows.length)} {filteredRows.length === 1 ? 'registro' : 'registros'}
          {hasFilters && ` de ${count(rows.length)}`}
        </span>
      </div>
      <div className="admin-table-filters">
        <label className="field admin-search-field">
          <span>Buscar processo ou pessoa</span>
          <div className="admin-search-input">
            <Search size={16} aria-hidden="true" />
            <input
              className="input"
              type="search"
              placeholder="Nº do processo, parte, advogado…"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
            />
          </div>
        </label>
        <label className="field">
          <span>Advogado</span>
          <select
            className="select"
            value={filters.lawyer}
            onChange={(event) => updateFilter('lawyer', event.target.value)}
          >
            <option value="">Todos os advogados</option>
            {options.lawyers.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Escritório</span>
          <select
            className="select"
            value={filters.firm}
            onChange={(event) => updateFilter('firm', event.target.value)}
          >
            <option value="">Todos os escritórios</option>
            {options.firms.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>UF</span>
          <select
            className="select"
            value={filters.uf}
            onChange={(event) => updateFilter('uf', event.target.value)}
          >
            <option value="">Todas</option>
            {options.states.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Recomendação</span>
          <select
            className="select"
            value={filters.recommendation}
            onChange={(event) => updateFilter('recommendation', event.target.value)}
          >
            <option value="">Todas</option>
            <option value="ACORDO">Acordo</option>
            <option value="DEFESA">Defesa</option>
            <option value="REVISAR">Revisar</option>
          </select>
        </label>
        <label className="field">
          <span>Aderência</span>
          <select
            className="select"
            value={filters.adherence}
            onChange={(event) => updateFilter('adherence', event.target.value)}
          >
            <option value="">Todas</option>
            <option value="adherent">Aderente</option>
            <option value="override">Override</option>
          </select>
        </label>
      </div>
      {hasFilters && (
        <div className="admin-active-filters">
          <SlidersHorizontal size={13} aria-hidden="true" />
          <span>Filtros aplicados</span>
          <button type="button" onClick={() => setFilters(emptyFilters)}>
            Limpar filtros <X size={13} aria-hidden="true" />
          </button>
        </div>
      )}
      {filteredRows.length ? (
        <div
          className="admin-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Tabela de decisões. Role horizontalmente para ver todas as colunas."
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Processo</th>
                <th scope="col">Advogado e escritório</th>
                <th scope="col">Recomendação</th>
                <th scope="col">Decisão</th>
                <th scope="col">Aderência</th>
                <th scope="col" className="admin-number-cell">
                  Sugerido
                </th>
                <th scope="col" className="admin-number-cell">
                  Realizado
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <Fragment key={row.id}>
                  <tr className={expandedId === row.id ? 'is-expanded' : undefined}>
                    <td>
                      <button
                        className="admin-case-button"
                        type="button"
                        aria-expanded={expandedId === row.id}
                        aria-controls={`admin-record-${row.id}`}
                        onClick={() =>
                          setExpandedId((current) => (current === row.id ? null : row.id))
                        }
                      >
                        {row.case_number}
                        <ChevronDown size={13} aria-hidden="true" />
                      </button>
                      <span className="admin-cell-secondary">
                        {row.plaintiff} <span className="admin-cell-state">{row.uf}</span>
                      </span>
                      {row.is_local && <LocalLabel />}
                    </td>
                    <td>
                      <span className="admin-cell-primary">{row.lawyer_name}</span>
                      <span className="admin-cell-secondary">{row.firm_name}</span>
                    </td>
                    <td>
                      <Badge value={row.recommendation} />
                    </td>
                    <td>
                      <Badge value={row.decision} />
                    </td>
                    <td>
                      <span
                        className={`admin-adherence${row.adherent ? ' is-adherent' : ' is-override'}`}
                      >
                        {row.adherent ? (
                          <CheckCheck size={14} aria-hidden="true" />
                        ) : (
                          <GitBranch size={14} aria-hidden="true" />
                        )}
                        {row.adherent ? 'Aderente' : 'Override'}
                      </span>
                    </td>
                    <td className="admin-number-cell">{money(row.suggested_value)}</td>
                    <td className="admin-number-cell">{money(row.realized_value)}</td>
                    <td>
                      <Badge value={row.status} />
                    </td>
                  </tr>
                  {expandedId === row.id && (
                    <tr className="admin-detail-row" id={`admin-record-${row.id}`}>
                      <td colSpan={8}>
                        <div className="admin-record-detail">
                          <div>
                            <span className="admin-section-kicker">CONTEXTO DO REGISTRO</span>
                            <p>
                              {row.justification ||
                                row.decision_explanation ||
                                (row.adherent
                                  ? 'A decisão registrada acompanha a recomendação da política.'
                                  : 'Não há justificativa disponível neste registro.')}
                            </p>
                          </div>
                          <dl>
                            {row.lawyer_profile_label && (
                              <div>
                                <dt>Perfil</dt>
                                <dd>{row.lawyer_profile_label}</dd>
                              </div>
                            )}
                            {row.confidence_band && (
                              <div>
                                <dt>Confianca</dt>
                                <dd>
                                  {row.confidence_band}
                                  {row.confidence_score != null
                                    ? ` (${percent(row.confidence_score)})`
                                    : ''}
                                </dd>
                              </div>
                            )}
                            {row.completeness_band && (
                              <div>
                                <dt>Completude</dt>
                                <dd>
                                  {row.completeness_band}
                                  {row.subsidy_count != null
                                    ? ` · ${row.subsidy_count} subsidios`
                                    : ''}
                                </dd>
                              </div>
                            )}
                            {row.override_reason_label && (
                              <div>
                                <dt>Motivo do override</dt>
                                <dd>{humanizeToken(row.override_reason_label)}</dd>
                              </div>
                            )}
                            {row.follow_probability != null && (
                              <div>
                                <dt>Probabilidade de seguir</dt>
                                <dd>{percent(row.follow_probability)}</dd>
                              </div>
                            )}
                            {row.decision_minutes != null && (
                              <div>
                                <dt>Tempo de decisao</dt>
                                <dd>{count(row.decision_minutes)} min</dd>
                              </div>
                            )}
                            <div>
                              <dt>Registrado em</dt>
                              <dd>{shortDate(row.created_at)}</dd>
                            </div>
                            <div>
                              <dt>Origem</dt>
                              <dd>
                                {row.is_local
                                  ? 'Registro feito nesta demo'
                                  : 'Cenário de demonstração'}
                              </dd>
                            </div>
                          </dl>
                          <button
                            type="button"
                            className="button ghost admin-detail-close"
                            aria-label="Fechar contexto do registro"
                            onClick={() => setExpandedId(null)}
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state admin-table-empty">
          <Search size={27} strokeWidth={1.4} aria-hidden="true" />
          <h3>{hasFilters ? 'Nenhum registro encontrado' : 'Nenhuma decisão registrada'}</h3>
          <p>
            {hasFilters
              ? 'Ajuste os filtros ou tente buscar por outro processo, advogado ou escritório.'
              : 'As decisões registradas pelo advogado aparecerão aqui.'}
          </p>
          {hasFilters && (
            <button
              className="button secondary"
              type="button"
              onClick={() => setFilters(emptyFilters)}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
      <div className="admin-table-footer">
        <Info size={14} aria-hidden="true" />
        <span>
          Valores e status refletem cada registro. Um traço indica que o valor ainda não está
          disponível.
        </span>
      </div>
    </section>
  );
}

function Overview({ data }: { data: AdminDashboard }) {
  const metrics = data.metrics;
  return (
    <>
      <MetricGrid
        items={[
          {
            label: 'Decisões registradas',
            value: count(metrics.decisions),
            hint: 'No período demonstrado',
            icon: FileCheck2,
          },
          {
            label: 'Aderência à política',
            value: percent(metrics.adherence_rate),
            hint: 'Decisões alinhadas à recomendação',
            icon: ShieldCheck,
            accent: true,
          },
          {
            label: 'Overrides',
            value: count(metrics.overrides),
            hint: 'Decisões com divergência',
            icon: GitBranch,
          },
          {
            label: 'Acordos fechados',
            value: count(metrics.settlements),
            hint: 'Negociações concluídas',
            icon: CheckCheck,
          },
          {
            label: 'Taxa de aceitação',
            value: percent(metrics.acceptance_rate),
            hint: 'Propostas aceitas no período',
            icon: ArrowDownLeft,
          },
          {
            label: 'Valor médio fechado',
            value: money(metrics.average_closed_value, true),
            hint: 'Por acordo fechado',
            icon: CircleDollarSign,
          },
        ]}
      />
      <div className="admin-chart-grid">
        <EvolutionChart data={data.evolution} />
        <DistributionChart data={data.distribution} />
      </div>
      <div className="admin-bottom-grid">
        <OverrideReasons data={data.override_reasons} />
        <RecentDecisions rows={data.decisions} />
      </div>
    </>
  );
}

function Adherence({ data }: { data: AdminDashboard }) {
  return (
    <>
      <MetricGrid
        items={[
          {
            label: 'Aderência à política',
            value: percent(data.metrics.adherence_rate),
            hint: 'Decisões alinhadas à recomendação',
            icon: ShieldCheck,
            accent: true,
          },
          {
            label: 'Decisões registradas',
            value: count(data.metrics.decisions),
            hint: 'No período demonstrado',
            icon: FileCheck2,
          },
          {
            label: 'Overrides registrados',
            value: count(data.metrics.overrides),
            hint: 'Decisões com divergência',
            icon: GitBranch,
          },
        ]}
      />
      <div className="admin-adherence-grid">
        <OverrideReasons data={data.override_reasons} />
        <section className="admin-governance-card" aria-labelledby="governance-heading">
          <div className="admin-governance-icon">
            <ShieldCheck size={23} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <span className="admin-section-kicker">DECISÃO HUMANA, CONTEXTO PRESERVADO</span>
          <h2 id="governance-heading">Cada divergência tem algo a dizer.</h2>
          <p>
            O override registra a escolha do advogado quando ela difere da recomendação. A
            justificativa preserva o contexto para a análise da operação.
          </p>
          <div>
            <Check size={15} aria-hidden="true" />
            <span>Recomendação e decisão lado a lado</span>
          </div>
          <div>
            <Check size={15} aria-hidden="true" />
            <span>Justificativa acessível em cada processo</span>
          </div>
        </section>
      </div>
      <DecisionTable rows={data.decisions} />
    </>
  );
}

function Effectiveness({ data }: { data: AdminDashboard }) {
  const metrics = data.metrics;
  const simulation = data.historical_simulation;
  return (
    <>
      <MetricGrid
        items={[
          {
            label: 'Economia estimada',
            value: money(metrics.estimated_savings, true),
            hint: 'Diferenca entre judicializacao e politica de acordos',
            icon: CircleDollarSign,
            accent: true,
          },
          {
            label: 'Reducao de custo',
            value: percent(metrics.estimated_savings_rate),
            hint: 'Percentual economizado sobre o cenario-base',
            icon: ArrowDownLeft,
          },
          {
            label: 'Custo sem politica',
            value: money(metrics.baseline_cost, true),
            hint: 'Cenario-base de judicializacao',
            icon: Layers3,
          },
          {
            label: 'Custo com politica',
            value: money(metrics.projected_cost, true),
            hint: 'Custo projetado apos acordos',
            icon: Activity,
          },
          {
            label: 'Valor total fechado',
            value: money(metrics.total_closed_value, true),
            hint: 'Soma dos acordos aceitos no cenario',
            icon: CheckCheck,
          },
          {
            label: 'Defesa evitada',
            value: money(metrics.avoided_defense_cost, true),
            hint: 'Custo potencial de defesa poupado',
            icon: ShieldCheck,
          },
        ]}
      />
      <div className="admin-subsection-heading">
        <div>
          <span className="admin-section-kicker">RESULTADOS DA OPERAÇÃO</span>
          <h2>Da proposta ao acordo</h2>
        </div>
        <DemoLabel />
      </div>
      <MetricGrid
        items={[
          {
            label: 'Acordos fechados',
            value: count(metrics.settlements),
            hint: 'Negociações concluídas',
            icon: CheckCheck,
          },
          {
            label: 'Taxa de aceitação',
            value: percent(metrics.acceptance_rate),
            hint: 'Propostas aceitas no período',
            icon: ShieldCheck,
            accent: true,
          },
          {
            label: 'Propostas recusadas',
            value: count(metrics.rejected),
            hint: 'Resultado informado no período',
            icon: X,
          },
          {
            label: 'Contrapropostas',
            value: count(metrics.counteroffers),
            hint: 'Retornos com outro valor',
            icon: GitBranch,
          },
          {
            label: 'Valor médio ofertado',
            value: money(metrics.average_offered_value, true),
            hint: 'Por proposta no período',
            icon: ArrowUpRight,
          },
          {
            label: 'Valor médio fechado',
            value: money(metrics.average_closed_value, true),
            hint: 'Por acordo fechado',
            icon: CircleDollarSign,
          },
        ]}
      />
      <div className="admin-operational-summary">
        <Activity size={18} aria-hidden="true" />
        <span>Custo projetado do cenário operacional</span>
        <strong>{money(metrics.projected_cost, true)}</strong>
        <span className="admin-operational-scope">Cenário de demonstração</span>
      </div>
      <MetricGrid
        items={[
          {
            label: 'Propostas de acordo',
            value: count(metrics.agreement_proposals),
            hint: 'Casos que avancaram para tentativa de acordo',
            icon: ArrowUpRight,
          },
          {
            label: 'Casos encerrados',
            value: count(metrics.closed_cases),
            hint: 'Aceitos ou recusados no periodo',
            icon: CheckCheck,
          },
          {
            label: 'Contrapropostas',
            value: count(metrics.counteroffers),
            hint: 'Retornos com outro valor',
            icon: GitBranch,
          },
          {
            label: 'Propostas recusadas',
            value: count(metrics.rejected),
            hint: 'Acordos que nao fecharam',
            icon: X,
          },
          {
            label: 'Ticket medio ofertado',
            value: money(metrics.average_offered_value, true),
            hint: 'Valor medio por proposta',
            icon: ArrowUpRight,
          },
          {
            label: 'Ticket medio fechado',
            value: money(metrics.average_closed_value, true),
            hint: 'Valor medio por acordo aceito',
            icon: CircleDollarSign,
          },
        ]}
      />
      <section className="admin-simulation" aria-labelledby="simulation-heading">
        <div className="admin-simulation-heading">
          <div>
            <span className="admin-section-kicker">UMA OUTRA PERSPECTIVA</span>
            <h2 id="simulation-heading">Simulação sobre a base histórica</h2>
            <p>Um cenário estimado para comparação, separado dos resultados operacionais.</p>
          </div>
          <DemoLabel simulation />
        </div>
        <div className="admin-simulation-metrics">
          <div>
            <span>Custo de referência</span>
            <strong>{money(simulation.baseline_cost, true)}</strong>
            <small>Referência histórica</small>
          </div>
          <div>
            <span>Custo projetado</span>
            <strong>{money(simulation.projected_cost, true)}</strong>
            <small>No cenário simulado</small>
          </div>
          <div className="admin-simulation-saving">
            <span>Economia estimada</span>
            <strong>{money(simulation.estimated_savings, true)}</strong>
            <small>{percent(metrics.estimated_savings_rate)} de reducao no custo</small>
            <small>Estimativa da simulação</small>
          </div>
        </div>
        <div className="admin-simulation-assumptions">
          <div>
            <Layers3 size={17} aria-hidden="true" />
            <span>
              Amostra <strong>{count(simulation.sample_size)} processos</strong>
            </span>
          </div>
          <div>
            <CheckCheck size={17} aria-hidden="true" />
            <span>
              Hipótese de aceitação <strong>{percent(simulation.acceptance_assumption)}</strong>
            </span>
          </div>
        </div>
        <div className="admin-simulation-note">
          <Info size={16} aria-hidden="true" />
          <p>{simulation.description}</p>
        </div>
      </section>
      <div className="admin-end-link">
        <span>Os resultados individuais estão no registro da operação.</span>
        <Link className="admin-text-link" to="/admin/decisions">
          Explorar decisões <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}

export default function AdminPage() {
  const { section: sectionParam } = useParams<{ section?: string }>();
  const section: AdminSection =
    sectionParam && Object.hasOwn(sectionCopy, sectionParam)
      ? (sectionParam as AdminSection)
      : 'overview';
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const loadData = useCallback(() => {
    const version = ++requestVersion.current;
    return getAdminDashboard()
      .then((result) => {
        if (version === requestVersion.current) setData(result);
      })
      .catch((cause: unknown) => {
        if (version === requestVersion.current)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Não foi possível carregar os dados da operação.',
          );
      })
      .finally(() => {
        if (version === requestVersion.current) setRefreshing(false);
      });
  }, []);
  const reload = useCallback(() => {
    setRefreshing(true);
    setError(null);
    return loadData();
  }, [loadData]);

  useEffect(() => {
    void loadData();
    const onDataChanged = () => {
      void reload();
    };
    window.addEventListener('policy:data-changed', onDataChanged);
    return () => {
      requestVersion.current += 1;
      window.removeEventListener('policy:data-changed', onDataChanged);
    };
  }, [loadData, reload]);

  return (
    <div className="admin-page" aria-busy={refreshing}>
      <header className="page-header admin-page-header">
        <div>
          <div className="admin-heading-eyebrow">
            <span className="eyebrow">POLICY INTELLIGENCE</span>
            <DemoLabel />
          </div>
          <h1 className="page-title">{sectionCopy[section].title}</h1>
          <p className="page-description">{sectionCopy[section].description}</p>
        </div>
        <div className="admin-header-actions">
          {data && (
            <span className="admin-period">
              <Clock3 size={14} aria-hidden="true" />
              {data.period}
            </span>
          )}
          <button
            type="button"
            className="button secondary admin-refresh"
            disabled={refreshing}
            onClick={() => {
              void reload();
            }}
          >
            <RefreshCw
              size={15}
              className={refreshing ? 'admin-spinning' : undefined}
              aria-hidden="true"
            />
            {refreshing ? 'Atualizando' : 'Atualizar'}
          </button>
        </div>
      </header>
      {!data && refreshing ? (
        <LoadingState />
      ) : !data && error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <>
          {error && (
            <div className="admin-refresh-error" role="alert">
              <Info size={16} aria-hidden="true" />
              <span>{error} Os últimos dados carregados continuam visíveis.</span>
              <button
                type="button"
                onClick={() => {
                  void reload();
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}
          <SnapshotNote updatedAt={data.updated_at} />
          {section === 'overview' && <Overview data={data} />}
          {section === 'adherence' && <Adherence data={data} />}
          {section === 'effectiveness' && <Effectiveness data={data} />}
          {section === 'decisions' && <DecisionTable rows={data.decisions} />}
        </>
      ) : null}
    </div>
  );
}
