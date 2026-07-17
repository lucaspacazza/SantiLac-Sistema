import unittest

from producao_processor import ordem_rows


class OrdemRowsTest(unittest.TestCase):
    def test_preserva_nome_do_fermento_bvadd_na_op_de_coalho(self):
        ordem = {
            "campos": [
                {"rotulo": "PRODUÇÃO DIARIA / DATA", "valor": "14/07/2026"},
                {"rotulo": "LTS PRODUZIDOS TOTAL", "valor": "1.950 L"},
                {"rotulo": "BVADD", "valor": "25 g"},
            ],
            "formulacoes": [{"lote_queijo": "068"}],
        }

        linhas = ordem_rows(ordem)

        self.assertIn(("BVADD", "25 g"), linhas)
        self.assertIn(("FERMENTO (MVD)", ""), linhas)
        self.assertIn(("FERMENTO (FAST)", ""), linhas)


if __name__ == "__main__":
    unittest.main()
