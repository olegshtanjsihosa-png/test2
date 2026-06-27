from typing import Any, Dict

import re


class LabSummaryMixin:
    def _attach_step_summary(self, step_data: Dict[str, Any], values: Dict[str, Any]) -> None:
        # summary шага + значения -> блок "уже найдено"
        summary_source = str(step_data.pop('_summary_source', '') or '')
        if not self.formula_engine:
            return

        items = []
        seen = set()

        if summary_source.strip():
            for line in re.split(r'[\n;]+', summary_source):
                name = line.strip()
                if not name or name in seen:
                    continue

                value = self._summary_value(name, values)
                if value is None:
                    continue

                seen.add(name)
                items.append({'label': self._summary_label(name), 'value': str(self._format_number(value))})

            if items:
                step_data['summary'] = items
            return

        for test in step_data.get('tests', []):
            question = str(test.get('question', ''))
            target = question.split('=', 1)[0].strip() if '=' in question else ''
            placeholders = re.findall(r'\{([^}]+)\}', question)
            tail = question.rsplit('=', 1)[-1].strip() if '=' in question else ''

            if placeholders and re.fullmatch(r'\{\s*' + re.escape(placeholders[-1]) + r'\s*\}', tail):
                placeholders = placeholders[:-1]

            for placeholder in placeholders:
                name = placeholder.strip()
                label = self._summary_label(name)

                if not self._is_summary_dependency(name):
                    continue
                if label == self._summary_label(target) or name in seen:
                    continue

                try:
                    value = self._summary_value(name, values)
                except Exception:
                    value = None
                if value is None:
                    continue

                seen.add(name)
                items.append({'label': label, 'value': str(self._format_number(value))})

        if items:
            step_data['summary'] = items

    def _summary_value(self, name: str, values: Dict[str, Any]):
        # имя формулы или переменной -> значение для summary
        try:
            return self.formula_engine.compute(name, values)
        except Exception:
            return values.get(name)

    def _is_summary_dependency(self, name: str) -> bool:
        # имя из placeholder -> можно ли показывать его как найденное ранее
        if re.match(r'^[A-Za-z_][A-Za-z0-9_]*\([^)]*\)$', name):
            return True
        return bool(re.match(r'^(?:k|h\d+|d\d+|M\d+|B\d+|C\d+|D\d+)$', name))

    def _summary_label(self, name: str) -> str:
        # внутреннее имя -> подпись, понятная студенту
        labels = {
            'f2(x0,x1)': 'f[x0,x1]',
            'f2_2(x1,x2)': 'f[x1,x2]',
            'f3(x0,x1,x2)': 'f[x0,x1,x2]',
        }
        return labels.get(name, name.replace('P2', 'P_2') if name.startswith('P2(') else name)
