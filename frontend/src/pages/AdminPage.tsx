import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Check,
  CheckCheck,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Database,
  FileCheck2,
  Filter,
  Gauge,
  GitBranch,
  Handshake,
  Info,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge, ErrorState, LoadingState } from '../components/ui';
import {
  createEffectivenessTimeline,
  createMonthlyEvolution,
  createOutcomeDistribution,
  createOverrideReasons,
  createRecommendationDistribution,
  deriveAdminMetrics,
  emptyAdminFilters,
  filterAdminRows,
  hasActiveAdminFilters,
  type AdminFilters,
  type AdminPeriod,
} from '../lib/adminMetrics';
import { money, percent, shortDate } from '../lib/format';
import { getAdminDashboard } from '../services/api';
import type { AdminDashboard, AdminDecisionRow } from '../types';
import '../styles/admin.css';
import '../styles/admin-dark.css';

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
    description: 'Uma leitura clara das decisões, da aderência e dos resultados da política.',
  },
  adherence: {
    title: 'Aderência à política',
    description: 'Acompanhe desvios, perfis comportamentais e pontos de atenção.',
  },
  effectiveness: {
    title: 'Efetividade da política',
    description: 'Meça economia, conversão e resultados das negociações.',
  },
  decisions: {
    title: 'Decisões registradas',
    description: 'Recomendação, decisão e resultado com rastreabilidade por caso.',
  },
};

function DemoLabel({ simulation = false }: { simulation?: boolean }) {
  return (
    <span className={`admin-data-label${simulation ? ' is-simulation' : ''}`}>
      <Database size={12} aria-hidden="true" />
      {simulation ? 'SIMULAÇÃO' : 'DADOS DEMONSTRATIVOS'}
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

function ViewSwitcher({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="admin-view-switcher" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          className={`admin-view-button${value === option.id ? ' is-active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function useQueryView<T extends string>(defaultView: T, allowedViews: readonly T[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryView = searchParams.get('view') as T | null;
  const activeView = queryView && allowedViews.includes(queryView) ? queryView : defaultView;
  const setActiveView = (nextView: T) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextView === defaultView) nextParams.delete('view');
    else nextParams.set('view', nextView);
    setSearchParams(nextParams, { replace: true });
  };
  return [activeView, setActiveView] as const;
}

const filterQueryKeys: (keyof AdminFilters)[] = [
  'period',
  'firm',
  'lawyer',
  'profile',
  'uf',
  'recommendation',
  'confidence',
  'completeness',
];

function readAdminFilters(searchParams: URLSearchParams): AdminFilters {
  const periodValue = searchParams.get('period');
  const period: AdminPeriod =
    periodValue === '30' || periodValue === '90' || periodValue === '180' ? periodValue : 'all';
  const recommendation = searchParams.get('recommendation');
  return {
    period,
    firm: searchParams.get('firm') ?? '',
    lawyer: searchParams.get('lawyer') ?? '',
    profile: searchParams.get('profile') ?? '',
    uf: searchParams.get('uf') ?? '',
    recommendation:
      recommendation === 'ACORDO' || recommendation === 'DEFESA' || recommendation === 'REVISAR'
        ? recommendation
        : '',
    confidence: searchParams.get('confidence') ?? '',
    completeness: searchParams.get('completeness') ?? '',
  };
}

function GlobalFilters({
  rows,
  filters,
  onChange,
  onClear,
}: {
  rows: AdminDecisionRow[];
  filters: AdminFilters;
  onChange: (filters: AdminFilters) => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const options = useMemo(
    () => ({
      firms: [...new Set(rows.map((row) => row.firm_name))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      lawyers: [...new Set(rows.map((row) => row.lawyer_name))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      profiles: [
        ...new Set(
          rows.flatMap((row) => (row.lawyer_profile_label ? [row.lawyer_profile_label] : [])),
        ),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      states: [...new Set(rows.map((row) => row.uf))].sort(),
      confidence: [
        ...new Set(rows.flatMap((row) => (row.confidence_band ? [row.confidence_band] : []))),
      ],
      completeness: [
        ...new Set(rows.flatMap((row) => (row.completeness_band ? [row.completeness_band] : []))),
      ],
    }),
    [rows],
  );
  const active = hasActiveAdminFilters(filters);
  const selectedFilters = filterQueryKeys.filter((key) =>
    key === 'period' ? filters.period !== 'all' : Boolean(filters[key]),
  );
  const labels: Record<keyof AdminFilters, string> = {
    period: `Últimos ${filters.period} dias`,
    firm: filters.firm,
    lawyer: filters.lawyer,
    profile: filters.profile,
    uf: filters.uf,
    recommendation: filters.recommendation,
    confidence: `Confiança: ${filters.confidence}`,
    completeness: `Completude: ${filters.completeness}`,
  };
  const update = (key: keyof AdminFilters, value: string) =>
    onChange({ ...filters, [key]: value } as AdminFilters);

  return (
    <section
      className={`admin-global-filters${expanded ? ' is-expanded' : ''}`}
      aria-label="Filtros globais"
    >
      <div className="admin-filter-summary">
        <div>
          <Filter size={16} aria-hidden="true" />
          <strong>Filtros da análise</strong>
          <span>{active ? `${selectedFilters.length} aplicados` : 'Toda a base'}</span>
        </div>
        <button
          className="admin-filter-toggle"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Ocultar filtros' : 'Refinar análise'}
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="admin-global-filter-grid">
        <label>
          <span>Período</span>
          <select value={filters.period} onChange={(event) => update('period', event.target.value)}>
            <option value="all">Todo o período</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="180">Últimos 180 dias</option>
          </select>
        </label>
        <label>
          <span>Escritório</span>
          <select
            aria-label="Escritório global"
            value={filters.firm}
            onChange={(event) => update('firm', event.target.value)}
          >
            <option value="">Todos</option>
            {options.firms.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Advogado</span>
          <select
            aria-label="Advogado global"
            value={filters.lawyer}
            onChange={(event) => update('lawyer', event.target.value)}
          >
            <option value="">Todos</option>
            {options.lawyers.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Perfil</span>
          <select
            value={filters.profile}
            onChange={(event) => update('profile', event.target.value)}
          >
            <option value="">Todos</option>
            {options.profiles.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>UF</span>
          <select
            aria-label="UF global"
            value={filters.uf}
            onChange={(event) => update('uf', event.target.value)}
          >
            <option value="">Todas</option>
            {options.states.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Recomendação</span>
          <select
            aria-label="Recomendação global"
            value={filters.recommendation}
            onChange={(event) => update('recommendation', event.target.value)}
          >
            <option value="">Todas</option>
            <option value="ACORDO">Acordo</option>
            <option value="DEFESA">Defesa</option>
            <option value="REVISAR">Revisar</option>
          </select>
        </label>
        <label>
          <span>Confiança</span>
          <select
            value={filters.confidence}
            onChange={(event) => update('confidence', event.target.value)}
          >
            <option value="">Todas</option>
            {options.confidence.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Completude</span>
          <select
            value={filters.completeness}
            onChange={(event) => update('completeness', event.target.value)}
          >
            <option value="">Todas</option>
            {options.completeness.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      {active && (
        <div className="admin-filter-chips">
          {selectedFilters.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => update(key, emptyAdminFilters[key])}
              aria-label={`Remover filtro ${labels[key]}`}
            >
              {labels[key]} <X size={12} aria-hidden="true" />
            </button>
          ))}
          <button className="is-clear" type="button" onClick={onClear}>
            Limpar filtros
          </button>
        </div>
      )}
    </section>
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
          <span className="admin-section-kicker">PARETO DE DIVERGÊNCIAS</span>
          <h2 id="override-heading">Motivos que concentram os desvios</h2>
        </div>
        <GitBranch size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        Participação de cada motivo e percentual acumulado no recorte atual.
      </p>
      {data.length ? (
        <div className="admin-reasons">
          {data.map((item, index) => {
            const cumulative = data
              .slice(0, index + 1)
              .reduce((total, current) => total + current.percentage, 0);
            return (
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
                <small className="admin-reason-cumulative">{percent(cumulative)} acumulado</small>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="admin-chart-empty">Nenhum motivo registrado.</p>
      )}
    </section>
  );
}

type ProfileSummary = {
  label: string;
  description: string;
  decisions: number;
  adherenceRate: number;
  agreementRate: number;
  overrideRate: number;
  avgDecisionMinutes: number | null;
  avgFollowProbability: number | null;
  firmCount: number;
};

type FirmSummary = {
  name: string;
  decisions: number;
  adherenceRate: number;
  avgDecisionMinutes: number | null;
  profileCount: number;
  dominantProfile: string;
};

const average = (total: number, countValue: number) => (countValue ? total / countValue : 0);

function scopedFinancials(data: AdminDashboard, rows: AdminDecisionRow[]) {
  const totalExposure = data.decisions.reduce(
    (total, row) => total + Math.max(0, row.suggested_value ?? 0),
    0,
  );
  const selectedExposure = rows.reduce(
    (total, row) => total + Math.max(0, row.suggested_value ?? 0),
    0,
  );
  const share =
    rows.length === data.decisions.length
      ? 1
      : totalExposure > 0
        ? selectedExposure / totalExposure
        : data.decisions.length
          ? rows.length / data.decisions.length
          : 0;
  return {
    baselineCost: data.metrics.baseline_cost * share,
    projectedCost: data.metrics.projected_cost * share,
    estimatedSavings: data.metrics.estimated_savings * share,
    savingsRate: data.metrics.estimated_savings_rate,
    proportionallyAllocated: share !== 1,
  };
}

function summarizeProfiles(rows: AdminDecisionRow[]): ProfileSummary[] {
  const profiles = new Map<
    string,
    {
      label: string;
      description: string;
      decisions: number;
      adherent: number;
      agreements: number;
      decisionMinutesTotal: number;
      decisionMinutesCount: number;
      followProbabilityTotal: number;
      followProbabilityCount: number;
      firms: Set<string>;
    }
  >();

  for (const row of rows) {
    const label = row.lawyer_profile_label ?? 'Sem perfil identificado';
    const description =
      row.lawyer_profile_description ?? 'Comportamento sem descricao sintetica registrada.';
    const key = `${label}::${description}`;
    const current = profiles.get(key) ?? {
      label,
      description,
      decisions: 0,
      adherent: 0,
      agreements: 0,
      decisionMinutesTotal: 0,
      decisionMinutesCount: 0,
      followProbabilityTotal: 0,
      followProbabilityCount: 0,
      firms: new Set<string>(),
    };

    current.decisions += 1;
    current.adherent += row.adherent ? 1 : 0;
    current.agreements += row.decision === 'ACORDO' ? 1 : 0;
    if (row.decision_minutes != null) {
      current.decisionMinutesTotal += row.decision_minutes;
      current.decisionMinutesCount += 1;
    }
    if (row.follow_probability != null) {
      current.followProbabilityTotal += row.follow_probability;
      current.followProbabilityCount += 1;
    }
    current.firms.add(row.firm_name);
    profiles.set(key, current);
  }

  return [...profiles.values()]
    .map((profile) => ({
      label: profile.label,
      description: profile.description,
      decisions: profile.decisions,
      adherenceRate: average(profile.adherent, profile.decisions),
      agreementRate: average(profile.agreements, profile.decisions),
      overrideRate: 1 - average(profile.adherent, profile.decisions),
      avgDecisionMinutes: profile.decisionMinutesCount
        ? average(profile.decisionMinutesTotal, profile.decisionMinutesCount)
        : null,
      avgFollowProbability: profile.followProbabilityCount
        ? average(profile.followProbabilityTotal, profile.followProbabilityCount)
        : null,
      firmCount: profile.firms.size,
    }))
    .sort(
      (left, right) => right.decisions - left.decisions || right.adherenceRate - left.adherenceRate,
    );
}

function summarizeFirms(rows: AdminDecisionRow[]): FirmSummary[] {
  const firms = new Map<
    string,
    {
      name: string;
      decisions: number;
      adherent: number;
      decisionMinutesTotal: number;
      decisionMinutesCount: number;
      profiles: Map<string, number>;
    }
  >();

  for (const row of rows) {
    const current = firms.get(row.firm_name) ?? {
      name: row.firm_name,
      decisions: 0,
      adherent: 0,
      decisionMinutesTotal: 0,
      decisionMinutesCount: 0,
      profiles: new Map<string, number>(),
    };

    current.decisions += 1;
    current.adherent += row.adherent ? 1 : 0;
    if (row.decision_minutes != null) {
      current.decisionMinutesTotal += row.decision_minutes;
      current.decisionMinutesCount += 1;
    }
    const profile = row.lawyer_profile_label ?? 'Sem perfil identificado';
    current.profiles.set(profile, (current.profiles.get(profile) ?? 0) + 1);
    firms.set(row.firm_name, current);
  }

  return [...firms.values()]
    .map((firm) => {
      const dominantProfile =
        [...firm.profiles.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
        'Sem perfil dominante';
      return {
        name: firm.name,
        decisions: firm.decisions,
        adherenceRate: average(firm.adherent, firm.decisions),
        avgDecisionMinutes: firm.decisionMinutesCount
          ? average(firm.decisionMinutesTotal, firm.decisionMinutesCount)
          : null,
        profileCount: firm.profiles.size,
        dominantProfile,
      };
    })
    .sort(
      (left, right) => right.decisions - left.decisions || right.adherenceRate - left.adherenceRate,
    );
}

function adherenceSignal(rate: number, baseline: number) {
  if (rate >= baseline + 0.08) return { label: 'Acima da média', tone: 'is-positive' };
  if (rate <= baseline - 0.08) return { label: 'Requer atenção', tone: 'is-warning' };
  return { label: 'Próximo da média', tone: 'is-neutral' };
}

function AdherenceHighlights({
  rows,
  overallAdherence,
}: {
  rows: AdminDecisionRow[];
  overallAdherence: number;
}) {
  const profiles = summarizeProfiles(rows);
  const firms = summarizeFirms(rows);
  const topAdherentProfile = [...profiles].sort(
    (left, right) => right.adherenceRate - left.adherenceRate || right.decisions - left.decisions,
  )[0];
  const highestDeviationFirm = [...firms].sort(
    (left, right) => left.adherenceRate - right.adherenceRate || right.decisions - left.decisions,
  )[0];
  const mostNegotiatingProfile = [...profiles].sort(
    (left, right) => right.agreementRate - left.agreementRate || right.decisions - left.decisions,
  )[0];

  return (
    <section className="admin-adherence-highlights" aria-label="Destaques da aderencia">
      {topAdherentProfile && (
        <article className="admin-highlight-card is-profile">
          <div className="admin-highlight-rank">Perfil #1 em aderencia</div>
          <div className="admin-highlight-head">
            <strong>{topAdherentProfile.label}</strong>
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <div className="admin-highlight-value">{percent(topAdherentProfile.adherenceRate)}</div>
          <p>
            {count(topAdherentProfile.decisions)} decisoes e{' '}
            {percent(topAdherentProfile.overrideRate)} de override.
          </p>
        </article>
      )}
      {highestDeviationFirm && (
        <article className="admin-highlight-card is-firm">
          <div className="admin-highlight-rank">Maior desvio da política</div>
          <div className="admin-highlight-head">
            <strong>{highestDeviationFirm.name}</strong>
            <GitBranch size={18} aria-hidden="true" />
          </div>
          <div className="admin-highlight-value">{percent(highestDeviationFirm.adherenceRate)}</div>
          <p>
            {adherenceSignal(highestDeviationFirm.adherenceRate, overallAdherence).label} com{' '}
            {count(highestDeviationFirm.profileCount)} perfis ativos.
          </p>
        </article>
      )}
      {mostNegotiatingProfile && (
        <article className="admin-highlight-card is-agreement">
          <div className="admin-highlight-rank">Perfil mais negociador</div>
          <div className="admin-highlight-head">
            <strong>{mostNegotiatingProfile.label}</strong>
            <Handshake size={18} aria-hidden="true" />
          </div>
          <div className="admin-highlight-value">
            {percent(mostNegotiatingProfile.agreementRate)}
          </div>
          <p>Participacao media de decisoes em acordo dentro do perfil comportamental.</p>
        </article>
      )}
    </section>
  );
}

function AdherenceHighlightsPanel({
  rows,
  overallAdherence,
}: {
  rows: AdminDecisionRow[];
  overallAdherence: number;
}) {
  return (
    <section
      className="panel admin-panel admin-adherence-panel admin-adherence-panel-overview"
      aria-labelledby="adherence-highlights-heading"
    >
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">LEITURA GERAL</span>
          <h2 id="adherence-highlights-heading">Panorama da aderencia</h2>
        </div>
        <ShieldCheck size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        Um resumo rapido dos sinais mais importantes da aderencia antes de abrir os detalhes.
      </p>
      <AdherenceHighlights rows={rows} overallAdherence={overallAdherence} />
    </section>
  );
}

function ProfileBehaviorPanel({ rows }: { rows: AdminDecisionRow[] }) {
  const [order, setOrder] = useState<'risk' | 'volume' | 'adherence'>('risk');
  const [query, setQuery] = useState('');
  const baseline = deriveAdminMetrics(rows).adherenceRate;
  const profiles = summarizeProfiles(rows)
    .filter((profile) => normalize(profile.label).includes(normalize(query)))
    .sort((left, right) => {
      if (order === 'volume') return right.decisions - left.decisions;
      if (order === 'adherence') return right.adherenceRate - left.adherenceRate;
      return left.adherenceRate - right.adherenceRate || right.decisions - left.decisions;
    });
  return (
    <section
      className="panel admin-panel admin-adherence-panel admin-adherence-panel-profiles"
      aria-labelledby="profile-behavior-heading"
    >
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">PERFIS COMPORTAMENTAIS</span>
          <h2 id="profile-behavior-heading">Como os perfis mudam a aderencia</h2>
        </div>
        <ShieldCheck size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        Compare a aderência observada com a média do recorte. A amostra permanece visível para
        evitar conclusões sobre grupos pouco representados.
      </p>
      <div className="admin-analysis-toolbar">
        <label className="admin-inline-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar perfil"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Ordenar por</span>
          <select value={order} onChange={(event) => setOrder(event.target.value as typeof order)}>
            <option value="risk">Maior desvio</option>
            <option value="volume">Maior volume</option>
            <option value="adherence">Maior aderência</option>
          </select>
        </label>
      </div>
      <div className="admin-ranking-list">
        {profiles.map((profile) => {
          const delta = profile.adherenceRate - baseline;
          return (
            <article className="admin-ranking-row" key={`${profile.label}-${profile.description}`}>
              <div className="admin-ranking-copy">
                <strong>{profile.label}</strong>
                <span>{profile.description}</span>
              </div>
              <div className="admin-ranking-visual">
                <div className="admin-ranking-values">
                  <strong>{percent(profile.adherenceRate)}</strong>
                  <span
                    className={delta < -0.08 ? 'is-critical' : delta > 0.08 ? 'is-positive' : ''}
                  >
                    {delta >= 0 ? '+' : ''}
                    {(delta * 100).toFixed(1)} p.p.
                  </span>
                  <small>{count(profile.decisions)} decisões</small>
                </div>
                <div className="admin-ranking-track" aria-hidden="true">
                  <i style={{ left: `${baseline * 100}%` }} />
                  <span style={{ width: `${profile.adherenceRate * 100}%` }} />
                </div>
                <div className="admin-ranking-meta">
                  <span>{percent(profile.overrideRate)} divergência</span>
                  {profile.avgFollowProbability != null && (
                    <span>{percent(profile.avgFollowProbability)} prevista</span>
                  )}
                  {profile.avgDecisionMinutes != null && (
                    <span>{count(Math.round(profile.avgDecisionMinutes))} min</span>
                  )}
                  <span>{count(profile.firmCount)} escritórios</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!profiles.length && <p className="admin-chart-empty">Nenhum perfil encontrado.</p>}
    </section>
  );
}

function FirmComparisonPanel({
  rows,
  overallAdherence,
}: {
  rows: AdminDecisionRow[];
  overallAdherence: number;
}) {
  const [order, setOrder] = useState<'risk' | 'volume' | 'adherence'>('risk');
  const [query, setQuery] = useState('');
  const firms = summarizeFirms(rows)
    .filter((firm) => normalize(firm.name).includes(normalize(query)))
    .sort((left, right) => {
      if (order === 'volume') return right.decisions - left.decisions;
      if (order === 'adherence') return right.adherenceRate - left.adherenceRate;
      return left.adherenceRate - right.adherenceRate || right.decisions - left.decisions;
    });
  return (
    <section
      className="panel admin-panel admin-adherence-panel admin-adherence-panel-firms"
      aria-labelledby="firm-comparison-heading"
    >
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">ESCRITORIOS COMPARADOS</span>
          <h2 id="firm-comparison-heading">Onde o comportamento muda</h2>
        </div>
        <GitBranch size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        O mix de perfis ajuda a explicar a aderência, o tempo de decisão e os desvios observados em
        cada escritório.
      </p>
      <div className="admin-analysis-toolbar">
        <label className="admin-inline-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar escritório"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Ordenar por</span>
          <select value={order} onChange={(event) => setOrder(event.target.value as typeof order)}>
            <option value="risk">Maior desvio</option>
            <option value="volume">Maior volume</option>
            <option value="adherence">Maior aderência</option>
          </select>
        </label>
      </div>
      <div className="admin-ranking-list">
        {firms.map((firm) => {
          const signal = adherenceSignal(firm.adherenceRate, overallAdherence);
          const delta = firm.adherenceRate - overallAdherence;
          return (
            <article className="admin-ranking-row" key={firm.name}>
              <div className="admin-ranking-copy">
                <strong>{firm.name}</strong>
                <span>Perfil dominante: {firm.dominantProfile}</span>
              </div>
              <div className="admin-ranking-visual">
                <div className="admin-ranking-values">
                  <strong>{percent(firm.adherenceRate)}</strong>
                  <span
                    className={delta < -0.08 ? 'is-critical' : delta > 0.08 ? 'is-positive' : ''}
                  >
                    {delta >= 0 ? '+' : ''}
                    {(delta * 100).toFixed(1)} p.p.
                  </span>
                  <small>{count(firm.decisions)} decisões</small>
                  <span className={`admin-firm-signal ${signal.tone}`}>{signal.label}</span>
                </div>
                <div className="admin-ranking-track" aria-hidden="true">
                  <i style={{ left: `${overallAdherence * 100}%` }} />
                  <span style={{ width: `${firm.adherenceRate * 100}%` }} />
                </div>
                <div className="admin-ranking-meta">
                  {firm.avgDecisionMinutes != null && (
                    <span>{count(Math.round(firm.avgDecisionMinutes))} min para decidir</span>
                  )}
                  <span>{count(firm.profileCount)} perfis ativos</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!firms.length && <p className="admin-chart-empty">Nenhum escritório encontrado.</p>}
    </section>
  );
}

function AdherenceModelCard({ rows }: { rows: AdminDecisionRow[] }) {
  const profiles = summarizeProfiles(rows);
  const firms = summarizeFirms(rows);
  const topProfile = profiles[0];
  const highestDeviationFirm = [...firms].sort(
    (left, right) => left.adherenceRate - right.adherenceRate,
  )[0];

  return (
    <section
      className="panel admin-panel admin-adherence-panel admin-adherence-panel-model"
      aria-labelledby="adherence-model-heading"
    >
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">O QUE ESTE MODELO TRAZ</span>
          <h2 id="adherence-model-heading">Aderencia explicavel, nao aleatoria</h2>
        </div>
        <Layers3 size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        Aqui a aderencia nao e apenas uma taxa final. Ela nasce de perfis comportamentais
        consistentes e de diferencas estruturais entre escritorios.
      </p>
      <div className="admin-model-points">
        <div className="admin-model-point">
          <Check size={15} aria-hidden="true" />
          <span>
            Cada perfil altera propensao de seguir a politica, ritmo de decisao e override.
          </span>
        </div>
        <div className="admin-model-point">
          <Check size={15} aria-hidden="true" />
          <span>
            Os escritorios nao diferem so por volume, mas pelo mix de perfis que concentram.
          </span>
        </div>
        <div className="admin-model-point">
          <Check size={15} aria-hidden="true" />
          <span>
            As diferencas continuam auditaveis no nivel do caso, com justificativa e sinais.
          </span>
        </div>
      </div>
      {(topProfile || highestDeviationFirm) && (
        <div className="admin-model-highlight">
          {topProfile && (
            <span>
              Perfil mais recorrente: <strong>{topProfile.label}</strong> com{' '}
              <strong>{percent(topProfile.adherenceRate)}</strong> de aderencia.
            </span>
          )}
          {highestDeviationFirm && (
            <span>
              Maior desvio da política na amostra: <strong>{highestDeviationFirm.name}</strong>.
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function EffectivenessOutcomeChart({ data }: { data: AdminDashboard['effectiveness_outcomes'] }) {
  return (
    <section className="panel admin-panel" aria-labelledby="effectiveness-outcomes-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">RESULTADO DAS NEGOCIACOES</span>
          <h2 id="effectiveness-outcomes-heading">Como as propostas terminaram</h2>
        </div>
        <Handshake size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        Composicao das tentativas de acordo no cenario de demonstracao.
      </p>
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
    </section>
  );
}

function SavingsFlowChart({ data }: { data: AdminDashboard['effectiveness_savings_flow'] }) {
  const maximum = Math.max(1, ...data.map((item) => item.value));
  return (
    <section className="panel admin-panel" aria-labelledby="savings-flow-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">WATERFALL FINANCEIRO</span>
          <h2 id="savings-flow-heading">Do custo-base ao custo projetado</h2>
        </div>
        <CircleDollarSign size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        Comparação entre custo-base, economia estimada e custo projetado com a política.
      </p>
      <div
        className="admin-waterfall"
        role="img"
        aria-label={data.map((item) => `${item.label}: ${money(item.value)}`).join('. ')}
      >
        {data.map((item, index) => (
          <div className={`admin-waterfall-item is-${index}`} key={item.label}>
            <strong>{money(item.value, true)}</strong>
            <div className="admin-waterfall-column" aria-hidden="true">
              <span
                className={`admin-chart-tone-${index % 3}`}
                style={{ height: `${Math.max(8, (item.value / maximum) * 100)}%` }}
              />
            </div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EffectivenessTimeline({ data }: { data: AdminDashboard['effectiveness_timeline'] }) {
  const maximum = Math.max(1, ...data.map((item) => item.savings));
  return (
    <section className="panel admin-panel" aria-labelledby="effectiveness-timeline-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">TRAJETORIA DA EFETIVIDADE</span>
          <h2 id="effectiveness-timeline-heading">Economia e aceitacao por mes</h2>
        </div>
        <Activity size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        A economia acumulada cresce junto da taxa de aceitacao ao longo do periodo.
      </p>
      <div className="admin-effectiveness-timeline" aria-hidden="true">
        {data.map((item) => (
          <div className="admin-effectiveness-period" key={item.label}>
            <div className="admin-effectiveness-bar-wrap">
              <span>{money(item.savings, true)}</span>
              <div
                className="admin-effectiveness-bar"
                style={{ height: `${(item.savings / maximum) * 100}%` }}
              />
            </div>
            <strong>{percent(item.acceptance_rate)}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentDecisions({ rows }: { rows: AdminDecisionRow[] }) {
  const recentRows = [...rows]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 4);
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
        {recentRows.map((row) => (
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
  const [sort, setSort] = useState<'recent' | 'oldest' | 'value' | 'critical'>('recent');
  const [page, setPage] = useState(1);
  const pageSize = 25;
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
  const filteredRows = useMemo(() => {
    const filtered = rows.filter((row) => {
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
    });
    return filtered.sort((left, right) => {
      if (sort === 'oldest') return left.created_at.localeCompare(right.created_at);
      if (sort === 'value') return (right.realized_value ?? 0) - (left.realized_value ?? 0);
      if (sort === 'critical') {
        const risk = (row: AdminDecisionRow) =>
          (!row.adherent ? 3 : 0) +
          (!row.adherent && !row.justification?.trim() ? 3 : 0) +
          ((row.confidence_score ?? 0) >= 0.8 ? 1 : 0) +
          ((row.completeness_band ?? '').toLocaleLowerCase('pt-BR') === 'baixa' ? 2 : 0);
        return risk(right) - risk(left);
      }
      return right.created_at.localeCompare(left.created_at);
    });
  }, [rows, filters, sort]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visiblePage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);
  const updateFilter = (name: keyof TableFilters, value: string) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
    setExpandedId(null);
  };
  const hasFilters = Object.values(filters).some(Boolean);

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
            <option value="override">Divergência</option>
          </select>
        </label>
        <label className="field">
          <span>Ordenar</span>
          <select
            className="select"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as typeof sort);
              setPage(1);
              setExpandedId(null);
            }}
          >
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
            <option value="value">Maior valor realizado</option>
            <option value="critical">Casos críticos</option>
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
              {visibleRows.map((row) => (
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
                        {row.adherent ? 'Aderente' : 'Divergência'}
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
                                <dt>Motivo da divergência</dt>
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
        <div>
          <Info size={14} aria-hidden="true" />
          <span>Valores e status refletem cada registro. Um traço indica dado indisponível.</span>
        </div>
        {filteredRows.length > pageSize && (
          <nav className="admin-pagination" aria-label="Paginação de decisões">
            <button
              type="button"
              disabled={visiblePage === 1}
              onClick={() => setPage(visiblePage - 1)}
            >
              Anterior
            </button>
            <span>
              Página {visiblePage} de {totalPages}
            </span>
            <button
              type="button"
              disabled={visiblePage === totalPages}
              onClick={() => setPage(visiblePage + 1)}
            >
              Próxima
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}

function DecisionStatusChart({ rows }: { rows: AdminDecisionRow[] }) {
  const statuses = new Map<string, number>();
  rows.forEach((row) => statuses.set(row.status, (statuses.get(row.status) ?? 0) + 1));
  const data = [...statuses.entries()]
    .map(([label, value]) => ({ label: humanizeToken(label), value }))
    .sort((left, right) => right.value - left.value);
  const maximum = Math.max(1, ...data.map((item) => item.value));
  return (
    <section className="panel admin-panel" aria-labelledby="decision-status-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">FLUXO OPERACIONAL</span>
          <h2 id="decision-status-heading">Decisões por status</h2>
        </div>
        <FileCheck2 size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">Distribuição dos registros no recorte atual.</p>
      <div className="admin-status-bars">
        {data.map((item, index) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <i>
              <b
                className={`admin-chart-tone-${index % 3}`}
                style={{ width: `${(item.value / maximum) * 100}%` }}
              />
            </i>
            <strong>{count(item.value)}</strong>
            <small>{percent(item.value / Math.max(1, rows.length))}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ConfidenceAdherenceChart({ rows }: { rows: AdminDecisionRow[] }) {
  const groups = new Map<string, { total: number; adherent: number; overrides: number }>();
  rows.forEach((row) => {
    const label = row.confidence_band ?? 'Sem classificação';
    const current = groups.get(label) ?? { total: 0, adherent: 0, overrides: 0 };
    current.total += 1;
    current.adherent += row.adherent ? 1 : 0;
    current.overrides += row.adherent ? 0 : 1;
    groups.set(label, current);
  });
  const data = [...groups.entries()]
    .map(([label, values]) => ({ ...values, label, rate: values.adherent / values.total }))
    .sort((left, right) => right.rate - left.rate);
  return (
    <section className="panel admin-panel" aria-labelledby="confidence-adherence-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">CONFIANÇA × ADERÊNCIA</span>
          <h2 id="confidence-adherence-heading">Resposta à confiança da recomendação</h2>
        </div>
        <Target size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        Taxa observada e divergências em cada faixa de confiança.
      </p>
      <div className="admin-confidence-grid">
        {data.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{percent(item.rate)}</strong>
            <div aria-hidden="true">
              <i style={{ width: `${item.rate * 100}%` }} />
            </div>
            <small>
              {count(item.overrides)} divergências · {count(item.total)} decisões
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}

function Decisions({ rows }: { rows: AdminDecisionRow[] }) {
  type DecisionView = 'table' | 'status' | 'confidence' | 'values' | 'firms' | 'critical';
  const [activeView, setActiveView] = useQueryView<DecisionView>('table', [
    'table',
    'status',
    'confidence',
    'values',
    'firms',
    'critical',
  ]);
  const overallAdherence = deriveAdminMetrics(rows).adherenceRate;
  return (
    <>
      <ViewSwitcher
        label="Visualizações das decisões"
        options={[
          { id: 'table', label: 'Tabela' },
          { id: 'status', label: 'Status' },
          { id: 'confidence', label: 'Confiança × aderência' },
          { id: 'values', label: 'Valores' },
          { id: 'firms', label: 'Por escritório' },
          { id: 'critical', label: 'Prioridades' },
        ]}
        value={activeView}
        onChange={(id) => setActiveView(id as DecisionView)}
      />
      <div className="admin-view-stage">
        {activeView === 'table' && <DecisionTable rows={rows} />}
        {activeView === 'status' && <DecisionStatusChart rows={rows} />}
        {activeView === 'confidence' && <ConfidenceAdherenceChart rows={rows} />}
        {activeView === 'values' && <ValueComparisonChart rows={rows} />}
        {activeView === 'firms' && (
          <FirmComparisonPanel rows={rows} overallAdherence={overallAdherence} />
        )}
        {activeView === 'critical' && <CriticalDecisions rows={rows} />}
      </div>
    </>
  );
}

function Overview({ data, rows }: { data: AdminDashboard; rows: AdminDecisionRow[] }) {
  type OverviewView = 'evolution' | 'distribution' | 'firms' | 'funnel' | 'recent';
  const metrics = deriveAdminMetrics(rows);
  const financials = scopedFinancials(data, rows);
  const [activeView, setActiveView] = useQueryView<OverviewView>('evolution', [
    'evolution',
    'distribution',
    'firms',
    'funnel',
    'recent',
  ]);
  return (
    <>
      <MetricGrid
        items={[
          {
            label: 'Decisões registradas',
            value: count(metrics.decisions),
            hint: `${percent(metrics.highConfidenceRate)} com alta confiança`,
            icon: Users,
          },
          {
            label: 'Aderência geral',
            value: percent(metrics.adherenceRate),
            hint: `${percent(metrics.completeRate)} com documentação completa`,
            icon: ShieldCheck,
            accent: true,
          },
          {
            label: 'Taxa de divergência',
            value: percent(metrics.overrideRate),
            hint: `${count(metrics.overrides)} decisões fora da recomendação`,
            icon: GitBranch,
          },
          {
            label: 'Economia estimada',
            value: money(financials.estimatedSavings, true),
            hint: financials.proportionallyAllocated
              ? 'Estimativa proporcional à exposição filtrada'
              : 'Frente ao cenário-base de judicialização',
            icon: CircleDollarSign,
          },
        ]}
      />
      <ViewSwitcher
        label="Visualizações da visão geral"
        options={[
          { id: 'evolution', label: 'Evolução' },
          { id: 'distribution', label: 'Distribuição' },
          { id: 'firms', label: 'Aderência por escritório' },
          { id: 'funnel', label: 'Funil de acordos' },
          { id: 'recent', label: 'Últimas decisões' },
        ]}
        value={activeView}
        onChange={(id) => setActiveView(id as OverviewView)}
      />
      <div className="admin-view-stage">
        {activeView === 'evolution' && <EvolutionChart data={createMonthlyEvolution(rows)} />}
        {activeView === 'distribution' && (
          <DistributionChart data={createRecommendationDistribution(rows)} />
        )}
        {activeView === 'firms' && (
          <FirmComparisonPanel rows={rows} overallAdherence={metrics.adherenceRate} />
        )}
        {activeView === 'funnel' && <NegotiationFunnel rows={rows} />}
        {activeView === 'recent' && <RecentDecisions rows={rows} />}
      </div>
      <AttentionPanel rows={rows} />
    </>
  );
}
function Adherence({ rows }: { rows: AdminDecisionRow[] }) {
  type AdherenceView =
    | 'profiles'
    | 'firms'
    | 'heatmap'
    | 'scatter'
    | 'overrides'
    | 'calibration'
    | 'highlights'
    | 'model';
  const target = 0.7;
  const metrics = deriveAdminMetrics(rows);
  const [activeView, setActiveView] = useQueryView<AdherenceView>('profiles', [
    'profiles',
    'firms',
    'heatmap',
    'scatter',
    'overrides',
    'calibration',
    'highlights',
    'model',
  ]);
  return (
    <>
      <MetricGrid
        items={[
          {
            label: 'Aderência geral',
            value: percent(metrics.adherenceRate),
            hint: `${count(metrics.decisions)} decisões no recorte`,
            icon: ShieldCheck,
            accent: true,
          },
          {
            label: 'Diferença para a meta',
            value: `${metrics.adherenceRate - target >= 0 ? '+' : ''}${((metrics.adherenceRate - target) * 100).toFixed(1)} p.p.`,
            hint: `Meta operacional de ${percent(target)}`,
            icon: Target,
          },
          {
            label: 'Divergências registradas',
            value: count(metrics.overrides),
            hint: `${percent(metrics.overrideRate)} das decisões`,
            icon: GitBranch,
          },
          {
            label: 'Sem justificativa',
            value: count(metrics.overridesWithoutJustification),
            hint: `${percent(metrics.justificationCoverage)} de cobertura`,
            icon: AlertTriangle,
          },
        ]}
      />
      <ViewSwitcher
        label="Visualizações da aderência"
        options={[
          { id: 'profiles', label: 'Perfis' },
          { id: 'firms', label: 'Escritórios' },
          { id: 'heatmap', label: 'Mapa perfil × escritório' },
          { id: 'scatter', label: 'Volume × aderência' },
          { id: 'overrides', label: 'Motivos' },
          { id: 'calibration', label: 'Previsto × observado' },
          { id: 'highlights', label: 'Destaques' },
          { id: 'model', label: 'Como funciona' },
        ]}
        value={activeView}
        onChange={(id) => setActiveView(id as AdherenceView)}
      />
      <div className="admin-view-stage">
        {activeView === 'highlights' && (
          <AdherenceHighlightsPanel rows={rows} overallAdherence={metrics.adherenceRate} />
        )}
        {activeView === 'profiles' && <ProfileBehaviorPanel rows={rows} />}
        {activeView === 'firms' && (
          <FirmComparisonPanel rows={rows} overallAdherence={metrics.adherenceRate} />
        )}
        {activeView === 'heatmap' && <AdherenceHeatmap rows={rows} />}
        {activeView === 'scatter' && <BehaviorScatter rows={rows} />}
        {activeView === 'overrides' && <OverrideReasons data={createOverrideReasons(rows)} />}
        {activeView === 'calibration' && <CalibrationChart rows={rows} />}
        {activeView === 'model' && <AdherenceModelCard rows={rows} />}
      </div>
      <div className="admin-end-link">
        <span>As análises mantêm o tamanho da amostra visível e podem ser auditadas por caso.</span>
        <Link className="admin-text-link" to="/admin/decisions">
          Explorar decisões <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}

function AdherenceHeatmap({ rows }: { rows: AdminDecisionRow[] }) {
  const profiles = summarizeProfiles(rows);
  const firms = summarizeFirms(rows);
  const baseline = deriveAdminMetrics(rows).adherenceRate;
  const cells = new Map<string, { total: number; adherent: number }>();
  rows.forEach((row) => {
    const profile = row.lawyer_profile_label ?? 'Sem perfil identificado';
    const key = `${row.firm_name}::${profile}`;
    const current = cells.get(key) ?? { total: 0, adherent: 0 };
    current.total += 1;
    current.adherent += row.adherent ? 1 : 0;
    cells.set(key, current);
  });

  return (
    <section className="panel admin-panel" aria-labelledby="heatmap-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">CRUZAMENTO COMPORTAMENTAL</span>
          <h2 id="heatmap-heading">Aderência por perfil e escritório</h2>
        </div>
        <Building2 size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        Cada célula combina taxa observada e quantidade de decisões. Células abaixo da média recebem
        maior contraste.
      </p>
      {profiles.length && firms.length ? (
        <div
          className="admin-heatmap-scroll"
          tabIndex={0}
          role="region"
          aria-label="Mapa de calor de aderência"
        >
          <table className="admin-heatmap">
            <thead>
              <tr>
                <th>Escritório</th>
                {profiles.map((profile) => (
                  <th key={profile.label}>{profile.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {firms.map((firm) => (
                <tr key={firm.name}>
                  <th>{firm.name}</th>
                  {profiles.map((profile) => {
                    const cell = cells.get(`${firm.name}::${profile.label}`);
                    const rate = cell ? cell.adherent / cell.total : null;
                    const tone =
                      rate == null
                        ? 'is-empty'
                        : rate <= baseline - 0.08
                          ? 'is-critical'
                          : rate >= baseline + 0.08
                            ? 'is-positive'
                            : 'is-neutral';
                    return (
                      <td key={profile.label} className={tone}>
                        <strong>{rate == null ? '—' : percent(rate)}</strong>
                        <span>{cell ? `${count(cell.total)} casos` : 'Sem amostra'}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="admin-chart-empty">Sem dados suficientes para o cruzamento.</p>
      )}
    </section>
  );
}

function BehaviorScatter({ rows }: { rows: AdminDecisionRow[] }) {
  const profiles = summarizeProfiles(rows);
  const maximum = Math.max(1, ...profiles.map((profile) => profile.decisions));
  return (
    <section className="panel admin-panel" aria-labelledby="scatter-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">VOLUME × ADERÊNCIA</span>
          <h2 id="scatter-heading">Onde o desvio ganha escala</h2>
        </div>
        <BarChart3 size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        Perfis mais à esquerda aderem menos; pontos maiores representam mais decisões.
      </p>
      {profiles.length ? (
        <>
          <div
            className="admin-scatter"
            role="img"
            aria-label="Dispersão de volume e aderência por perfil"
          >
            <div className="admin-scatter-grid" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            {profiles.map((profile, index) => (
              <span
                key={`${profile.label}-${profile.description}`}
                className={`admin-scatter-point admin-chart-tone-${index % 3}`}
                style={{
                  left: `${Math.min(96, Math.max(4, profile.adherenceRate * 100))}%`,
                  bottom: `${Math.min(90, 8 + (profile.decisions / maximum) * 78)}%`,
                  width: `${14 + (profile.decisions / maximum) * 22}px`,
                  height: `${14 + (profile.decisions / maximum) * 22}px`,
                }}
                title={`${profile.label}: ${percent(profile.adherenceRate)}, ${count(profile.decisions)} decisões`}
              />
            ))}
            <span className="admin-scatter-axis is-x">Aderência →</span>
            <span className="admin-scatter-axis is-y">Volume →</span>
          </div>
          <div className="admin-scatter-legend">
            {profiles.map((profile, index) => (
              <span key={`${profile.label}-${index}`}>
                <i className={`admin-chart-tone-${index % 3}`} />
                {profile.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="admin-chart-empty">Sem perfis no recorte atual.</p>
      )}
    </section>
  );
}

function CalibrationChart({ rows }: { rows: AdminDecisionRow[] }) {
  const profiles = summarizeProfiles(rows).filter(
    (profile) => profile.avgFollowProbability != null,
  );
  return (
    <section className="panel admin-panel" aria-labelledby="calibration-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">PREVISTO × OBSERVADO</span>
          <h2 id="calibration-heading">Calibração do modelo comportamental</h2>
        </div>
        <Gauge size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        Quanto menor a diferença, melhor a propensão prevista representa o comportamento observado.
      </p>
      <div className="admin-calibration-list">
        {profiles.map((profile) => {
          const predicted = profile.avgFollowProbability!;
          const gap = profile.adherenceRate - predicted;
          return (
            <div className="admin-calibration-row" key={`${profile.label}-${profile.description}`}>
              <strong>{profile.label}</strong>
              <div className="admin-calibration-track" aria-hidden="true">
                <span className="is-predicted" style={{ left: `${predicted * 100}%` }} />
                <span className="is-observed" style={{ left: `${profile.adherenceRate * 100}%` }} />
              </div>
              <div>
                <span>Prevista {percent(predicted)}</span>
                <span>Observada {percent(profile.adherenceRate)}</span>
                <strong className={Math.abs(gap) > 0.08 ? 'is-critical' : ''}>
                  {gap >= 0 ? '+' : ''}
                  {(gap * 100).toFixed(1)} p.p.
                </strong>
              </div>
            </div>
          );
        })}
      </div>
      {!profiles.length && <p className="admin-chart-empty">Sem previsões no recorte atual.</p>}
    </section>
  );
}

function AttentionPanel({ rows }: { rows: AdminDecisionRow[] }) {
  const metrics = deriveAdminMetrics(rows);
  const lowestFirm = summarizeFirms(rows).sort(
    (left, right) => left.adherenceRate - right.adherenceRate,
  )[0];
  const items = [
    metrics.overridesWithoutJustification > 0
      ? {
          title: `${count(metrics.overridesWithoutJustification)} divergências sem justificativa`,
          detail: 'Registros que exigem complementação para manter a trilha de auditoria.',
          tone: 'critical',
        }
      : null,
    metrics.highConfidenceOverrides > 0
      ? {
          title: `${count(metrics.highConfidenceOverrides)} divergências de alta confiança`,
          detail: 'Casos em que a recomendação tinha confiança igual ou superior a 80%.',
          tone: 'warning',
        }
      : null,
    lowestFirm
      ? {
          title: `${lowestFirm.name} requer atenção`,
          detail: `${percent(lowestFirm.adherenceRate)} de aderência em ${count(lowestFirm.decisions)} decisões.`,
          tone: 'neutral',
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item != null);

  return (
    <section className="admin-attention" aria-labelledby="attention-heading">
      <div className="admin-attention-heading">
        <div>
          <span className="admin-section-kicker">PRIORIZAÇÃO</span>
          <h2 id="attention-heading">Pontos de atenção</h2>
        </div>
        <span>{items.length} sinais</span>
      </div>
      <div className="admin-attention-grid">
        {items.map((item) => (
          <article className={`is-${item.tone}`} key={item.title}>
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NegotiationFunnel({ rows }: { rows: AdminDecisionRow[] }) {
  const metrics = deriveAdminMetrics(rows);
  const maximum = Math.max(1, metrics.proposals);
  const stages = [
    { label: 'Propostas', value: metrics.proposals, tone: 'is-info' },
    { label: 'Aceitas', value: metrics.accepted, tone: 'is-positive' },
    { label: 'Contrapropostas', value: metrics.counteroffers, tone: 'is-warning' },
    { label: 'Recusadas', value: metrics.rejected, tone: 'is-critical' },
  ];
  return (
    <section className="panel admin-panel" aria-labelledby="funnel-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">FUNIL DE NEGOCIAÇÃO</span>
          <h2 id="funnel-heading">Destino das propostas</h2>
        </div>
        <Handshake size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        Conversão e desfecho das propostas no recorte atual.
      </p>
      <div className="admin-funnel">
        {stages.map((stage) => (
          <div className="admin-funnel-row" key={stage.label}>
            <span>{stage.label}</span>
            <div>
              <i className={stage.tone} style={{ width: `${(stage.value / maximum) * 100}%` }} />
            </div>
            <strong>{count(stage.value)}</strong>
            <small>{percent(stage.value / maximum)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ValueComparisonChart({ rows }: { rows: AdminDecisionRow[] }) {
  const metrics = deriveAdminMetrics(rows);
  const offered = metrics.averageOfferedValue ?? 0;
  const closed = metrics.averageClosedValue ?? 0;
  const maximum = Math.max(1, offered, closed);
  return (
    <section className="panel admin-panel" aria-labelledby="value-comparison-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">VALORES NEGOCIADOS</span>
          <h2 id="value-comparison-heading">Sugerido × realizado</h2>
        </div>
        <CircleDollarSign size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        Comparação entre a oferta sugerida e o valor final dos acordos aceitos.
      </p>
      <div className="admin-value-comparison">
        <div>
          <span>Valor médio sugerido</span>
          <strong>{money(offered, true)}</strong>
          <i>
            <b style={{ width: `${(offered / maximum) * 100}%` }} />
          </i>
        </div>
        <div>
          <span>Valor médio realizado</span>
          <strong>{money(closed, true)}</strong>
          <i>
            <b className="is-realized" style={{ width: `${(closed / maximum) * 100}%` }} />
          </i>
        </div>
      </div>
      <div className="admin-value-summary">
        <span>
          Diferença média <strong>{money(metrics.averageValueDifference ?? 0, true)}</strong>
        </span>
        <span>
          Desconto médio <strong>{percent(metrics.averageDiscountRate ?? 0)}</strong>
        </span>
        <span>
          Diferença observada <strong>{money(metrics.observedNegotiationDifference, true)}</strong>
        </span>
      </div>
    </section>
  );
}

function CriticalDecisions({ rows }: { rows: AdminDecisionRow[] }) {
  const critical = rows
    .filter(
      (row) =>
        (!row.adherent && (!row.justification?.trim() || (row.confidence_score ?? 0) >= 0.8)) ||
        (row.completeness_band ?? '').toLocaleLowerCase('pt-BR') === 'baixa' ||
        (row.suggested_value != null &&
          row.realized_value != null &&
          Math.abs(row.realized_value - row.suggested_value) / Math.max(1, row.suggested_value) >=
            0.25),
    )
    .slice(0, 5);
  return (
    <section className="panel admin-panel" aria-labelledby="critical-decisions-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">TRIAGEM</span>
          <h2 id="critical-decisions-heading">Casos que pedem revisão</h2>
        </div>
        <AlertTriangle size={19} aria-hidden="true" />
      </div>
      <div className="admin-critical-list">
        {critical.map((row) => (
          <article key={row.id}>
            <div>
              <strong>{row.case_number}</strong>
              <span>
                {row.lawyer_name} · {row.firm_name}
              </span>
            </div>
            <span>{!row.adherent ? 'Divergência' : 'Qualidade documental'}</span>
          </article>
        ))}
      </div>
      {!critical.length && (
        <p className="admin-chart-empty">Nenhum caso crítico no recorte atual.</p>
      )}
    </section>
  );
}

function Effectiveness({ data, rows }: { data: AdminDashboard; rows: AdminDecisionRow[] }) {
  type EffectivenessView = 'savings' | 'outcomes' | 'timeline' | 'funnel' | 'values' | 'simulation';
  const metrics = deriveAdminMetrics(rows);
  const financials = scopedFinancials(data, rows);
  const simulation = data.historical_simulation;
  const [activeView, setActiveView] = useQueryView<EffectivenessView>('savings', [
    'savings',
    'outcomes',
    'timeline',
    'funnel',
    'values',
    'simulation',
  ]);
  const savingsPerAgreement = metrics.accepted ? financials.estimatedSavings / metrics.accepted : 0;
  const savingsFlow = [
    { label: 'Custo sem política', value: financials.baselineCost },
    { label: 'Economia estimada', value: financials.estimatedSavings },
    { label: 'Custo com política', value: financials.projectedCost },
  ];
  return (
    <>
      <div className="admin-subsection-heading">
        <div>
          <span className="admin-section-kicker">RESULTADOS DA OPERAÇÃO</span>
          <h2>Da proposta à economia</h2>
        </div>
        <DemoLabel />
      </div>
      <MetricGrid
        items={[
          {
            label: 'Economia estimada',
            value: money(financials.estimatedSavings, true),
            hint: financials.proportionallyAllocated
              ? 'Rateio pela exposição de valores sugeridos'
              : 'Redução frente ao cenário-base',
            icon: CircleDollarSign,
            accent: true,
          },
          {
            label: 'Redução de custo',
            value: percent(financials.savingsRate),
            hint: 'Percentual economizado com a política',
            icon: ArrowDownLeft,
          },
          {
            label: 'Taxa de aceitação',
            value: percent(metrics.acceptanceRate),
            hint: `${count(metrics.accepted)} de ${count(metrics.proposals)} propostas`,
            icon: Handshake,
          },
          {
            label: 'Economia média por acordo',
            value: money(savingsPerAgreement, true),
            hint: `${percent(metrics.averageDiscountRate ?? 0)} de desconto médio observado`,
            icon: CircleDollarSign,
          },
        ]}
      />
      <div className="admin-operational-summary">
        <Activity size={18} aria-hidden="true" />
        <span>
          A economia permanece estimativa; ROI não é calculado sem custo operacional real.
        </span>
        <strong>{money(financials.estimatedSavings, true)}</strong>
        <span className="admin-operational-scope">Cenário demonstrativo</span>
      </div>
      <ViewSwitcher
        label="Visualizações da efetividade"
        options={[
          { id: 'savings', label: 'Economia' },
          { id: 'outcomes', label: 'Resultados' },
          { id: 'timeline', label: 'Trajetória' },
          { id: 'funnel', label: 'Funil' },
          { id: 'values', label: 'Valores' },
          { id: 'simulation', label: 'Simulação' },
        ]}
        value={activeView}
        onChange={(id) => setActiveView(id as EffectivenessView)}
      />
      <div className="admin-view-stage admin-effectiveness-stage">
        {activeView === 'savings' && <SavingsFlowChart data={savingsFlow} />}
        {activeView === 'outcomes' && (
          <EffectivenessOutcomeChart data={createOutcomeDistribution(rows)} />
        )}
        {activeView === 'timeline' && (
          <EffectivenessTimeline data={createEffectivenessTimeline(rows)} />
        )}
        {activeView === 'funnel' && <NegotiationFunnel rows={rows} />}
        {activeView === 'values' && <ValueComparisonChart rows={rows} />}
      </div>
      {activeView === 'simulation' && (
        <section className="admin-simulation" aria-labelledby="simulation-heading">
          <div className="admin-simulation-heading">
            <div>
              <span className="admin-section-kicker">UMA OUTRA PERSPECTIVA</span>
              <h2 id="simulation-heading">Simulacao sobre a base historica</h2>
              <p>Um cenario estimado para comparacao, separado dos resultados operacionais.</p>
            </div>
            <DemoLabel simulation />
          </div>
          <div className="admin-simulation-metrics">
            <div>
              <span>Custo de referencia</span>
              <strong>{money(simulation.baseline_cost, true)}</strong>
              <small>Referencia historica</small>
            </div>
            <div>
              <span>Custo projetado</span>
              <strong>{money(simulation.projected_cost, true)}</strong>
              <small>No cenario simulado</small>
            </div>
            <div className="admin-simulation-saving">
              <span>Economia estimada</span>
              <strong>{money(simulation.estimated_savings, true)}</strong>
              <small>{percent(financials.savingsRate)} de redução no custo</small>
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
                Hipotese de aceitacao <strong>{percent(simulation.acceptance_assumption)}</strong>
              </span>
            </div>
          </div>
          <div className="admin-simulation-note">
            <Info size={16} aria-hidden="true" />
            <p>{simulation.description}</p>
          </div>
        </section>
      )}
      <div className="admin-end-link">
        <span>Os resultados individuais continuam disponiveis no registro da operacao.</span>
        <Link className="admin-text-link" to="/admin/decisions">
          Explorar decisoes <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
export default function AdminPage() {
  const { section: sectionParam } = useParams<{ section?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const section: AdminSection =
    sectionParam && Object.hasOwn(sectionCopy, sectionParam)
      ? (sectionParam as AdminSection)
      : 'overview';
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const filters = useMemo(() => readAdminFilters(searchParams), [searchParams]);
  const filteredRows = useMemo(
    () => (data ? filterAdminRows(data.decisions, filters) : []),
    [data, filters],
  );
  const updateFilters = useCallback(
    (nextFilters: AdminFilters) => {
      const nextParams = new URLSearchParams(searchParams);
      filterQueryKeys.forEach((key) => {
        const value = nextFilters[key];
        if (!value || (key === 'period' && value === 'all')) nextParams.delete(key);
        else nextParams.set(key, value);
      });
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  const clearFilters = useCallback(() => updateFilters(emptyAdminFilters), [updateFilters]);
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
          <GlobalFilters
            rows={data.decisions}
            filters={filters}
            onChange={updateFilters}
            onClear={clearFilters}
          />
          <div className="admin-scope-line" aria-live="polite">
            <span>{count(filteredRows.length)} decisões no recorte atual</span>
            {hasActiveAdminFilters(filters) && <strong>Filtros globais ativos</strong>}
          </div>
          {section === 'overview' && <Overview data={data} rows={filteredRows} />}
          {section === 'adherence' && <Adherence rows={filteredRows} />}
          {section === 'effectiveness' && <Effectiveness data={data} rows={filteredRows} />}
          {section === 'decisions' && <Decisions rows={filteredRows} />}
        </>
      ) : null}
    </div>
  );
}
