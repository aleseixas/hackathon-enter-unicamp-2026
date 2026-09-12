// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { SessionProvider } from './hooks/useSession';
import { DEMO_STORAGE_KEY, resetDemoData } from './services/api';

type User = ReturnType<typeof userEvent.setup>;

beforeEach(async () => {
  window.sessionStorage.clear();
  await resetDemoData();
});

afterEach(() => cleanup());

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </MemoryRouter>,
  );
}

async function openLawyerCase(user: User, plaintiff: string) {
  await user.click(screen.getByRole('button', { name: /Entrar como Advogado/ }));
  await user.click(await screen.findByRole('link', { name: `Abrir processo de ${plaintiff}` }));
  await screen.findByRole('heading', { name: plaintiff, level: 1 });
}

async function openAdminDecisions(user: User) {
  await user.click(screen.getByRole('button', { name: 'Sair da demonstração' }));
  await user.click(screen.getByRole('button', { name: /Entrar como Administrativo/ }));
  await user.click(await screen.findByRole('link', { name: 'Decisões' }));
  await screen.findByRole('heading', { name: 'Registro da operação' });
  await screen.findByRole('table');
}

async function followRecommendation(user: User, notes?: string) {
  await user.click(screen.getByRole('button', { name: 'Seguir recomendação' }));
  const dialog = screen.getByRole('dialog', { name: 'Confirmar decisão' });
  if (notes) await user.type(within(dialog).getByRole('textbox', { name: /Observação/ }), notes);
  await user.click(within(dialog).getByRole('button', { name: 'Confirmar decisão' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await screen.findByText('Decisão registrada. Você seguiu a recomendação da política.');
}

describe('application business flows', () => {
  it('opens the referenced MOCK pages, confirms defense and shows the same decision to administration', async () => {
    const user = userEvent.setup();
    renderApp();
    await openLawyerCase(user, 'Maria Aparecida Santos');

    await user.click(
      screen.getByRole('button', {
        name: 'Ver evidência: Biometria e assinatura · MOCK, página 1',
      }),
    );
    let document = screen.getByRole('dialog', { name: 'Biometria e assinatura · MOCK' });
    expect(within(document).getByRole('combobox', { name: 'Página do documento' })).toHaveValue(
      '1',
    );
    expect(within(document).getByText('91%')).toBeInTheDocument();
    expect(within(document).getByText('97,3%')).toBeInTheDocument();
    await user.click(within(document).getByRole('button', { name: 'Voltar à análise' }));

    await user.click(
      screen.getByRole('button', { name: 'Ver evidência: Petição inicial · MOCK, página 2' }),
    );
    document = screen.getByRole('dialog', { name: 'Petição inicial · MOCK' });
    expect(within(document).getByRole('combobox', { name: 'Página do documento' })).toHaveValue(
      '2',
    );
    expect(
      within(document).getByText(/A autora afirma não reconhecer a contratação e contesta/),
    ).toBeInTheDocument();
    await user.click(within(document).getByRole('button', { name: 'Página anterior' }));
    expect(within(document).getByRole('combobox', { name: 'Página do documento' })).toHaveValue(
      '1',
    );
    await user.click(within(document).getByRole('button', { name: 'Voltar à análise' }));

    await followRecommendation(user);
    await screen.findByText('Sua decisão:');
    expect(screen.getByRole('heading', { name: 'DEFESA' })).toBeInTheDocument();
    await openAdminDecisions(user);
    const row = screen.getByRole('row', { name: /1004827-32\.2026\.8\.26\.0114/ });
    expect(within(row).getByText(/Maria Aparecida Santos/)).toBeInTheDocument();
    expect(within(row).getAllByText('Defesa')).toHaveLength(2);
    expect(within(row).getByText('Aderente')).toBeInTheDocument();
    expect(within(row).getByText('Nesta demo')).toBeInTheDocument();
    expect(within(row).getByText('Decisão registrada')).toBeInTheDocument();
  });

  it('requires a reason and justification for divergence and exposes its context through administrative filters', async () => {
    const user = userEvent.setup();
    renderApp();
    await openLawyerCase(user, 'José Carlos Oliveira');
    await user.click(screen.getByRole('button', { name: /^Contradições/ }));
    expect(screen.getByText('O autor afirma não possuir conta na Caixa.')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Ver evidência: Consulta BACEN · MOCK, página 1' }),
    );
    const document = screen.getByRole('dialog', { name: 'Consulta BACEN · MOCK' });
    expect(
      within(document).getByText(
        /Consulta BACEN MOCK atribui a conta da Caixa ao tomador José Carlos Oliveira/,
      ),
    ).toBeInTheDocument();
    await user.click(within(document).getByRole('button', { name: 'Voltar à análise' }));

    await user.click(screen.getByRole('button', { name: 'Escolher outra decisão' }));
    const dialog = screen.getByRole('dialog', { name: 'Escolher outra decisão' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar minha decisão' }));
    expect(within(dialog).getByText('Selecione o motivo da divergência.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('A justificativa é obrigatória para divergir.'),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();

    const justification = 'Documento independente apresentado para revisão pelo advogado.';
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: /Minha decisão/ }),
      'DEFESA',
    );
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: /outra decisão/ }),
      'NOVA_EVIDENCIA',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: /Explique sua escolha/ }),
      justification,
    );
    await user.click(within(dialog).getByRole('button', { name: 'Salvar minha decisão' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await screen.findByText('Divergência registrada com motivo e justificativa.');
    expect(screen.getByRole('heading', { name: 'ACORDO' })).toBeInTheDocument();

    await openAdminDecisions(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Aderência' }), 'override');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Recomendação' }), 'ACORDO');
    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar processo ou pessoa' }),
      'Jose Carlos',
    );
    const row = screen.getByRole('row', { name: /0801634-18\.2026\.8\.19\.0001/ });
    expect(within(row).getByText('Override')).toBeInTheDocument();
    expect(within(row).getByText('Defesa')).toBeInTheDocument();
    expect(screen.getByRole('table').querySelectorAll('tbody > tr')).toHaveLength(1);
    await user.click(within(row).getByRole('button', { name: '0801634-18.2026.8.19.0001' }));
    expect(screen.getByText(justification)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'UF' }), 'SP');
    expect(screen.getByRole('heading', { name: 'Nenhum registro encontrado' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]);
    expect(screen.getByRole('row', { name: /0801634-18\.2026\.8\.19\.0001/ })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar processo ou pessoa' })).toHaveValue('');
  });

  it('requires negotiation amounts, preserves a counteroffer and records the accepted value in administration', async () => {
    const user = userEvent.setup();
    renderApp();
    await openLawyerCase(user, 'José Carlos Oliveira');
    await followRecommendation(user);
    await user.click(await screen.findByRole('button', { name: 'Registrar proposta' }));
    let dialog = screen.getByRole('dialog', { name: 'Registrar proposta' });
    const proposal = within(dialog).getByRole('spinbutton', { name: /Valor da proposta/ });
    expect(proposal).toHaveValue(5200);
    await user.clear(proposal);
    await user.type(proposal, '4500');
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Resultado da negociação' }),
      'CONTRAPROPOSTA',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Registrar proposta' }));
    expect(within(dialog).getByText('Informe o valor da contraproposta.')).toBeInTheDocument();
    await user.type(
      within(dialog).getByRole('spinbutton', { name: /Valor da contraproposta/ }),
      '5600',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Registrar proposta' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await screen.findByText('Contraproposta recebida');

    await user.click(screen.getByRole('button', { name: 'Atualizar negociação' }));
    dialog = screen.getByRole('dialog', { name: 'Atualizar negociação' });
    expect(within(dialog).getByRole('spinbutton', { name: /Valor da proposta/ })).toHaveValue(4500);
    expect(within(dialog).getByRole('spinbutton', { name: /Valor da contraproposta/ })).toHaveValue(
      5600,
    );
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Resultado da negociação' }),
      'ACEITA',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Salvar negociação' }));
    expect(within(dialog).getByText('Informe o valor final do acordo.')).toBeInTheDocument();
    await user.type(
      within(dialog).getByRole('spinbutton', { name: /Valor final do acordo/ }),
      '5200',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Salvar negociação' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await screen.findByText('Concluído');
    expect(screen.getByRole('heading', { name: 'ACORDO' })).toBeInTheDocument();

    await openAdminDecisions(user);
    const row = screen.getByRole('row', { name: /0801634-18\.2026\.8\.19\.0001/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[6]).toHaveTextContent('R$ 5.200,00');
    expect(within(row).getByText('Aceita')).toBeInTheDocument();
    expect(within(row).getByText('Aderente')).toBeInTheDocument();
    expect(within(row).getByText('Nesta demo')).toBeInTheDocument();
  });

  it('reopens a persisted review override and discards changes cancelled during editing', async () => {
    const user = userEvent.setup();
    renderApp();
    await openLawyerCase(user, 'José Carlos Oliveira');
    await user.click(screen.getByRole('button', { name: 'Escolher outra decisão' }));
    let dialog = screen.getByRole('dialog', { name: 'Escolher outra decisão' });
    const justification = 'Revisar o extrato independente antes de definir a estratégia.';
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: /Minha decisão/ }),
      'REVISAR',
    );
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: /outra decisão/ }),
      'INFORMACAO_NAO_CONSIDERADA',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: /Explique sua escolha/ }),
      justification,
    );
    await user.click(within(dialog).getByRole('button', { name: 'Salvar minha decisão' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await screen.findByText(justification);

    const navigation = screen.getByRole('navigation', { name: 'Navegação principal' });
    await user.click(within(navigation).getByRole('link', { name: 'Todos os processos' }));
    await user.click(
      await screen.findByRole('link', { name: 'Abrir processo de José Carlos Oliveira' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Alterar decisão' }));
    dialog = screen.getByRole('dialog', { name: 'Escolher outra decisão' });
    expect(within(dialog).getByRole('combobox', { name: /Minha decisão/ })).toHaveValue('REVISAR');
    expect(within(dialog).getByRole('combobox', { name: /outra decisão/ })).toHaveValue(
      'INFORMACAO_NAO_CONSIDERADA',
    );
    expect(within(dialog).getByRole('textbox', { name: /Explique sua escolha/ })).toHaveValue(
      justification,
    );

    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: /Minha decisão/ }),
      'DEFESA',
    );
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: /outra decisão/ }),
      'OUTRO',
    );
    await user.clear(within(dialog).getByRole('textbox', { name: /Explique sua escolha/ }));
    await user.type(
      within(dialog).getByRole('textbox', { name: /Explique sua escolha/ }),
      'Rascunho que será cancelado.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Alterar decisão' }));
    dialog = screen.getByRole('dialog', { name: 'Escolher outra decisão' });
    expect(within(dialog).getByRole('combobox', { name: /Minha decisão/ })).toHaveValue('REVISAR');
    expect(within(dialog).getByRole('combobox', { name: /outra decisão/ })).toHaveValue(
      'INFORMACAO_NAO_CONSIDERADA',
    );
    expect(within(dialog).getByRole('textbox', { name: /Explique sua escolha/ })).toHaveValue(
      justification,
    );
  });

  it('keeps a cancelled restoration and clears the old success banner and decision draft after confirmed restoration', async () => {
    const user = userEvent.setup();
    renderApp();
    await openLawyerCase(user, 'Maria Aparecida Santos');
    await followRecommendation(user, 'Contexto registrado antes da restauração.');
    await screen.findByText('Sua decisão:');

    await user.click(screen.getByRole('button', { name: 'Guia da experiência' }));
    let dialog = screen.getByRole('dialog', { name: 'Uma decisão bem fundamentada' });
    await user.click(within(dialog).getByRole('button', { name: 'Restaurar demonstração' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await user.click(within(dialog).getByRole('button', { name: 'Fechar janela' }));
    expect(screen.getByText('Sua decisão:')).toBeInTheDocument();
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Guia da experiência' }));
    dialog = screen.getByRole('dialog', { name: 'Uma decisão bem fundamentada' });
    await user.click(within(dialog).getByRole('button', { name: 'Restaurar demonstração' }));
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar restauração' }));
    await within(dialog).findByText(
      'Demonstração restaurada. Os processos voltaram ao cenário inicial.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Fechar janela' }));
    await screen.findByRole('button', { name: 'Escolher outra decisão' });
    expect(screen.queryByText('Sua decisão:')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Decisão registrada. Você seguiu a recomendação da política.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Aguardando decisão')).toBeInTheDocument();
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Seguir recomendação' }));
    dialog = screen.getByRole('dialog', { name: 'Confirmar decisão' });
    expect(within(dialog).getByRole('textbox', { name: /Observação/ })).toHaveValue('');
  });
});
