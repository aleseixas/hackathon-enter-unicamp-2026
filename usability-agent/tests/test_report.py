import json
import unittest

from run_test import ActionRecord, TestResult, build_report, markdown_report, unique


class ReportTests(unittest.TestCase):
    def test_report_has_structured_summary_and_markdown(self):
        result = TestResult(
            id="test-1",
            name="Compreensão",
            task="Entender o caso",
            success=True,
            action_count=2,
            actions=[ActionRecord(action="click", target="Entrar como Advogado", success=True)],
            screens_visited=["/", "/processos/1"],
            screenshots=["screenshots/test-1-step-00.png"],
            summary="A recomendação estava clara.",
            clarity_score=8,
            ease_score=7,
            confidence_score=8,
        )
        report = build_report([result], "2026-01-01T00:00:00+00:00", "test-model", "http://127.0.0.1:5173", False)
        self.assertEqual(report["summary"]["success_rate"], 1.0)
        self.assertEqual(report["summary"]["average_actions"], 2.0)
        self.assertEqual(json.loads(json.dumps(report))["tests"][0]["success"], True)
        self.assertIn("Compreensão", markdown_report(report))

    def test_report_deduplicates_shared_observations(self):
        first = TestResult(id="a", name="A", task="A", confusion=["botão pouco claro", "botão pouco claro"])
        second = TestResult(id="b", name="B", task="B", confusion=["botão pouco claro"])
        report = build_report([first, second], "now", "model", "url", True)
        markdown = markdown_report(report)
        self.assertEqual(unique(first.confusion + second.confusion), ["botão pouco claro"])
        self.assertIn("Principais pontos de confusão", markdown)


if __name__ == "__main__":
    unittest.main()
