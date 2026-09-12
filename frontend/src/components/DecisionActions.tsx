import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCheck, Handshake, PencilLine } from 'lucide-react';
import type {
  DecisionRecord,
  NegotiationRecord,
  NegotiationStatus,
  OverrideReason,
  Recommendation,
  RecommendationResponse,
} from '../types';
import { submitLawyerDecision, submitNegotiation, submitOverride } from '../services/api';
import { money, shortDate } from '../lib/format';
import { Badge, Button, Modal, Notice } from './ui';

const overrideReasons: { value: OverrideReason; label: string }[] = [
  { value: 'NOVA_EVIDENCIA', label: 'Nova evidência' },
  { value: 'ESTRATEGIA_PROCESSUAL', label: 'Estratégia processual' },
  { value: 'INFORMACAO_NAO_CONSIDERADA', label: 'Informação não considerada' },
  { value: 'POLITICA_INADEQUADA', label: 'Política inadequada ao caso' },
  { value: 'OUTRO', label: 'Outro' },
];

export function DecisionActions({
  recommendation,
  decision,
  negotiation,
  onSaved,
}: {
  recommendation: RecommendationResponse;
  decision: DecisionRecord | null;
  negotiation: NegotiationRecord | null;
  onSaved: (message: string) => void;
}) {
  const [modal, setModal] = useState<'follow' | 'override' | null>(null);
  const [chosen, setChosen] = useState<Recommendation>(
    recommendation.recommendation === 'ACORDO' ? 'DEFESA' : 'ACORDO',
  );
  const [reason, setReason] = useState<OverrideReason | ''>('');
  const [justification, setJustification] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const open = (kind: 'follow' | 'override') => {
    setChosen(
      decision?.is_override
        ? decision.decision
        : recommendation.recommendation === 'ACORDO'
          ? 'DEFESA'
          : 'ACORDO',
    );
    setReason(decision?.is_override ? decision.reason || '' : '');
    setJustification(decision?.is_override ? decision.justification || '' : '');
    setNotes(decision?.notes || '');
    setErrors({});
    setModal(kind);
  };
  const close = () => {
    if (!busy) setModal(null);
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (modal === 'override') {
      if (!reason) nextErrors.reason = 'Selecione o motivo da divergência.';
      if (!justification.trim())
        nextErrors.justification = 'A justificativa é obrigatória para divergir.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try {
      if (modal === 'override' && reason)
        await submitOverride({
          case_id: recommendation.case_id,
          decision: chosen,
          reason,
          justification,
        });
      else
        await submitLawyerDecision({
          case_id: recommendation.case_id,
          decision: recommendation.recommendation,
          notes,
        });
      setModal(null);
      onSaved(
        modal === 'override'
          ? 'Divergência registrada com motivo e justificativa.'
          : 'Decisão registrada. Você seguiu a recomendação da política.',
      );
    } catch (error) {
      setErrors({
        api: error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.',
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="decision-actions">
        {decision ? (
          <div className="decision-receipt">
            <div>
              <CheckCheck size={18} />
              <strong>Decisão registrada</strong>
              <Badge value={decision.is_override ? 'OVERRIDE' : 'ADERENTE'}>
                {decision.is_override ? 'Escolha diferente' : 'Seguiu a recomendação'}
              </Badge>
            </div>
            <p>
              Sua decisão: <b>{decision.decision}</b>
            </p>
            <span>{shortDate(decision.created_at)}</span>
            {decision.justification && <blockquote>{decision.justification}</blockquote>}
            {decision.notes && <p className="receipt-notes">{decision.notes}</p>}
            {decision.decision === 'ACORDO' ? (
              <a className="decision-next-step" href="#negociacao">
                {negotiation
                  ? negotiation.status === 'ACEITA' || negotiation.status === 'RECUSADA'
                    ? 'Ver resultado da negociação'
                    : 'Ver negociação em andamento'
                  : 'Próximo passo: registrar a proposta'}
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            ) : (
              <Link className="decision-next-step" to="/minha-fila">
                Ir para o próximo processo
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
            <div className="receipt-buttons">
              <button onClick={() => open('follow')}>
                <Check size={12} />
                Seguir recomendação
              </button>
              <button onClick={() => open('override')}>
                <PencilLine size={12} />
                Alterar decisão
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="decision-choice-intro">
              <strong>O que você quer fazer?</strong>
              <span>Escolha uma opção. Nada será salvo sem sua confirmação.</span>
            </div>
            <Button className="full accent" onClick={() => open('follow')}>
              {recommendation.recommendation === 'REVISAR'
                ? 'Encaminhar para revisão'
                : 'Seguir recomendação'}
              <ArrowRight size={15} />
            </Button>
            <Button variant="secondary" className="full" onClick={() => open('override')}>
              <PencilLine size={14} />
              Escolher outra decisão
            </Button>
            <p>A decisão final é sua. Toda escolha diferente da recomendação fica registrada.</p>
          </>
        )}
      </div>
      <Modal
        open={modal !== null}
        onClose={close}
        title={modal === 'override' ? 'Escolher outra decisão' : 'Confirmar decisão'}
        description={
          modal === 'override'
            ? 'Escolha o que fazer e explique por que esta opção é melhor para o caso.'
            : 'Revise a recomendação antes de registrar sua decisão.'
        }
      >
        <form onSubmit={submit} noValidate>
          <div className="modal-body form-grid">
            <div className="confirmation-summary">
              <div>
                <span>Recomendação da política</span>
                <Badge value={recommendation.recommendation} />
              </div>
              {modal === 'follow' &&
                recommendation.recommendation === 'ACORDO' &&
                recommendation.settlement && (
                  <div>
                    <span>Valor sugerido · alvo</span>
                    <strong>{money(recommendation.settlement.target)}</strong>
                  </div>
                )}
            </div>
            {modal === 'override' ? (
              <>
                <label className="field">
                  Minha decisão
                  <select
                    className="select"
                    value={chosen}
                    onChange={(event) => setChosen(event.target.value as Recommendation)}
                  >
                    {(['ACORDO', 'DEFESA', 'REVISAR'] as const)
                      .filter((value) => value !== recommendation.recommendation)
                      .map((value) => (
                        <option value={value} key={value}>
                          {value === 'REVISAR'
                            ? 'Revisar'
                            : value === 'ACORDO'
                              ? 'Acordo'
                              : 'Defesa'}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  Por que você escolheu outra decisão? <span className="sr-only">obrigatório</span>
                  <select
                    required
                    className="select"
                    aria-label="Por que você escolheu outra decisão?"
                    value={reason}
                    aria-invalid={!!errors.reason}
                    aria-describedby={errors.reason ? 'reason-error' : undefined}
                    onChange={(event) => {
                      setReason(event.target.value as OverrideReason);
                      setErrors({});
                    }}
                  >
                    <option value="">Selecione um motivo</option>
                    {overrideReasons.map((item) => (
                      <option value={item.value} key={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  {errors.reason && (
                    <span className="field-error" id="reason-error">
                      {errors.reason}
                    </span>
                  )}
                </label>
                <label className="field">
                  Explique sua escolha <span className="field-help">Obrigatório</span>
                  <textarea
                    required
                    className="textarea"
                    aria-label="Explique sua escolha"
                    value={justification}
                    onChange={(event) => setJustification(event.target.value)}
                    placeholder="Explique por que esta decisão é mais adequada ao caso…"
                    aria-invalid={!!errors.justification}
                    aria-describedby={errors.justification ? 'justification-error' : undefined}
                  />
                  {errors.justification && (
                    <span className="field-error" id="justification-error">
                      {errors.justification}
                    </span>
                  )}
                </label>
              </>
            ) : (
              <>
                <label className="field">
                  Observação <span className="field-help">Opcional</span>
                  <textarea
                    className="textarea"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Adicione um contexto à sua decisão…"
                  />
                </label>
                <Notice>
                  {recommendation.recommendation === 'ACORDO'
                    ? 'Após confirmar, registre a proposta e acompanhe o resultado da negociação.'
                    : recommendation.recommendation === 'REVISAR'
                      ? 'O caso ficará registrado para revisão. As informações faltantes permanecem destacadas na análise.'
                      : 'A decisão ficará disponível para acompanhamento na central administrativa.'}
                </Notice>
              </>
            )}
            {errors.api && (
              <p className="field-error" role="alert">
                {errors.api}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              {modal === 'override' ? 'Salvar minha decisão' : 'Confirmar decisão'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function NegotiationPanel({
  recommendation,
  negotiation,
  onSaved,
}: {
  recommendation: RecommendationResponse;
  negotiation: NegotiationRecord | null;
  onSaved: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [proposal, setProposal] = useState('');
  const [status, setStatus] = useState<NegotiationStatus>('PENDENTE');
  const [counter, setCounter] = useState('');
  const [finalValue, setFinalValue] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  function edit() {
    setProposal(
      negotiation
        ? String(negotiation.proposal_value)
        : recommendation.settlement
          ? String(recommendation.settlement.target)
          : '',
    );
    setStatus(negotiation?.status || 'PENDENTE');
    setCounter(
      negotiation?.counterproposal_value === undefined
        ? ''
        : String(negotiation.counterproposal_value),
    );
    setFinalValue(negotiation?.final_value === undefined ? '' : String(negotiation.final_value));
    setNotes(negotiation?.notes || '');
    setErrors({});
    setOpen(true);
  }
  const close = () => {
    if (!busy) setOpen(false);
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    const positive = (value: string) => Number.isFinite(Number(value)) && Number(value) > 0;
    const nextErrors: Record<string, string> = {};
    if (!positive(proposal)) nextErrors.proposal = 'Informe um valor de proposta maior que zero.';
    if (status === 'CONTRAPROPOSTA' && !positive(counter))
      nextErrors.counter = 'Informe o valor da contraproposta.';
    if (status === 'ACEITA' && !positive(finalValue))
      nextErrors.final = 'Informe o valor final do acordo.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try {
      await submitNegotiation({
        case_id: recommendation.case_id,
        proposal_value: Number(proposal),
        status,
        ...(status === 'CONTRAPROPOSTA' ? { counterproposal_value: Number(counter) } : {}),
        ...(status === 'ACEITA' ? { final_value: Number(finalValue) } : {}),
        notes,
      });
      setOpen(false);
      onSaved('Negociação salva. O resultado já está disponível na central administrativa.');
    } catch (error) {
      setErrors({
        api: error instanceof Error ? error.message : 'Não foi possível registrar a proposta.',
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel negotiation-panel" id="negociacao">
      <div className="panel-heading">
        <h2>
          <Handshake size={16} />
          Negociação
        </h2>
        {negotiation && <Badge value={negotiation.status} />}
      </div>
      <div className="negotiation-body">
        {negotiation ? (
          <>
            <span className="metric-label">Proposta registrada</span>
            <strong className="negotiation-value">{money(negotiation.proposal_value)}</strong>
            {negotiation.status === 'ACEITA' && (
              <div className="negotiation-outcome">
                <span>Valor final do acordo</span>
                <strong>{money(negotiation.final_value)}</strong>
              </div>
            )}
            {negotiation.status === 'CONTRAPROPOSTA' && (
              <div className="negotiation-outcome">
                <span>Contraproposta recebida</span>
                <strong>{money(negotiation.counterproposal_value)}</strong>
              </div>
            )}
            {negotiation.notes && <p>{negotiation.notes}</p>}
            <span className="negotiation-date">
              Atualizado em {shortDate(negotiation.updated_at)}
            </span>
          </>
        ) : (
          <p>
            Decisão de acordo confirmada. Registre o valor da proposta e acompanhe a resposta da
            parte.
          </p>
        )}
        <Button variant="secondary" className="full" onClick={edit}>
          {negotiation ? 'Atualizar negociação' : 'Registrar proposta'}
          <ArrowRight size={14} />
        </Button>
        {negotiation && (
          <Link className="negotiation-next-case" to="/minha-fila">
            Voltar à minha fila
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
      <Modal
        open={open}
        onClose={close}
        title={negotiation ? 'Atualizar negociação' : 'Registrar proposta'}
        description="Registre os valores e o retorno da parte para acompanhar este acordo."
      >
        <form onSubmit={submit} noValidate>
          <div className="modal-body form-grid">
            {recommendation.settlement && (
              <div className="negotiation-range">
                {[
                  ['Abertura', recommendation.settlement.opening],
                  ['Alvo', recommendation.settlement.target],
                  ['Teto', recommendation.settlement.ceiling],
                ].map(([label, value]) => (
                  <button
                    type="button"
                    key={label}
                    className={Number(proposal) === value ? 'is-selected' : undefined}
                    onClick={() => setProposal(String(value))}
                    aria-pressed={Number(proposal) === value}
                  >
                    <span>{label}</span>
                    <strong>{money(value as number)}</strong>
                    <small>Usar este valor</small>
                  </button>
                ))}
              </div>
            )}
            <label className="field">
              Valor da proposta (R$)
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                placeholder="0,00"
                value={proposal}
                onChange={(event) => setProposal(event.target.value)}
                aria-invalid={!!errors.proposal}
                aria-describedby={errors.proposal ? 'proposal-error' : undefined}
              />
              {errors.proposal && (
                <span className="field-error" id="proposal-error">
                  {errors.proposal}
                </span>
              )}
            </label>
            <label className="field">
              Resultado da negociação
              <select
                className="select"
                value={status}
                onChange={(event) => setStatus(event.target.value as NegotiationStatus)}
              >
                <option value="PENDENTE">Pendente · aguardando resposta</option>
                <option value="ACEITA">Aceita</option>
                <option value="RECUSADA">Recusada</option>
                <option value="CONTRAPROPOSTA">Contraproposta</option>
              </select>
            </label>
            {status === 'CONTRAPROPOSTA' && (
              <label className="field">
                Valor da contraproposta (R$)
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                  value={counter}
                  onChange={(event) => setCounter(event.target.value)}
                  aria-invalid={!!errors.counter}
                  aria-describedby={errors.counter ? 'counter-error' : undefined}
                />
                {errors.counter && (
                  <span id="counter-error" className="field-error">
                    {errors.counter}
                  </span>
                )}
              </label>
            )}
            {status === 'ACEITA' && (
              <label className="field">
                Valor final do acordo (R$)
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                  value={finalValue}
                  onChange={(event) => setFinalValue(event.target.value)}
                  aria-invalid={!!errors.final}
                  aria-describedby={errors.final ? 'final-error' : undefined}
                />
                {errors.final && (
                  <span id="final-error" className="field-error">
                    {errors.final}
                  </span>
                )}
              </label>
            )}
            <label className="field">
              Observações <span className="field-help">Opcional</span>
              <textarea
                className="textarea"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Contexto da negociação ou retorno da parte…"
              />
            </label>
            {errors.api && (
              <p className="field-error" role="alert">
                {errors.api}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <Button type="button" variant="secondary" disabled={busy} onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              {negotiation ? 'Salvar negociação' : 'Registrar proposta'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
