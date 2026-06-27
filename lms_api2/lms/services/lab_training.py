from typing import Any, Dict

import re

from lms.models import Step, Test


class LabTrainingMixin:
    def _process_step(self, step: Step, values: Dict[str, Any]) -> Dict[str, Any]:
        # шаг + значения -> блок шага с тестами и графиком
        tests = Test.objects.filter(step_id=step.id).order_by('sort_order')
        tests_data = [self._process_test(test, values) for test in tests]

        return {
            'id': step.id,
            'title': step.title,
            'description': step.description,
            'instructions': step.instructions,
            '_summary_source': step.summary,
            'hint': None,
            'step_order': step.step_order,
            'tests': tests_data,
            'graph': self._get_graph_data(step, values),
        }

    def _process_test(self, test: Test, values: Dict[str, Any]) -> Dict[str, Any]:
        # тест из БД + значения -> вопрос с ожидаемым ответом
        normalized_type = self._normalize_test_type(test.test_type.name)
        question = test.question.strip()
        left_part = question.split('=', 1)[0].strip() if '=' in question else question

        result = {
            'id': test.id,
            'question': test.question,
            'type': normalized_type,
            'sort_order': test.sort_order,
        }

        if normalized_type == 'single_choice':
            answers = list(test.answers.values('id', 'answer_text'))
            correct = test.answers.filter(is_correct=True).first()
            result.update({
                'options': answers,
                'expected_answer': correct.id if correct else None,
                'answer_format': 'single',
            })
            return result

        if normalized_type == 'multiple_choice':
            answers = list(test.answers.values('id', 'answer_text'))
            result.update({
                'options': answers,
                'expected_answer': list(test.answers.filter(is_correct=True).values_list('id', flat=True)),
                'answer_format': 'multiple',
            })
            return result

        if normalized_type == 'text':
            correct = test.answers.filter(is_correct=True).first()
            result['expected_answer'] = correct.answer_text if correct else None
            return result

        if normalized_type == 'calculated_input':
            # {expr} в вопросе -> поля phN и список правильных ответов
            direct_value = self._direct_value(left_part, values)
            if direct_value is not None and not re.search(r'\{[^{}]+\}', question):
                result.update({
                    'type': 'calculated',
                    'expected_answer': direct_value,
                    'answer_format': 'number',
                })
                return result

            generated = self.formula_engine.make_calculated_input(
                question,
                values,
                sort_order=test.sort_order,
            ) if self.formula_engine else None

            if generated and generated['placeholders_count'] > 0:
                result.update(generated)
                return result

            result.update({
                'type': 'calculated',
                'expected_answer': self._compute_expression(left_part, values),
                'answer_format': 'number',
            })
            return result

        if normalized_type == 'calculated':
            rendered = self._render_question_expression(left_part, values)
            result.update({
                'question_rendered': rendered,
                'expected_answer': self._number(self._compute_expression(rendered, values)),
                'answer_format': 'number',
            })
            return result

        return result

    def _normalize_test_type(self, name: str) -> str:
        # названия из БД -> типы, которые понимает фронт
        value = name.lower()
        if value in {'single_choice', 'choicen', 'single'}:
            return 'single_choice'
        if value in {'multiple_choice', 'multiple'}:
            return 'multiple_choice'
        if value in {'text', 'text_input'}:
            return 'text'
        if 'input' in value:
            return 'calculated_input'
        if 'calculated' in value:
            return 'calculated'
        return value

    def _direct_value(self, expression: str, values: Dict[str, Any]):
        # имя переменной -> готовое значение, если оно уже есть
        name = expression.replace('=', '').strip().strip("'\"")
        return values.get(name)

    def _render_question_expression(self, expression: str, values: Dict[str, Any]) -> str:
        # выражение с {x0} -> выражение с подставленными числами
        return re.sub(r'\{([^{}]+)\}', lambda match: str(values.get(match.group(1), match.group(0))), expression)

    def _compute_expression(self, expression: str, values: Dict[str, Any]):
        # выражение + значения -> число для проверки
        if not self.formula_engine:
            return None
        return self.formula_engine.compute(expression, values)
