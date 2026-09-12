"""Usability agent for the existing local frontend.

The agent is deliberately screen-only: it opens the running app, captures the
rendered page, asks a vision model for one human-like action, and executes that
action through Playwright's accessible/user-facing locators.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - exercised when the optional dependency is absent
    OpenAI = None  # type: ignore[assignment,misc]

try:
    from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright
except ImportError:  # pragma: no cover - exercised when the optional dependency is absent
    Page = Any  # type: ignore[assignment,misc]
    PlaywrightTimeoutError = TimeoutError  # type: ignore[assignment,misc]
    sync_playwright = None  # type: ignore[assignment]


ROOT = Path(__file__).resolve().parent
PROMPT_PATH = ROOT / "prompts" / "agent_system.md"
REPORTS_DIR = ROOT / "reports"
SCREENSHOTS_DIR = ROOT / "screenshots"
DEFAULT_BASE_URL = "http://127.0.0.1:5173"
DEFAULT_MODEL = "gpt-4.1-mini"


TASKS: list[dict[str, str]] = [
    {
        "id": "test-1-compreensao-imediata",
        "name": "Compreensão imediata",
        "task": "Entre como Advogado e abra um processo. Quando a tela do processo estiver aberta, sem clicar em mais nada, responda: o que você entende que deveria fazer neste caso? Identifique recomendação, risco, motivo e ação principal.",
    },
    {
        "id": "test-2-entender-recomendacao",
        "name": "Entender a recomendação",
        "task": "Entre como Advogado, abra um processo e descubra por que o sistema recomenda acordo ou defesa. Pare quando conseguir explicar o motivo com as principais evidências.",
    },
    {
        "id": "test-3-rastreabilidade",
        "name": "Rastreabilidade",
        "task": "Entre como Advogado, abra um processo e encontre a fonte documental de uma evidência importante. Diga qual documento, página ou origem encontrou e se aquilo é uma alegação ou um fato documental.",
    },
    {
        "id": "test-4-seguir-recomendacao",
        "name": "Seguir recomendação",
        "task": "Entre como Advogado, abra um processo, concorde com a recomendação apresentada e registre sua decisão. Confirme que a decisão foi realmente concluída.",
    },
    {
        "id": "test-5-divergir",
        "name": "Divergir da recomendação",
        "task": "Entre como Advogado, abra um processo, escolha uma decisão diferente da recomendação, registre a divergência e justifique o motivo. Confirme que a decisão foi realmente concluída.",
    },
    {
        "id": "test-6-negociacao",
        "name": "Negociação",
        "task": "Entre como Advogado, abra um processo. Se a decisão for acordo, registre uma proposta e marque o resultado da negociação. Se não for acordo, explique que o fluxo não se aplica e conclua a tarefa sem inventar uma negociação.",
    },
]


TURN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "understanding": {"type": "string"},
        "next_action": {"type": "string"},
        "confusing": {"type": "array", "items": {"type": "string"}},
        "important": {"type": "array", "items": {"type": "string"}},
        "excess_information": {"type": "array", "items": {"type": "string"}},
        "action": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "type": {"type": "string", "enum": ["click", "fill", "select", "press", "scroll", "wait", "done"]},
                "target": {"type": "string"},
                "value": {"type": "string"},
                "direction": {"type": "string", "enum": ["up", "down"]},
                "success": {"type": "boolean"},
                "reason": {"type": "string"},
            },
            "required": ["type", "target", "value", "direction", "success", "reason"],
        },
        "final": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "interpretation_errors": {"type": "array", "items": {"type": "string"}},
                "confusing_fields": {"type": "array", "items": {"type": "string"}},
                "hard_to_find_buttons": {"type": "array", "items": {"type": "string"}},
                "missing_information": {"type": "array", "items": {"type": "string"}},
                "screens_visited": {"type": "array", "items": {"type": "string"}},
                "clarity_score": {"type": "number", "minimum": 0, "maximum": 10},
                "ease_score": {"type": "number", "minimum": 0, "maximum": 10},
                "confidence_score": {"type": "number", "minimum": 0, "maximum": 10},
                "summary": {"type": "string"},
            },
            "required": [
                "interpretation_errors",
                "confusing_fields",
                "hard_to_find_buttons",
                "missing_information",
                "screens_visited",
                "clarity_score",
                "ease_score",
                "confidence_score",
                "summary",
            ],
        },
    },
    "required": ["understanding", "next_action", "confusing", "important", "excess_information", "action", "final"],
}


@dataclass
class ActionRecord:
    action: str
    target: str = ""
    value: str = ""
    success: bool = False
    error: str = ""
    url_after: str = ""


@dataclass
class TestResult:
    id: str
    name: str
    task: str
    success: bool = False
    action_count: int = 0
    actions: list[ActionRecord] = field(default_factory=list)
    screens_visited: list[str] = field(default_factory=list)
    screenshots: list[str] = field(default_factory=list)
    interpretations: list[str] = field(default_factory=list)
    confusion: list[str] = field(default_factory=list)
    important: list[str] = field(default_factory=list)
    excess_information: list[str] = field(default_factory=list)
    interpretation_errors: list[str] = field(default_factory=list)
    confusing_fields: list[str] = field(default_factory=list)
    hard_to_find_buttons: list[str] = field(default_factory=list)
    missing_information: list[str] = field(default_factory=list)
    summary: str = ""
    clarity_score: float = 0
    ease_score: float = 0
    confidence_score: float = 0
    stopped_reason: str = ""


def unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(item.strip() for item in values if item and item.strip()))


def path_label(url: str) -> str:
    parsed = urlparse(url)
    return parsed.path or "/"


def read_visible_text(page: Page) -> str:
    try:
        return page.locator("body").inner_text(timeout=3_000)[:20_000]
    except Exception as exc:  # pragma: no cover - browser-specific fallback
        return f"[Não foi possível ler o texto visível: {exc}]"


def screenshot(page: Page, test_id: str, step: int) -> Path:
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    destination = SCREENSHOTS_DIR / f"{test_id}-step-{step:02d}.png"
    page.screenshot(path=str(destination), full_page=False)
    return destination


def data_url(path: Path) -> str:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def clean_json(text: str) -> dict[str, Any]:
    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?\s*|\s*```$", "", candidate, flags=re.IGNORECASE | re.DOTALL).strip()
    parsed = json.loads(candidate)
    if not isinstance(parsed, dict):
        raise ValueError("A resposta do modelo não é um objeto JSON")
    return parsed


def ask_model(client: Any, model: str, system_prompt: str, task: str, page: Page, image: Path, prior_error: str = "") -> dict[str, Any]:
    context = (
        f"Tarefa de usabilidade:\n{task}\n\n"
        f"Texto atualmente visível na tela:\n{read_visible_text(page)}\n\n"
        f"URL visível no navegador: {page.url}\n"
    )
    if prior_error:
        context += f"\nA última ação falhou. Escolha outra ação visível e registre o problema: {prior_error}\n"
    response = client.responses.create(
        model=model,
        input=[
            {
                "role": "system",
                "content": [{"type": "input_text", "text": system_prompt}],
            },
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": context},
                    {"type": "input_image", "image_url": data_url(image)},
                ],
            },
        ],
        text={"format": {"type": "json_schema", "name": "usability_turn", "strict": True, "schema": TURN_SCHEMA}},
    )
    return clean_json(response.output_text)


def visible_candidates(page: Page, target: str, kind: str) -> list[Any]:
    target = target.strip()
    candidates: list[Any] = []
    if kind == "button":
        candidates.extend([page.get_by_role("button", name=target, exact=True), page.get_by_role("button", name=target, exact=False)])
    if kind == "link":
        candidates.extend([page.get_by_role("link", name=target, exact=True), page.get_by_role("link", name=target, exact=False)])
    candidates.extend([page.get_by_text(target, exact=True), page.get_by_text(target, exact=False)])
    return candidates


def first_visible(candidates: list[Any]) -> Any:
    for candidate in candidates:
        try:
            if candidate.count() and candidate.first.is_visible():
                return candidate.first
        except Exception:
            continue
    raise ValueError("nenhum controle visível corresponde ao alvo informado")


def execute_action(page: Page, action: dict[str, Any]) -> ActionRecord:
    action_type = str(action.get("type", "")).lower()
    target = str(action.get("target", ""))
    value = str(action.get("value", ""))
    record = ActionRecord(action=action_type, target=target, value=value)
    try:
        if action_type == "click":
            first_visible(visible_candidates(page, target, "button") + visible_candidates(page, target, "link")).click()
        elif action_type == "fill":
            locator = page.get_by_label(target, exact=False)
            if not locator.count() or not locator.first.is_visible():
                locator = page.get_by_placeholder(target, exact=False)
            first_visible([locator]).fill(value)
        elif action_type == "select":
            locator = page.get_by_label(target, exact=False)
            first_visible([locator]).select_option(label=value)
        elif action_type == "press":
            first_visible(visible_candidates(page, target, "button") + visible_candidates(page, target, "link") + [page.locator("body")]).press(value or "Enter")
        elif action_type == "scroll":
            amount = 720 if str(action.get("direction", "down")) == "down" else -720
            page.mouse.wheel(0, amount)
        elif action_type == "wait":
            page.wait_for_timeout(min(max(int(value or "800"), 100), 2_000))
        elif action_type == "done":
            record.success = bool(action.get("success", False))
            record.error = str(action.get("reason", ""))
            record.url_after = page.url
            return record
        else:
            raise ValueError(f"ação não suportada: {action_type}")
        page.wait_for_timeout(450)
        record.success = True
        record.url_after = page.url
    except (PlaywrightTimeoutError, Exception) as exc:
        record.error = str(exc)
        record.url_after = page.url
    return record


def merge_turn(result: TestResult, turn: dict[str, Any]) -> None:
    result.interpretations.append(str(turn.get("understanding", "")))
    result.confusion.extend(turn.get("confusing", []) or [])
    result.important.extend(turn.get("important", []) or [])
    result.excess_information.extend(turn.get("excess_information", []) or [])
    final = turn.get("final") or {}
    result.interpretation_errors.extend(final.get("interpretation_errors", []) or [])
    result.confusing_fields.extend(final.get("confusing_fields", []) or [])
    result.hard_to_find_buttons.extend(final.get("hard_to_find_buttons", []) or [])
    result.missing_information.extend(final.get("missing_information", []) or [])
    result.screens_visited.extend(final.get("screens_visited", []) or [])
    result.summary = str(final.get("summary", result.summary))
    for name in ("clarity_score", "ease_score", "confidence_score"):
        value = final.get(name)
        if isinstance(value, (int, float)):
            setattr(result, name, float(value))


def run_one(page: Page, client: Any, model: str, system_prompt: str, config: dict[str, str], max_actions: int, dry_run: bool) -> TestResult:
    result = TestResult(id=config["id"], name=config["name"], task=config["task"])
    page.goto(DEFAULT_BASE_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(500)
    previous_error = ""
    for step in range(max_actions + 1):
        image = screenshot(page, result.id, step)
        result.screenshots.append(str(image.relative_to(ROOT)).replace("\\", "/"))
        result.screens_visited.append(path_label(page.url))
        if dry_run:
            result.stopped_reason = "dry-run: screenshot capturada sem chamada ao modelo"
            break
        turn = ask_model(client, model, system_prompt, config["task"], page, image, previous_error)
        merge_turn(result, turn)
        action = turn.get("action") or {"type": "done", "success": False, "reason": "modelo sem ação"}
        record = execute_action(page, action)
        if action.get("type") == "done":
            result.success = bool(action.get("success", False))
            result.stopped_reason = str(action.get("reason", ""))
            break
        result.actions.append(record)
        result.action_count += 1
        previous_error = record.error
        if not record.success:
            result.confusion.append(f"Ação '{record.action}' em '{record.target}' falhou: {record.error}")
        if step == max_actions:
            result.stopped_reason = f"limite de {max_actions} ações atingido"
    result.screens_visited = unique(result.screens_visited)
    result.confusion = unique(result.confusion)
    result.important = unique(result.important)
    result.excess_information = unique(result.excess_information)
    result.interpretation_errors = unique(result.interpretation_errors)
    result.confusing_fields = unique(result.confusing_fields)
    result.hard_to_find_buttons = unique(result.hard_to_find_buttons)
    result.missing_information = unique(result.missing_information)
    return result


def serializable_result(result: TestResult) -> dict[str, Any]:
    return asdict(result)


def build_report(results: list[TestResult], started_at: str, model: str, base_url: str, dry_run: bool) -> dict[str, Any]:
    successful = sum(item.success for item in results)
    count = len(results)
    average_actions = sum(item.action_count for item in results) / count if count else 0
    score = lambda name: round(sum(getattr(item, name) for item in results) / count, 1) if count else 0
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "started_at": started_at,
        "base_url": base_url,
        "model": model,
        "dry_run": dry_run,
        "screen_only": True,
        "summary": {
            "success_rate": round(successful / count, 3) if count else 0,
            "successful_tests": successful,
            "total_tests": count,
            "average_actions": round(average_actions, 2),
            "clarity_score": score("clarity_score"),
            "ease_score": score("ease_score"),
            "confidence_score": score("confidence_score"),
        },
        "tests": [serializable_result(item) for item in results],
    }


def md_list(items: list[str], empty: str = "Nenhum registro.") -> str:
    return "\n".join(f"- {item}" for item in items) if items else f"- {empty}"


def markdown_report(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "# UX Report",
        "",
        "## Resumo executivo",
        "",
        f"O agente avaliou a plataforma como um advogado externo sem treinamento, usando apenas a interface renderizada. A taxa de sucesso foi **{summary['successful_tests']}/{summary['total_tests']} ({summary['success_rate']:.0%})**, com média de **{summary['average_actions']:.2f} ações por tarefa**.",
        "",
        f"- Clareza: **{summary['clarity_score']}/10**",
        f"- Facilidade: **{summary['ease_score']}/10**",
        f"- Confiança para decidir: **{summary['confidence_score']}/10**",
        "",
        "## Resultado por tarefa",
        "",
        "| Teste | Resultado | Ações | Telas | Clareza | Facilidade | Confiança |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for item in report["tests"]:
        lines.append(f"| {item['name']} | {'Sucesso' if item['success'] else 'Falha'} | {item['action_count']} | {len(item['screens_visited'])} | {item['clarity_score']}/10 | {item['ease_score']}/10 | {item['confidence_score']}/10 |")
    lines.extend(["", "## Observações por tarefa", ""])
    for item in report["tests"]:
        lines.extend([
            f"### {item['name']}",
            "",
            f"**Resumo:** {item['summary'] or 'Sem resumo final.'}",
            "",
            f"**Interpretações:** {item['interpretations'][-1] if item['interpretations'] else 'Nenhuma.'}",
            "",
            "**Ações executadas**",
            md_list([f"{a['action']} — {a['target']}" + (f" = {a['value']}" if a['value'] else "") + (f" (falhou: {a['error']})" if a['error'] else "") for a in item["actions"]]),
            "",
            "**Confusões e erros**",
            md_list(unique(item["confusion"] + item["interpretation_errors"] + item["confusing_fields"])),
            "",
            "**Botões difíceis, informação excessiva ou faltante**",
            md_list(unique(item["hard_to_find_buttons"] + item["excess_information"] + item["missing_information"])),
            "",
            f"**Screenshots:** {', '.join(f'`{path}`' for path in item['screenshots']) or 'Nenhum.'}",
            "",
        ])
    all_confusion = unique([entry for item in report["tests"] for entry in item["confusion"] + item["confusing_fields"]])
    all_errors = unique([entry for item in report["tests"] for entry in item["interpretation_errors"]])
    improvements = (all_confusion + all_errors + unique([entry for item in report["tests"] for entry in item["missing_information"]]))[:5]
    lines.extend(["## Erros de interpretação", "", md_list(all_errors), "", "## Principais pontos de confusão", "", md_list(all_confusion), "", "## 5 melhorias de maior impacto", "", md_list(improvements, "O agente não registrou melhorias específicas."), ""])
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Executa o agente de teste de usabilidade visual.")
    parser.add_argument("--base-url", default=os.getenv("USABILITY_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--model", default=os.getenv("OPENAI_MODEL", DEFAULT_MODEL))
    parser.add_argument("--max-actions", type=int, default=14)
    parser.add_argument("--tests", nargs="*", help="IDs dos testes; por padrão executa os seis.")
    parser.add_argument("--dry-run", action="store_true", help="Abre o app e captura telas sem chamar a OpenAI.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    global DEFAULT_BASE_URL
    DEFAULT_BASE_URL = args.base_url.rstrip("/")
    selected = [item for item in TASKS if not args.tests or item["id"] in args.tests]
    if not selected:
        print("Nenhum teste selecionado.", file=sys.stderr)
        return 2
    if sync_playwright is None:
        print("Dependência ausente: instale requirements.txt e rode playwright install chromium.", file=sys.stderr)
        return 2
    if not args.dry_run and (OpenAI is None or not os.getenv("OPENAI_API_KEY")):
        print("Defina OPENAI_API_KEY ou use --dry-run.", file=sys.stderr)
        return 2
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    system_prompt = PROMPT_PATH.read_text(encoding="utf-8")
    client = None if args.dry_run else OpenAI()
    started_at = datetime.now(timezone.utc).isoformat()
    results: list[TestResult] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900}, locale="pt-BR")
        page = context.new_page()
        try:
            for config in selected:
                print(f"Executando {config['name']}...")
                results.append(run_one(page, client, args.model, system_prompt, config, max(1, args.max_actions), args.dry_run))
        finally:
            context.close()
            browser.close()
    report = build_report(results, started_at, args.model, args.base_url, args.dry_run)
    (REPORTS_DIR / "UX_REPORT.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (REPORTS_DIR / "UX_REPORT.md").write_text(markdown_report(report), encoding="utf-8")
    print(f"Relatórios gerados em {REPORTS_DIR}")
    return 0 if all(item.success for item in results) or args.dry_run else 1


if __name__ == "__main__":
    raise SystemExit(main())
