from typing import Any, Dict, List

import re

import sympy as sp

from lms.models import Step, Test


class LabGraphMixin:
    def _get_graph_data(self, step: Step, values: Dict[str, Any]) -> Dict[str, Any]:
        # шаг + значения -> точки и функция для графика
        graph = {
            'has_graph': False,
            'points': self._graph_points(values),
            'function': None,
        }
        if graph['points']:
            graph['has_graph'] = True

        if not self.formula_engine:
            return graph

        func_name = self._step_graph_function_name(step)
        if not func_name:
            return graph

        try:
            expression = self._build_graph_expression(func_name, values)
        except Exception:
            return graph

        graph['function'] = {
            'name': func_name,
            'expression': expression,
            'variables': ['x'],
        }
        graph['has_graph'] = True
        return graph

    def _graph_points(self, values: Dict[str, Any]) -> List[Dict[str, Any]]:
        # x/y значения -> массив точек A, B, C...
        count = int(values.get('points_count', self.points_count))
        points = []
        for index in range(count):
            x = values.get(f'x{index}', values.get(f'X[{index}]'))
            y = values.get(f'y{index}', values.get(f'Y[{index}]'))
            if x is not None and y is not None:
                points.append({'x': x, 'y': y, 'label': chr(ord('A') + index)})
        return points

    def _step_graph_function_name(self, step: Step):
        # тесты шага -> имя функции, которую нужно провести на графике
        names = set(self.formula_engine.formulas.keys())
        for test in Test.objects.filter(step_id=step.id).order_by('sort_order'):
            left = test.question.split('=', 1)[0].strip()
            match = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)\(', left)
            if match and match.group(1) in names:
                return match.group(1)
        return None

    def _build_graph_expression(self, func_name: str, values: Dict[str, Any]) -> str:
        # имя функции + значения -> выражение от x для графика
        formula = self.formula_engine.formulas.get(func_name, {})
        expr = f'{func_name}(x)' if isinstance(formula, dict) and formula.get('args') else func_name
        built = self.formula_engine.build(expr, values=values)
        expression = built['expanded']
        substitutions = {
            self.formula_engine.to_sympy(name): value
            for name, value in values.items()
            if name != 'x'
        }
        expression = expression.subs(substitutions)
        x_symbol = self.formula_engine.to_sympy('x')
        sp.sympify(expression.subs({x_symbol: 1}))
        return str(expression)

    def _task_graph_data(self, values: Dict[str, Any], expression: str, points_count: int, function_name: str) -> Dict[str, Any]:
        # выражение самостоятельного задания -> график для проверки
        return {
            'has_graph': True,
            'points': [
                {'x': values[f'X[{index}]'], 'y': values[f'Y[{index}]'], 'label': chr(ord('A') + index)}
                for index in range(points_count)
            ],
            'function': {'name': function_name, 'expression': expression, 'variables': ['x']},
        }
