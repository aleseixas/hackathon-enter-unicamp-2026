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
  Handshake,
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
      <p className="admin-panel-description">Motivos das divergências no cenário de demonstração.</p>
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
    .sort((left, right) => right.decisions - left.decisions || right.adherenceRate - left.adherenceRate);
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
    .sort((left, right) => right.decisions - left.decisions || right.adherenceRate - left.adherenceRate);
}

function adherenceSignal(rate: number, baseline: number) {
  if (rate >= baseline + 0.08) return { label: 'Acima da media', tone: 'is-positive' };
  if (rate <= baseline - 0.08) return { label: 'Mais autonomo', tone: 'is-warning' };
  return { label: 'Proximo da media', tone: 'is-neutral' };
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
  const mostAutonomousFirm = [...firms].sort(
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
            {count(topAdherentProfile.decisions)} decisoes e {percent(topAdherentProfile.overrideRate)}{' '}
            de override.
          </p>
        </article>
      )}
      {mostAutonomousFirm && (
        <article className="admin-highlight-card is-firm">
          <div className="admin-highlight-rank">Escritorio mais autonomo</div>
          <div className="admin-highlight-head">
            <strong>{mostAutonomousFirm.name}</strong>
            <GitBranch size={18} aria-hidden="true" />
          </div>
          <div className="admin-highlight-value">{percent(mostAutonomousFirm.adherenceRate)}</div>
          <p>
            {adherenceSignal(mostAutonomousFirm.adherenceRate, overallAdherence).label} com{' '}
            {count(mostAutonomousFirm.profileCount)} perfis ativos.
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
          <div className="admin-highlight-value">{percent(mostNegotiatingProfile.agreementRate)}</div>
          <p>
            Participacao media de decisoes em acordo dentro do perfil comportamental.
          </p>
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
  const profiles = summarizeProfiles(rows).slice(0, 4);
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
        O modelo diferencia cada advogado por propensao de seguir a politica, tempo de decisao
        e padrao de override.
      </p>
      <div className="admin-profile-list">
        {profiles.map((profile) => (
          <article className="admin-profile-card" key={profile.label}>
            <div className="admin-profile-card-top">
              <div>
                <strong>{profile.label}</strong>
                <span>{count(profile.decisions)} decisoes observadas</span>
              </div>
              <span className="admin-profile-rate">{percent(profile.adherenceRate)} aderencia</span>
            </div>
            <p>{profile.description}</p>
            <div className="admin-profile-meta">
              <span>{count(profile.firmCount)} escritorios</span>
              {profile.avgFollowProbability != null && (
                <span>{percent(profile.avgFollowProbability)} propensao media</span>
              )}
              {profile.avgDecisionMinutes != null && (
                <span>{count(Math.round(profile.avgDecisionMinutes))} min para decidir</span>
              )}
              <span>{percent(profile.overrideRate)} override</span>
            </div>
            <div className="admin-profile-track" aria-hidden="true">
              <span style={{ width: `${profile.adherenceRate * 100}%` }} />
            </div>
          </article>
        ))}
      </div>
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
  const firms = summarizeFirms(rows).slice(0, 5);
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
        O mix de perfis muda a aderencia observada, o tempo medio de decisao e o tipo de desvio
        mais provavel em cada escritorio.
      </p>
      <div className="admin-firm-list">
        {firms.map((firm) => {
          const signal = adherenceSignal(firm.adherenceRate, overallAdherence);
          return (
            <article className="admin-firm-row" key={firm.name}>
              <div className="admin-firm-top">
                <div>
                  <strong>{firm.name}</strong>
                  <span>{firm.dominantProfile}</span>
                </div>
                <span className={`admin-firm-signal ${signal.tone}`}>{signal.label}</span>
              </div>
              <div className="admin-firm-stats">
                <span>{percent(firm.adherenceRate)} aderencia</span>
                <span>{count(firm.decisions)} decisoes</span>
                {firm.avgDecisionMinutes != null && (
                  <span>{count(Math.round(firm.avgDecisionMinutes))} min</span>
                )}
                <span>{count(firm.profileCount)} perfis ativos</span>
              </div>
              <div className="admin-firm-track" aria-hidden="true">
                <span style={{ width: `${firm.adherenceRate * 100}%` }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AdherenceModelCard({ rows }: { rows: AdminDecisionRow[] }) {
  const profiles = summarizeProfiles(rows);
  const firms = summarizeFirms(rows);
  const topProfile = profiles[0];
  const mostAutonomousFirm = [...firms].sort((left, right) => left.adherenceRate - right.adherenceRate)[0];

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
          <span>Cada perfil altera propensao de seguir a politica, ritmo de decisao e override.</span>
        </div>
        <div className="admin-model-point">
          <Check size={15} aria-hidden="true" />
          <span>Os escritorios nao diferem so por volume, mas pelo mix de perfis que concentram.</span>
        </div>
        <div className="admin-model-point">
          <Check size={15} aria-hidden="true" />
          <span>As diferencas continuam auditaveis no nivel do caso, com justificativa e sinais.</span>
        </div>
      </div>
      {(topProfile || mostAutonomousFirm) && (
        <div className="admin-model-highlight">
          {topProfile && (
            <span>
              Perfil mais recorrente: <strong>{topProfile.label}</strong> com{' '}
              <strong>{percent(topProfile.adherenceRate)}</strong> de aderencia.
            </span>
          )}
          {mostAutonomousFirm && (
            <span>
              Escritorio mais autonomo na amostra: <strong>{mostAutonomousFirm.name}</strong>.
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function EffectivenessOutcomeChart({
  data,
}: {
  data: AdminDashboard['effectiveness_outcomes'];
}) {
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

function SavingsFlowChart({
  data,
}: {
  data: AdminDashboard['effectiveness_savings_flow'];
}) {
  const maximum = Math.max(1, ...data.map((item) => item.value));
  return (
    <section className="panel admin-panel" aria-labelledby="savings-flow-heading">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-kicker">ECONOMIA GERADA</span>
          <h2 id="savings-flow-heading">Onde a economia aparece</h2>
        </div>
        <CircleDollarSign size={19} aria-hidden="true" />
      </div>
      <p className="admin-panel-description">
        Comparacao entre custo base, economia estimada e custo projetado com a politica.
      </p>
      <div className="admin-savings-flow">
        {data.map((item, index) => (
          <div className="admin-savings-row" key={item.label}>
            <div className="admin-savings-copy">
              <span>{item.label}</span>
              <strong>{money(item.value, true)}</strong>
            </div>
            <div className="admin-savings-track" aria-hidden="true">
              <span
                className={`admin-chart-tone-${index % 3}`}
                style={{ width: `${(item.value / maximum) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EffectivenessTimeline({
  data,
}: {
  data: AdminDashboard['effectiveness_timeline'];
}) {
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
            <option value="override">Divergência</option>
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
  const [activeView, setActiveView] = useState<'evolution' | 'distribution' | 'override' | 'recent'>(
    'evolution',
  );
  return (
    <>
      <MetricGrid
        items={[
          {
            label: 'Decisoes registradas',
            value: count(metrics.decisions),
            hint: 'No periodo demonstrado',
            icon: FileCheck2,
          },
          {
            label: 'Aderencia a politica',
            value: percent(metrics.adherence_rate),
            hint: 'Decisoes alinhadas a recomendacao',
            icon: ShieldCheck,
            accent: true,
          },
          {
            label: 'Divergencias',
            value: count(metrics.overrides),
            hint: 'Decisoes com divergencia',
            icon: GitBranch,
          },
          {
            label: 'Acordos fechados',
            value: count(metrics.settlements),
            hint: 'Negociacoes concluidas',
            icon: CheckCheck,
          },
          {
            label: 'Taxa de aceitacao',
            value: percent(metrics.acceptance_rate),
            hint: 'Propostas aceitas no periodo',
            icon: ShieldCheck,
          },
          {
            label: 'Valor medio fechado',
            value: money(metrics.average_closed_value, true),
            hint: 'Por acordo fechado',
            icon: CircleDollarSign,
          },
        ]}
      />
      <ViewSwitcher
        label="Visualizacoes da visao geral"
        options={[
          { id: 'evolution', label: 'Evolucao' },
          { id: 'distribution', label: 'Distribuicao' },
          { id: 'override', label: 'Divergencias' },
          { id: 'recent', label: 'Ultimas decisoes' },
        ]}
        value={activeView}
        onChange={(id) =>
          setActiveView(id as 'evolution' | 'distribution' | 'override' | 'recent')
        }
      />
      <div className="admin-view-stage">
        {activeView === 'evolution' && <EvolutionChart data={data.evolution} />}
        {activeView === 'distribution' && <DistributionChart data={data.distribution} />}
        {activeView === 'override' && <OverrideReasons data={data.override_reasons} />}
        {activeView === 'recent' && <RecentDecisions rows={data.decisions} />}
      </div>
    </>
  );
}
function Adherence({ data }: { data: AdminDashboard }) {
  const [activeView, setActiveView] = useState<
    'highlights' | 'profiles' | 'firms' | 'overrides' | 'model'
  >('highlights');
  return (
    <>
      <MetricGrid
        items={[
          {
            label: 'Aderencia a politica',
            value: percent(data.metrics.adherence_rate),
            hint: 'Decisoes alinhadas a recomendacao',
            icon: ShieldCheck,
            accent: true,
          },
          {
            label: 'Divergencias registradas',
            value: count(data.metrics.overrides),
            hint: 'Decisoes com divergencia',
            icon: GitBranch,
          },
          {
            label: 'Perfis simulados',
            value: count(
              new Set(data.decisions.map((row) => row.lawyer_profile_label ?? 'Sem perfil')).size,
            ),
            hint: 'Perfis com regras comportamentais proprias',
            icon: ShieldCheck,
          },
          {
            label: 'Escritorios comparados',
            value: count(new Set(data.decisions.map((row) => row.firm_name)).size),
            hint: 'Diferencas observadas entre bancas',
            icon: Layers3,
          },
        ]}
      />
      <ViewSwitcher
        label="Visualizacoes da aderencia"
        options={[
          { id: 'highlights', label: 'Panorama' },
          { id: 'profiles', label: 'Perfis' },
          { id: 'firms', label: 'Escritorios' },
          { id: 'overrides', label: 'Motivos' },
          { id: 'model', label: 'Modelo' },
        ]}
        value={activeView}
        onChange={(id) =>
          setActiveView(id as 'highlights' | 'profiles' | 'firms' | 'overrides' | 'model')
        }
      />
      <div className="admin-view-stage">
        {activeView === 'highlights' && (
          <AdherenceHighlightsPanel
            rows={data.decisions}
            overallAdherence={data.metrics.adherence_rate}
          />
        )}
        {activeView === 'profiles' && <ProfileBehaviorPanel rows={data.decisions} />}
        {activeView === 'firms' && (
          <FirmComparisonPanel
            rows={data.decisions}
            overallAdherence={data.metrics.adherence_rate}
          />
        )}
        {activeView === 'overrides' && <OverrideReasons data={data.override_reasons} />}
        {activeView === 'model' && <AdherenceModelCard rows={data.decisions} />}
      </div>
      <DecisionTable rows={data.decisions} />
    </>
  );
}

function Effectiveness({ data }: { data: AdminDashboard }) {
  const metrics = data.metrics;
  const simulation = data.historical_simulation;
  const [activeView, setActiveView] = useState<'savings' | 'outcomes' | 'timeline'>('savings');
  return (
    <>
      <div className="admin-subsection-heading">
        <div>
          <span className="admin-section-kicker">RESULTADOS DA OPERACAO</span>
          <h2>Da proposta a economia</h2>
        </div>
        <DemoLabel />
      </div>
      <MetricGrid
        items={[
          {
            label: 'Economia estimada',
            value: money(metrics.estimated_savings, true),
            hint: 'Reducao absoluta frente ao cenario-base',
            icon: CircleDollarSign,
            accent: true,
          },
          {
            label: 'Reducao de custo',
            value: percent(metrics.estimated_savings_rate),
            hint: 'Percentual economizado com a politica',
            icon: ArrowDownLeft,
          },
          {
            label: 'Custo sem politica',
            value: money(metrics.baseline_cost, true),
            hint: 'Referencia de judicializacao',
            icon: Layers3,
          },
          {
            label: 'Custo com politica',
            value: money(metrics.projected_cost, true),
            hint: 'Custo projetado apos acordos',
            icon: Activity,
          },
          {
            label: 'Propostas de acordo',
            value: count(metrics.agreement_proposals),
            hint: 'Casos que avancaram para negociacao',
            icon: Handshake,
          },
          {
            label: 'Taxa de aceitacao',
            value: percent(metrics.acceptance_rate),
            hint: 'Propostas aceitas no periodo',
            icon: ShieldCheck,
          },
        ]}
      />
      <div className="admin-operational-summary">
        <Activity size={18} aria-hidden="true" />
        <span>A economia estimada e o principal indicador desta demonstracao.</span>
        <strong>{money(metrics.estimated_savings, true)}</strong>
        <span className="admin-operational-scope">Cenario de demonstracao</span>
      </div>
      <ViewSwitcher
        label="Visualizacoes da efetividade"
        options={[
          { id: 'savings', label: 'Economia' },
          { id: 'outcomes', label: 'Resultados' },
          { id: 'timeline', label: 'Trajetoria' },
        ]}
        value={activeView}
        onChange={(id) => setActiveView(id as 'savings' | 'outcomes' | 'timeline')}
      />
      <div className="admin-view-stage admin-effectiveness-stage">
        {activeView === 'savings' && <SavingsFlowChart data={data.effectiveness_savings_flow} />}
        {activeView === 'outcomes' && (
          <EffectivenessOutcomeChart data={data.effectiveness_outcomes} />
        )}
        {activeView === 'timeline' && (
          <EffectivenessTimeline data={data.effectiveness_timeline} />
        )}
      </div>
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
            <small>{percent(metrics.estimated_savings_rate)} de reducao no custo</small>
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




