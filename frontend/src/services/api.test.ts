// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ApiError,
  DATA_CHANGED_EVENT,
  DEMO_STORAGE_KEY,
  getAdminDashboard,
  getCase,
  getCases,
  getDecision,
  getNegotiation,
  getRecommendation,
  resetDemoData,
  submitLawyerDecision,
  submitNegotiation,
  submitOverride,
} from './api';

beforeEach(async () => {
  await resetDemoData();
});

describe('demonstration API', () => {
  it('provides eight cases and evidence whose sources resolve to actual MOCK pages', async () => {
    const cases = await getCases();
    expect(cases).toHaveLength(8);
    const recommendations = await Promise.all(cases.map((item) => getRecommendation(item.case_id)));
    for (const recommendation of recommendations) {
      expect(recommendation.demo_data).toBe(true);
      expect(recommendation.documents).toHaveLength(7);
      expect(recommendation.next_best_evidence?.simulation?.outcome).toContain('SIMULAÇÃO');
      const sources = [
        ...recommendation.evidence.map((item) => item.source),
        ...recommendation.contradictions.flatMap((item) => [
          item.allegation.source,
          item.documentary_fact.source,
        ]),
      ];
      for (const source of sources) {
        const document = recommendation.documents.find((item) => item.id === source.document_id);
        const page = document?.demo_pages?.find((item) => item.page === source.page);
        expect(page).toBeDefined();
        expect(document?.name).toBe(source.document_name);
        expect(page?.paragraphs).toContain(source.excerpt);
        expect(source.origin).toContain('MOCK');
      }
      for (const document of recommendation.documents) {
        expect(document.page_count).toBe(document.demo_pages?.length ?? 0);
        if (document.status === 'AUSENTE') expect(document.demo_pages).toBeUndefined();
      }
    }
    expect(recommendations[0].loss_probability).toBe(0.23);
    expect(recommendations[1]).toMatchObject({
      loss_probability: 0.72,
      expected_condemnation: 10500,
      expected_defense_cost: 7560,
      settlement: { opening: 4500, target: 5200, ceiling: 6500 },
    });
    expect(recommendations[2].loss_probability).toBeNull();
  });

  it('returns independent document objects and preserves local decisions and accepted agreements', async () => {
    const detail = await getCase('caso-2');
    detail.documents[0].demo_pages![0].paragraphs[0] = 'changed outside the service';
    expect((await getCase('caso-2')).documents[0].demo_pages![0].paragraphs[0]).toContain(
      'DEMONSTRAÇÃO',
    );
    expect(await getDecision('caso-2')).toBeNull();
    const decision = await submitLawyerDecision({
      case_id: 'caso-2',
      decision: 'ACORDO',
      notes: '  Conferido  ',
    });
    expect((await getCase('caso-2')).status).toBe('DECISAO_REGISTRADA');
    expect(decision.notes).toBe('Conferido');
    await submitNegotiation({
      case_id: 'caso-2',
      proposal_value: 4500,
      status: 'PENDENTE',
    });
    expect((await getCase('caso-2')).status).toBe('EM_NEGOCIACAO');
    const negotiation = await submitNegotiation({
      case_id: 'caso-2',
      proposal_value: 4500,
      status: 'ACEITA',
      final_value: 5200,
    });
    expect((await getCase('caso-2')).status).toBe('CONCLUIDO');
    expect(await getDecision('caso-2')).toEqual(decision);
    expect(await getNegotiation('caso-2')).toEqual(negotiation);
    expect(JSON.parse(window.localStorage.getItem(DEMO_STORAGE_KEY)!)).toMatchObject({
      decisions: { 'caso-2': decision },
      negotiations: { 'caso-2': negotiation },
    });
    expect((await getRecommendation('caso-2')).recommendation).toBe('ACORDO');
  });

  it('rejects invalid transitions and incomplete values before saving', async () => {
    await expect(submitLawyerDecision({ case_id: 'caso-1', decision: 'ACORDO' })).rejects.toThrow(
      'divergir',
    );
    await expect(
      submitOverride({
        case_id: 'caso-1',
        decision: 'ACORDO',
        reason: 'OUTRO',
        justification: '  ',
      }),
    ).rejects.toThrow('justificativa');
    await expect(
      submitNegotiation({ case_id: 'caso-1', proposal_value: 3000, status: 'PENDENTE' }),
    ).rejects.toThrow('decisão de acordo');
    await expect(
      submitNegotiation({ case_id: 'caso-2', proposal_value: 4500, status: 'ACEITA' }),
    ).rejects.toThrow('valor final');
    await expect(
      submitNegotiation({ case_id: 'caso-2', proposal_value: 4500, status: 'CONTRAPROPOSTA' }),
    ).rejects.toThrow('contraproposta');
    await expect(
      submitNegotiation({ case_id: 'caso-2', proposal_value: Number.NaN, status: 'PENDENTE' }),
    ).rejects.toThrow('maior que zero');
    await expect(getCase('missing-case')).rejects.toMatchObject({ status: 404 });
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
  });

  it('updates the local administrative row and emits an event without changing aggregate demo KPIs', async () => {
    const before = await getAdminDashboard();
    const events: CustomEvent[] = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    window.addEventListener(DATA_CHANGED_EVENT, listener);
    try {
      const decision = await submitOverride({
        case_id: 'caso-2',
        decision: 'DEFESA',
        reason: 'NOVA_EVIDENCIA',
        justification: 'Documento novo.',
      });
      const dashboard = await getAdminDashboard();
      expect(dashboard.decisions.filter((item) => item.case_id === 'caso-2')).toHaveLength(1);
      expect(dashboard.decisions.find((item) => item.case_id === 'caso-2')).toMatchObject({
        id: decision.id,
        decision: 'DEFESA',
        recommendation: 'ACORDO',
        adherent: false,
        is_local: true,
        justification: 'Documento novo.',
      });
      expect(dashboard.metrics).toEqual(before.metrics);
      expect(dashboard.historical_simulation).toEqual(before.historical_simulation);
      expect(events).toHaveLength(1);
      expect(events[0].detail).toMatchObject({
        action: 'decision',
        case_id: 'caso-2',
        demo_data: true,
      });
      expect((await getCases()).find((item) => item.case_id === 'caso-2')).toMatchObject({
        status: 'DECISAO_REGISTRADA',
        recommendation: 'ACORDO',
      });
    } finally {
      window.removeEventListener(DATA_CHANGED_EVENT, listener);
    }
  });

  it('recovers corrupted storage through reset and restores initial seeded records', async () => {
    window.localStorage.setItem(DEMO_STORAGE_KEY, '{broken');
    await expect(getCases()).rejects.toBeInstanceOf(ApiError);
    await resetDemoData();
    expect(await getDecision('caso-2')).toBeNull();
    expect((await getDecision('caso-7'))?.is_override).toBe(true);
    expect((await getNegotiation('caso-6'))?.final_value).toBe(3800);
    expect((await getCase('caso-6')).status).toBe('CONCLUIDO');
  });
});
