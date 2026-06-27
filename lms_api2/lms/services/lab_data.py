from typing import Any, Dict, List

import random
import re

from lms.models import CharacteristicValue, ElementTypeBinding


class LabDataMixin:
    def _first_binding(self, lab_id: int, element_type: str):
        # lab_id + тип элемента -> первая подходящая связка из БД
        return ElementTypeBinding.objects.filter(
            lab_element__laboratory_work_id=lab_id,
            element_type__name=element_type,
        ).select_related('lab_element').first()

    def _binding_values(self, bindings, characteristic_name: str) -> List[str]:
        # связки + имя характеристики -> значения в порядке показа
        return list(
            CharacteristicValue.objects.filter(
                element_type_binding__in=bindings,
                characteristic__name=characteristic_name,
            )
            .order_by('order', 'id')
            .values_list('value', flat=True)
        )

    def _binding_characteristic_values(self, binding: ElementTypeBinding, characteristic_name: str):
        # связка + имя характеристики -> строки характеристик с порядком и id
        return list(
            CharacteristicValue.objects.filter(
                element_type_binding=binding,
                characteristic__name=characteristic_name,
            ).order_by('order', 'id')
        )

    def _binding_values_by_order(self, binding: ElementTypeBinding, characteristic_name: str) -> Dict[int, str]:
        # значения характеристики -> словарь order -> value
        return {
            item.order: item.value
            for item in self._binding_characteristic_values(binding, characteristic_name)
        }

    def _points_count(self, bindings):
        # характеристика points_count -> безопасное число точек
        value = (
            CharacteristicValue.objects.filter(
                element_type_binding__in=bindings,
                characteristic__name='points_count',
            )
            .order_by('order', 'id')
            .values_list('value', flat=True)
            .first()
        )
        return max(2, int(value)) if value else None

    def _formula_engine_formulas(self, formulas_text: List[str]) -> Dict[str, Any]:
        # строки вида name=expr и f(x)=expr -> словарь для FormulaEngine
        formulas = {}
        for formula in formulas_text:
            if '=' not in formula:
                continue

            left, right = formula.split('=', 1)
            left = left.strip()
            right = right.strip()
            match = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\)$', left)

            if match:
                formulas[match.group(1)] = {
                    'args': tuple(arg.strip() for arg in match.group(2).split(',') if arg.strip()),
                    'expr': right,
                }
            else:
                formulas[left] = right

        return formulas

    def _functions_payload(self):
        # формулы движка -> список функций для фронта
        if not self.formula_engine:
            return None

        payload = []
        for name, formula in self.formula_engine.formulas.items():
            if isinstance(formula, dict):
                payload.append({
                    'name': name,
                    'args': list(formula.get('args', [])),
                    'body': formula.get('expr', ''),
                })
            else:
                payload.append({'name': name, 'args': [], 'body': formula})
        return payload

    def _generate_values(self, points_count: int) -> Dict[str, Any]:
        # points_count -> случайные узлы x/y без слишком близких x
        x_values = sorted(random.sample(range(1, 21), points_count))
        while any((x_values[index] - x_values[index - 1]) < 3 for index in range(1, points_count)):
            x_values = sorted(random.sample(range(1, 21), points_count))

        y_values = random.sample(range(1, 21), points_count)
        values = {'points_count': points_count, 'n': points_count - 1}

        for index, value in enumerate(x_values):
            # x0 -> X[0]
            values[f'x{index}'] = value
            values[f'X[{index}]'] = value
        for index, value in enumerate(y_values):
            # y0 -> Y[0]
            values[f'y{index}'] = value
            values[f'Y[{index}]'] = value

        return values
