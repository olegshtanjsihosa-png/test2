import re

import sympy as sp

from lms.utils.formula_templates import FormulaTemplateMixin


class FormulaEngine(FormulaTemplateMixin):
    def __init__(self, formulas):
        # формулы из БД -> нормализованные формулы и SymPy-контекст
        self.formulas = self._normalize_formulas(formulas)
        self.context = self._make_context()

    def _normalize_text(self, text):
        # пользовательская запись -> запись, понятная SymPy
        text = text.replace('^', '**')
        return (
            text
            .replace('·', '*')
            .replace('−', '-')
            .replace('–', '-')
            .replace('—', '-')
        )

    def _normalize_formulas(self, formulas):
        # строки и функции -> единый словарь движка
        normalized = {}

        for name, formula in formulas.items():
            if isinstance(formula, dict):
                expr = formula.get('expr', formula.get('body', ''))
                expr = self._normalize_text(expr)

                normalized[name] = {
                    **formula,
                    'args': tuple(formula.get('args', ())),
                    'expr': expr,
                }
            else:
                normalized[name] = self._normalize_text(formula)

        return normalized

    def _base_context(self):
        return {
            'Sum': sp.Sum,
            'Product': sp.Product,
            'Matrix': sp.Matrix,
            'Piecewise': sp.Piecewise,
            'sin': sp.sin,
            'cos': sp.cos,
            'tan': sp.tan,
            'sqrt': sp.sqrt,
            'exp': sp.exp,
            'log': sp.log,
        }

    def _all_formula_text(self):
        # словарь формул -> общий текст для поиска переменных
        texts = []

        for formula in self.formulas.values():
            if isinstance(formula, dict):
                texts.append(formula['expr'])
                texts.extend(formula.get('args', []))
            else:
                texts.append(formula)

        return '\n'.join(texts)

    def _make_context(self):
        context = self._base_context()
        text = self._all_formula_text()

        # X[1] -> индексированная переменная X
        indexed_names = set(re.findall(r'\b([A-Za-z_]\w*)\s*\[', text))

        for name in indexed_names:
            context[name] = sp.IndexedBase(name)

        # P(x) -> функция P, k -> символ k
        for name, formula in self.formulas.items():
            if isinstance(formula, dict):
                context[name] = sp.Function(name)
            else:
                context[name] = sp.Symbol(name)

        # x1 -> символ x1
        tokens = set(re.findall(r'\b[A-Za-z_]\w*\b', text))

        for token in tokens:
            if token in context or token in {'True', 'False'}:
                continue

            context[token] = sp.Symbol(token, integer=token in {'i', 'j', 'k', 'n'})

        return context

    def to_sympy(self, expr):
        # строка или SymPy-объект -> SymPy-выражение
        if isinstance(expr, sp.Basic):
            return expr

        # X[1] -> IndexedBase('X')[1]
        match = re.fullmatch(r'([A-Za-z_]\w*)\[(\d+)\]', expr)
        if match:
            base_name, index_str = match.groups()
            if base_name in self.context and isinstance(self.context[base_name], sp.IndexedBase):
                return self.context[base_name][int(index_str)]
            base = sp.IndexedBase(base_name)
            return base[int(index_str)]

        return sp.sympify(expr, locals=self.context)

    def get_variables(self, expr):
        # выражение -> список свободных переменных
        expr = self.to_sympy(expr)

        indexed = expr.atoms(sp.Indexed)
        bases = set()

        for item in indexed:
            bases.add(item.base)
            bases.add(item.base.label)

        symbols = expr.free_symbols - bases

        return sorted(symbols | indexed, key=lambda s: str(s))

    def expand_formula(self, expr, stack=None):
        # имя формулы или вызов функции -> раскрытое выражение
        if stack is None:
            stack = set()

        expr = self.to_sympy(expr)

        for name, formula in self.formulas.items():
            if isinstance(formula, dict):
                continue

            symbol = self.context[name]

            if not expr.has(symbol):
                continue

            if name in stack:
                raise ValueError(f'Циклическая ссылка: {name}')

            stack.add(name)
            expanded = self.expand_formula(formula, stack)
            stack.remove(name)

            expr = expr.subs(symbol, expanded)

        for func_call in expr.atoms(sp.Function):
            name = func_call.func.__name__

            if name not in self.formulas:
                continue

            formula = self.formulas[name]

            if not isinstance(formula, dict):
                continue

            if name in stack:
                raise ValueError(f'Циклическая ссылка: {name}')

            args = [self.context[arg] for arg in formula['args']]
            body = self.to_sympy(formula['expr'])
            body = body.subs(dict(zip(args, func_call.args)))

            stack.add(name)
            expanded = self.expand_formula(body, stack)
            stack.remove(name)

            expr = expr.subs(func_call, expanded)

        return expr

    def build(self, expr, max_steps=7, values=None):
        # выражение + значения -> раскрытое выражение, LaTeX и переменные
        result = self.to_sympy(expr)
        sympy_values = self._make_sympy_values(values or {})

        for _ in range(max_steps):
            old = result

            result = self.expand_formula(result)
            if sympy_values:
                result = result.subs(sympy_values)
            result = result.doit()
            result = sp.simplify(result)

            if result == old:
                break

        return {
            'expanded': result,
            'latex': sp.latex(result),
            'variables': self.get_variables(result),
        }

    def _make_sympy_values(self, values):
        # {'x1': 2} -> {Symbol('x1'): 2}
        return {
            self.to_sympy(name): value
            for name, value in values.items()
        }

    def compute(self, expr, values):
        # выражение + значения -> численный результат
        built = self.build(expr, values=values)
        expanded = built['expanded']

        sympy_values = self._make_sympy_values(values)
        missing = set(self.get_variables(expanded)) - sympy_values.keys()

        if missing:
            names = ', '.join(map(str, sorted(missing, key=str)))
            raise ValueError(f'Нет значений для: {names}')

        return expanded.subs(sympy_values).evalf()

    def process(self, expr, values=None):
        # выражение -> полный результат для старых вызовов
        result = self.build(expr)

        if values is not None:
            result['result'] = self.compute(expr, values)

        return result
