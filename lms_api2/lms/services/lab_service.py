from typing import Any, Dict

from lms.models import ElementTypeBinding, LabElement, Step
from lms.services.lab_data import LabDataMixin
from lms.services.lab_graph import LabGraphMixin
from lms.services.lab_summary import LabSummaryMixin
from lms.services.lab_task import LabTaskMixin
from lms.services.lab_training import LabTrainingMixin
from lms.utils.interpolation_calculator import FormulaEngine


class LabService(
    LabDataMixin,
    LabGraphMixin,
    LabSummaryMixin,
    LabTrainingMixin,
    LabTaskMixin,
):
    def __init__(self):
        self.formula_engine = None
        self.points_count = 3

    def get_element_with_data(self, element_id: int) -> Dict[str, Any]:
        # element_id -> обучающий элемент со значениями, шагами, формулами и графиком
        try:
            element = LabElement.objects.get(id=element_id)
        except LabElement.DoesNotExist:
            return {'success': False, 'message': 'элемент не найден'}

        bindings = ElementTypeBinding.objects.filter(lab_element_id=element_id)
        # характеристики из БД -> формулы движка и число рабочих точек
        formulas_text = self._binding_values(bindings, 'formula')
        points_count = self._points_count(bindings) or self.points_count

        formulas = self._formula_engine_formulas(formulas_text)
        self.formula_engine = FormulaEngine(formulas) if formulas else None

        # число точек -> один набор x/y для всех шагов текущей выдачи
        values = self._generate_values(points_count)
        steps = Step.objects.filter(
            element_type_binding__lab_element_id=element_id,
            element_type_binding__element_type__name='training',
        ).order_by('step_order')

        steps_data = []
        for step in steps:
            # шаг из БД + значения -> готовый шаг для фронта
            step_data = self._process_step(step, values)
            self._attach_step_summary(step_data, values)
            steps_data.append(step_data)

        element_type = bindings.first().element_type.name if bindings.exists() else None

        # элемент + шаги -> один ответ страницы лаборатории
        return {
            'success': True,
            'element': {
                'id': element.id,
                'title': element.title,
                'type': element_type,
                'laboratory_work_id': element.laboratory_work_id,
            },
            'generated_variables': values,
            'functions': self._functions_payload(),
            'steps': steps_data,
        }

    def get_training_element_with_data(self, lab_id: int) -> Dict[str, Any]:
        # lab_id -> первое обучающее задание лабораторной
        binding = self._first_binding(lab_id, 'training')
        if not binding:
            return {'success': False, 'message': 'обучающее задание не найдено'}

        data = self.get_element_with_data(binding.lab_element_id)
        data['element_type_binding_id'] = binding.id
        return data
