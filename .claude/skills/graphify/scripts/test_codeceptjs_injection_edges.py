import tempfile
import unittest
from pathlib import Path

from codeceptjs_injection_edges import enrich


class CodeceptInjectionEdgesTest(unittest.TestCase):
    def test_full_and_incremental_fixture_resolution(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            root = Path(directory)
            (root / "steps.d.ts").write_text(
                "type steps_file = typeof import('./custom_steps.js');\n"
                "type statsAndLicensePage = typeof import('./statsAndLicensePage.js');\n"
                "type adminPage = typeof import('./adminPage.js');\n",
                encoding="utf-8",
            )
            (root / "verify_test.js").write_text(
                "const { adminPage: admin } = inject();\n"
                "Scenario('test', async ({ I, statsAndLicensePage }) => {});\n",
                encoding="utf-8",
            )
            for name in ("custom_steps.js", "statsAndLicensePage.js", "adminPage.js"):
                (root / name).write_text("module.exports = {};\n", encoding="utf-8")

            names = (
                "steps.d.ts", "verify_test.js", "custom_steps.js",
                "statsAndLicensePage.js", "adminPage.js",
            )
            nodes = [
                {"id": name.replace(".", "_"), "label": name, "source_file": name}
                for name in names
            ]
            full = {"nodes": nodes, "edges": []}
            self.assertEqual(enrich(full, root), 3)
            self.assertEqual(
                {edge["target"] for edge in full["edges"]},
                {"custom_steps_js", "statsAndLicensePage_js", "adminPage_js"},
            )

            incremental = {"nodes": [nodes[1]], "edges": []}
            self.assertEqual(enrich(incremental, root, {"nodes": nodes}), 3)


if __name__ == "__main__":
    unittest.main()
