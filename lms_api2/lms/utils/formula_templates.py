import math
import re

import sympy as sp
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)


class FormulaTemplateMixin:
    def make_calculated_input(self, question, values, sort_order=0):
        # шаблон с {expr} -> payload с phN и ожидаемыми ответами
        input_labels = []
        expected_inputs = []
        placeholder_index = 0

        def replace_placeholder(match):
            nonlocal placeholder_index

            label = match.group(1).strip()
            placeholder_index += 1

            input_labels.append(label)
            expected_inputs.append(self._format_answer_value(self.compute(label, values)))

            return f'ph{placeholder_index}'

        rendered = re.sub(r'\{([^{}]+)\}', replace_placeholder, question)
        rendered = self.render_bang_expressions(rendered, values)

        return {
            'sort_order': sort_order,
            'placeholders_count': placeholder_index,
            'question_with_blanks': self.template_to_latex(rendered),
            'expected_inputs': expected_inputs,
            'answer_format': 'array',
            'input_labels': input_labels,
        }

    def render_bang_expressions(self, question, values):
        # expr! -> вычисленное значение в тексте формулы
        question = re.sub(
            r'\b([A-Za-z_]\w*)\(([^()]*)\)!',
            lambda match: self._render_function_bang(match.group(1), match.group(2), values),
            question,
        )

        question = re.sub(
            r'\b([A-Za-z_]\w*)!',
            lambda match: self._format_answer_value(self.compute(match.group(1), values)),
            question,
        )

        return question

    def template_to_latex(self, text):
        # строка формулы -> LaTeX без лишнего упрощения
        parts = text.split('=')

        if len(parts) == 1:
            return self._restore_subtraction_order(self._latex_sum_preserving_order(text))

        rendered_parts = [self._latex_label(parts[0])]
        rendered_parts.extend(self._latex_sum_preserving_order(part) for part in parts[1:])

        return self._restore_subtraction_order('='.join(rendered_parts))

    def _render_function_bang(self, name, args_text, values):
        # f(args)! -> подставленное тело функции
        return f'({self._render_function_body(name, args_text, values, stack=set())})'

    def _render_function_body(self, name, args_text, values, stack):
        # имя функции + аргументы -> тело с подставленными значениями
        if name not in self.formulas:
            raise ValueError(f'Неизвестная функция: {name}')

        formula = self.formulas[name]

        if not isinstance(formula, dict):
            return self._format_answer_value(self.compute(name, values))

        if name in stack:
            raise ValueError(f'Циклическая ссылка: {name}')

        args = list(formula.get('args', []))
        passed_args = [item.strip() for item in args_text.split(',') if item.strip()]

        if len(args) != len(passed_args):
            raise ValueError(f'Неверное число аргументов: {name}')

        body = formula['expr']

        for arg, value in zip(args, passed_args):
            body = re.sub(rf'\b{re.escape(arg)}\b', value, body)

        body = self.render_bang_expressions(body, values)

        stack.add(name)
        body = self._expand_nested_function_calls(body, values, stack)
        stack.remove(name)

        for variable_name, variable_value in values.items():
            if variable_name == 'x':
                continue

            body = re.sub(
                rf'\b{re.escape(variable_name)}\b',
                self._format_answer_value(variable_value),
                body,
            )

        return body

    def _expand_nested_function_calls(self, text, values, stack):
        # вложенные f(g(x)) -> раскрытые тела функций
        pattern = re.compile(r'\b([A-Za-z_]\w*)\(([^()]*)\)')

        while True:
            changed = False

            def replace_call(match):
                nonlocal changed

                nested_name = match.group(1)
                nested_args = match.group(2)

                if nested_name not in self.formulas:
                    return match.group(0)

                nested_formula = self.formulas[nested_name]

                if not isinstance(nested_formula, dict):
                    return match.group(0)

                changed = True

                return (
                    '('
                    + self._render_function_body(nested_name, nested_args, values, stack)
                    + ')'
                )

            text = pattern.sub(replace_call, text)

            if not changed:
                return text

    def _latex_piece(self, text):
        # кусок формулы -> LaTeX-кусок
        text = self._normalize_text(text.strip())

        local_dict = dict(self.context)

        for index in range(1, 100):
            local_dict[f'ph{index}'] = sp.Symbol(f'ph{index}')

        for transformations in (
            standard_transformations,
            standard_transformations + (implicit_multiplication_application,),
        ):
            try:
                expr = parse_expr(
                    text,
                    local_dict=local_dict,
                    transformations=transformations,
                    evaluate=False,
                )

                return sp.latex(expr)
            except Exception:
                continue

        return self._fallback_latex(text)

    def _latex_label(self, text):
        # L2(x) -> L_{2}(x)
        text = text.strip()
        match = re.fullmatch(r'([A-Za-z_]+)(\d*)\((.*)\)', text)

        if not match:
            return self._latex_piece(text)

        name, index, args = match.groups()
        latex_name = f'{name}_{{{index}}}' if index else name

        return f'{latex_name}{{\\left({args.strip()} \\right)}}'

    def _latex_sum_preserving_order(self, text):
        # a+b-c -> LaTeX с исходным порядком слагаемых
        text = self._strip_wrapping_parentheses(text.strip())
        parts = self._split_top_level_sum(text)

        if len(parts) == 1:
            return self._latex_piece(text)

        result = ''

        for sign, part in parts:
            latex = self._latex_piece(part)

            if not result:
                result = f'- {latex}' if sign == '-' else latex
                continue

            result += f' {sign} {latex}'

        return result

    def _split_top_level_sum(self, text):
        # сумма верхнего уровня -> пары (знак, часть)
        parts = []
        depth = 0
        start = 0
        current_sign = '+'

        for index, char in enumerate(text):
            if char == '(':
                depth += 1
            elif char == ')':
                depth -= 1
            elif char in '+-' and depth == 0:
                previous = text[index - 1] if index > 0 else ''

                if index == 0 or previous in '*/(+-':
                    continue

                part = text[start:index].strip()

                if part:
                    parts.append((current_sign, part))

                current_sign = char
                start = index + 1

        part = text[start:].strip()

        if part:
            parts.append((current_sign, part))

        return parts

    def _strip_wrapping_parentheses(self, text):
        # ((expr)) -> expr
        while text.startswith('(') and text.endswith(')'):
            depth = 0
            wraps_all = True

            for index, char in enumerate(text):
                if char == '(':
                    depth += 1
                elif char == ')':
                    depth -= 1

                    if depth == 0 and index != len(text) - 1:
                        wraps_all = False
                        break

            if not wraps_all:
                return text

            text = text[1:-1].strip()

        return text

    def _fallback_latex(self, text):
        # непарсируемый текст -> безопасный LaTeX-приближенный вид
        text = text.replace('*', r'\cdot ')
        text = re.sub(r'\bL(\d+)\(x\)', r'L_{\1}(x)', text)
        text = re.sub(r'\bl(\d+)\(x\)', r'l_{\1}(x)', text)

        return text

    def _restore_subtraction_order(self, latex):
        # -x0+x1 -> x1-x0
        return re.sub(
            r'-\s*(ph_\{\d+\}|[A-Za-z]_\{\d+\}|[A-Za-z]\d*)\s*\+\s*(ph_\{\d+\}|[A-Za-z]_\{\d+\}|[A-Za-z]\d*)',
            r'\2 - \1',
            latex,
        )

    def _format_answer_value(self, value):
        # SymPy-число -> строка до двух знаков без округления
        value = sp.nsimplify(value)

        if getattr(value, 'is_Integer', False):
            return str(int(value))

        number = float(value)
        truncated = math.trunc(number * 100) / 100
        text = f'{truncated:.2f}'.rstrip('0').rstrip('.')
        return text or '0'
