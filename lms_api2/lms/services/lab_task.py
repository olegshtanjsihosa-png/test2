from typing import Any, Dict, List

import re

import sympy as sp

from lms.models import ElementTypeBinding, LaboratoryWork
from lms.utils.interpolation_calculator import FormulaEngine


class LabTaskMixin:
    def get_task_element_with_data(self, lab_id: int) -> Dict[str, Any]:
        # lab_id -> самостоятельное задание с точками, формулами и проверками
        try:
            lab = LaboratoryWork.objects.get(id=lab_id)
        except LaboratoryWork.DoesNotExist:
            return {'success': False, 'message': 'лабораторная работа не найдена'}

        binding = self._first_binding(lab_id, 'task')
        if not binding:
            return {'success': False, 'message': 'самостоятельное задание не найдено'}

        settings = self._task_settings(binding)
        formulas = self._task_formulas(binding)
        if not formulas:
            return {'success': False, 'message': 'для самостоятельного задания не заданы формулы'}

        engine = FormulaEngine(formulas)
        expressions = self._result_expression_names(formulas, engine)
        if not expressions:
            return {'success': False, 'message': 'для самостоятельного задания не указано проверяемое выражение'}

        points_count = max(settings['points_count'], len(expressions) + 1 if len(expressions) > 1 else 2)
        values = self._generate_values(points_count)
        evaluation_points = self._default_evaluation_points(values, points_count)

        built_expressions = [
            self._build_task_expression(binding, engine, values, name, index, len(expressions), evaluation_points)
            for index, name in enumerate(expressions)
        ]
        value_questions = self._build_value_questions(binding.id, built_expressions, evaluation_points)
        questions = value_questions

        # значения x/y -> текстовые точки для инструкции
        point_lines = self._point_lines(values, points_count)
        content = self._task_content(binding)
        graph = built_expressions[0]['graph']
        value_graph = built_expressions[-1]['graph']

        return {
            'success': True,
            'mode': 'self_study',
            'element_type_binding_id': binding.id,
            'element': {
                'id': binding.lab_element.id,
                'title': binding.lab_element.title or 'Самостоятельное задание',
                'type': 'task',
                'laboratory_work_id': lab.id,
            },
            'content': content,
            'description': self._task_description(content),
            'instructions': 'Точки: ' + ', '.join(point_lines),
            'formula_cards': self._task_formula_cards(binding, engine),
            'generated_variables': values,
            'functions': [
                {'name': item['name'], 'args': [], 'body': item['expression']}
                for item in built_expressions
            ],
            'questions': questions,
            'graph': graph,
            'steps': [
                {
                    'id': f'task-{binding.id}-{self._task_step_suffix(expressions, "values")}',
                    'title': 'Вычислите значения',
                    'description': 'Подставьте контрольные значения x.',
                    'instructions': '',
                    'hint': None,
                    'step_order': 1,
                    'tests': value_questions,
                    'graph': value_graph,
                },
            ],
        }

    def _task_settings(self, task_binding: ElementTypeBinding) -> Dict[str, Any]:
        # характеристики задания -> настройки генерации
        settings = {'points_count': self.points_count}
        for item in task_binding.characteristic_values.select_related('characteristic').all():
            name = item.characteristic.name
            if name == 'points_count' and item.value:
                settings['points_count'] = max(2, int(item.value))
        return settings

    def _result_expression_names(self, formulas: Dict[str, Any], engine: FormulaEngine) -> List[str]:
        # формулы из БД -> выражения, которые зависят от x и проверяются
        x_dependent = []
        for name, formula in formulas.items():
            if isinstance(formula, dict):
                continue
            try:
                expression = engine.build(name, max_steps=4)['expanded']
            except Exception:
                continue
            if any(str(symbol) == 'x' for symbol in expression.free_symbols):
                x_dependent.append(name)
        return x_dependent

    def _build_task_expression(
        self,
        binding: ElementTypeBinding,
        engine: FormulaEngine,
        values: Dict[str, Any],
        name: str,
        index: int,
        total: int,
        evaluation_points: List[Any],
    ) -> Dict[str, Any]:
        # имя выражения + точки -> вопрос на построение многочлена
        expression = engine.build(name, values=values)['expanded']
        expression_text = str(expression)
        sample_points = self._sample_points(values, index, total, evaluation_points)
        question = self._expression_question(binding, name, index, expression, sample_points)

        return {
            'name': name,
            'expression': expression_text,
            'sympy': expression,
            'question': question,
            'graph': self._task_graph_data(values, expression_text, int(values['points_count']), name),
        }

    def _expression_question(self, binding: ElementTypeBinding, name: str, index: int, expression, sample_points: List[Any]):
        # выражение SymPy -> вопрос, который фронт проверяет как формулу
        question_text = self._expression_question_text(name, index, len(sample_points))
        suffix = self._question_suffix(name, index, len(sample_points))

        return {
            'id': f'task-{binding.id}-{suffix}',
            'type': 'polynomial',
            'question': question_text,
            'sort_order': 1,
            'expected_answer': str(expression),
            'expected_latex': sp.latex(expression),
            'answer_format': 'expression',
            'sample_points': sample_points,
        }

    def _expression_question_text(self, name: str, index: int, sample_points_count: int) -> str:
        # имя выражения -> подпись вопроса для студента
        if sample_points_count >= 3:
            return f'Введите {name}(x) на отрезке [x{index}; x{index + 1}]'
        return f'Введите {name}(x)'

    def _question_suffix(self, name: str, index: int, sample_points_count: int) -> str:
        if index == 0 and sample_points_count < 3:
            return 'poly'
        return re.sub(r'[^a-zA-Z0-9_-]+', '-', name).strip('-').lower() or f'expr-{index + 1}'

    def _sample_points(self, values: Dict[str, Any], index: int, total: int, evaluation_points: List[Any]) -> List[Any]:
        # выражение сплайна -> левый узел, середина и правый узел
        if total == 1:
            return evaluation_points

        left_key = f'X[{index}]'
        right_key = f'X[{index + 1}]'
        if left_key not in values or right_key not in values:
            return evaluation_points

        midpoint = self._midpoint(values[left_key], values[right_key])
        return [values[left_key], midpoint, values[right_key]]

    def _build_value_questions(self, binding_id: int, expressions: List[Dict[str, Any]], evaluation_points: List[Any]):
        # построенные выражения -> вопросы на подстановку x
        if len(expressions) == 1:
            expression = expressions[0]
            return [
                self._value_question(
                    binding_id,
                    f'value-{index}',
                    f"{expression['name']}({point}) =",
                    self._format_number(self._subs_x(expression['sympy'], point)),
                    index + 1,
                )
                for index, point in enumerate(evaluation_points)
            ]

        questions = []
        for index, expression in enumerate(expressions):
            sample_points = expression['question'].get('sample_points', [])
            point = sample_points[1] if len(sample_points) >= 3 else evaluation_points[min(index, len(evaluation_points) - 1)]
            questions.append(
                self._value_question(
                    binding_id,
                    f"value-{expression['name'].lower()}",
                    f"{expression['name']}({point}) =",
                    self._format_number(self._subs_x(expression['sympy'], point)),
                    index + 1,
                )
            )
        return questions

    def _value_question(self, binding_id, suffix, question, expected, sort_order):
        # текст вопроса + ответ -> числовой тест для фронта
        return {
            'id': f'task-{binding_id}-{suffix}',
            'type': 'calculated',
            'question': question,
            'question_rendered': question.replace(' =', ''),
            'sort_order': sort_order,
            'expected_answer': expected,
            'answer_format': 'number',
        }

    def _task_step_suffix(self, expressions: List[str], step: str) -> str:
        if len(expressions) > 1:
            return 'spline-poly' if step == 'build' else 'spline-values'
        return 'polynomial' if step == 'build' else 'values'

    def _task_formulas(self, binding: ElementTypeBinding) -> Dict[str, Any]:
        return self._formula_engine_formulas(self._binding_values([binding], 'formula'))

    def _default_evaluation_points(self, values: Dict[str, Any], points_count: int) -> List[int]:
        # узлы интерполяции -> две контрольные точки вне узлов
        used_x = {values[f'X[{index}]'] for index in range(points_count)}
        result = []
        candidate = 1
        while len(result) < 2:
            if candidate not in used_x:
                result.append(candidate)
            candidate += 1
        return result

    def _task_formula_cards(self, binding: ElementTypeBinding, engine: FormulaEngine) -> List[Dict[str, Any]]:
        # формулы из БД -> карточки формул над самостоятельным заданием
        cards = []
        for item in self._binding_characteristic_values(binding, 'formula'):
            formula = item.value
            if '=' not in formula:
                continue
            left, _right = formula.split('=', 1)
            left = left.strip()
            display_left = self._formula_display_left(left, engine)
            cards.append({
                'title': display_left,
                'formula': self._formula_latex(formula, engine),
            })
        return cards

    def _formula_latex(self, formula: str, engine: FormulaEngine) -> str:
        # формула движка -> LaTeX для показа студенту
        try:
            left, right = formula.split('=', 1)
            display_left = self._formula_display_left(left.strip(), engine, latex=True)
            latex = engine.template_to_latex(f'{display_left}={right.strip()}')
            return self._replace_divided_difference_symbols(latex)
        except Exception:
            return formula

    def _formula_display_left(self, left: str, engine: FormulaEngine, latex: bool = False) -> str:
        # левая часть формулы -> подпись без отдельной таблицы названий
        divided_difference = self._divided_difference_label(left, latex=latex)
        if divided_difference:
            return divided_difference

        if '(' in left:
            return left
        try:
            expression = engine.build(left, max_steps=4)['expanded']
        except Exception:
            return left
        if any(str(symbol) == 'x' for symbol in expression.free_symbols):
            return f'{left}(x)'
        return left

    def _divided_difference_label(self, left: str, latex: bool = False) -> str:
        # f012 -> f[x0,x1,x2]
        match = re.fullmatch(r'f(\d{2,})', left)
        if not match:
            return ''

        indices = match.group(1)
        if latex:
            points = ','.join(f'x_{index}' for index in indices)
        else:
            points = ','.join(f'x{index}' for index in indices)
        return f'f[{points}]'

    def _replace_divided_difference_symbols(self, latex: str) -> str:
        # f_{012} в LaTeX -> f[x_0,x_1,x_2]
        def replace(match):
            points = ','.join(f'x_{index}' for index in match.group(1))
            return rf'f\left[{points}\right]'

        return re.sub(r'f_\{(\d{2,})\}', replace, latex)

    def _task_content(self, binding: ElementTypeBinding) -> Dict[str, Any]:
        # subtitle/paragraphs из БД -> вводный текст задания
        content = {'subtitle': '', 'paragraphs': []}
        for item in binding.characteristic_values.select_related('characteristic').order_by('order', 'id'):
            name = item.characteristic.name
            if name == 'subtitle' and not content['subtitle']:
                content['subtitle'] = item.value.strip()
            elif name == 'paragraphs' and item.value.strip():
                content['paragraphs'].extend(
                    paragraph.strip()
                    for paragraph in item.value.splitlines()
                    if paragraph.strip()
                )
        return content

    def _task_description(self, content: Dict[str, Any]) -> str:
        return ' '.join(content.get('paragraphs', []))

    def _point_lines(self, values: Dict[str, Any], points_count: int) -> List[str]:
        # значения X/Y -> строки A1 = (x; y)
        return [
            f"A{index + 1} = ({values[f'X[{index}]']}; {values[f'Y[{index}]']})"
            for index in range(points_count)
        ]

    def _midpoint(self, left, right):
        # границы отрезка -> середина для проверки сплайна
        return self._format_number((sp.nsimplify(left) + sp.nsimplify(right)) / 2)

    def _format_number(self, value):
        # число SymPy -> int или число до двух знаков без округления
        value = sp.nsimplify(value)
        if getattr(value, 'is_Integer', False):
            return int(value)
        number = float(value)
        truncated = int(number * 100) / 100
        return int(truncated) if float(truncated).is_integer() else truncated

    def _number(self, value):
        # число SymPy -> обычное число Python
        value = sp.nsimplify(value)
        if getattr(value, 'is_Integer', False):
            return int(value)
        return float(value)

    def _subs_x(self, expression, value):
        # выражение от x + значение x -> подставленное выражение
        if not isinstance(expression, sp.Basic):
            expression = sp.sympify(expression)
        substitutions = {symbol: value for symbol in expression.free_symbols if symbol.name == 'x'}
        return expression.subs(substitutions)
