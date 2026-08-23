"""Tests de la logica del vigilante de salud (obs #5). Ejecutar desde este dir:
    python3 -m unittest test_check_health
"""
import unittest

from check_health import check_health, evaluate_transition, interpret


class FakeResp:
    def __init__(self, code, body):
        self._code = code
        self._body = body.encode()

    def getcode(self):
        return self._code

    def read(self, n=None):
        return self._body

    def close(self):
        pass


class InterpretTest(unittest.TestCase):
    def test_up(self):
        self.assertEqual(interpret(200, '{"status":"UP"}'), "UP")

    def test_down_by_status(self):
        self.assertEqual(interpret(200, '{"status":"DOWN"}'), "DOWN")

    def test_down_by_5xx(self):
        self.assertEqual(interpret(503, '{"status":"DOWN"}'), "DOWN")

    def test_down_bad_body(self):
        self.assertEqual(interpret(200, "no soy json"), "DOWN")


class CheckHealthTest(unittest.TestCase):
    def test_ok(self):
        status, _ = check_health("x", 1, opener=lambda u, t: FakeResp(200, '{"status":"UP"}'))
        self.assertEqual(status, "UP")

    def test_network_error_is_down(self):
        def boom(u, t):
            raise ConnectionError("refused")
        status, detail = check_health("x", 1, opener=boom)
        self.assertEqual(status, "DOWN")
        self.assertIn("refused", detail)


class TransitionTest(unittest.TestCase):
    R = 7200  # realert 2h en segundos

    def test_primer_up_no_avisa(self):
        kind, state = evaluate_transition({}, "UP", 1000, self.R)
        self.assertIsNone(kind)
        self.assertEqual(state["status"], "UP")

    def test_primer_down_avisa(self):
        kind, _ = evaluate_transition({}, "DOWN", 1000, self.R)
        self.assertEqual(kind, "down")

    def test_up_a_down_avisa(self):
        kind, _ = evaluate_transition({"status": "UP"}, "DOWN", 1000, self.R)
        self.assertEqual(kind, "down")

    def test_down_a_up_recuperacion(self):
        kind, _ = evaluate_transition({"status": "DOWN", "last_alert_at": 900}, "UP", 1000, self.R)
        self.assertEqual(kind, "recovery")

    def test_sigue_down_reciente_no_avisa(self):
        kind, _ = evaluate_transition({"status": "DOWN", "last_alert_at": 1000}, "DOWN", 1100, self.R)
        self.assertIsNone(kind)

    def test_sigue_down_viejo_re_avisa(self):
        kind, _ = evaluate_transition({"status": "DOWN", "last_alert_at": 1000}, "DOWN", 1000 + self.R + 1, self.R)
        self.assertEqual(kind, "down")


if __name__ == "__main__":
    unittest.main()
