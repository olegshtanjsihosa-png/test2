from django.conf import settings
from django.db import models


class Module(models.Model):
    title = models.CharField(max_length=255, verbose_name="название")

    class Meta:
        verbose_name = "модуль"
        verbose_name_plural = "модули"

    def __str__(self):
        return self.title


class LaboratoryWork(models.Model):
    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name='laboratory_works',
        verbose_name="модуль"
    )
    title = models.CharField(max_length=255, verbose_name="название")
    position = models.IntegerField(default=0, verbose_name="порядок")
    class Meta:
        verbose_name = "лабораторная работа"
        verbose_name_plural = "лабораторные работы"
        ordering = ['position']

    def __str__(self):
        return self.title


class LabElement(models.Model):
    laboratory_work = models.ForeignKey(
        LaboratoryWork,
        on_delete=models.CASCADE,
        related_name='elements',
        verbose_name="лабораторная работа"
    )
    title = models.CharField(max_length=255, blank=True, verbose_name="название")
    position = models.IntegerField(default=0, verbose_name="порядок")

    class Meta:
        verbose_name = "элемент"
        verbose_name_plural = "элементы"
        ordering = ['position']

    def __str__(self):
        return self.title or f"элемент {self.id}"


class ElementType(models.Model):
    name = models.CharField(max_length=50, unique=True, verbose_name="название")

    class Meta:
        verbose_name = "тип элемента"
        verbose_name_plural = "типы элементов"

    def __str__(self):
        return self.name


class ElementTypeBinding(models.Model):
    lab_element = models.ForeignKey(
        LabElement,
        on_delete=models.CASCADE,
        related_name='type_bindings',
        verbose_name="элемент"
    )
    element_type = models.ForeignKey(
        ElementType,
        on_delete=models.CASCADE,
        verbose_name="тип элемента"
    )

    class Meta:
        verbose_name = "связь элемента с типом"
        verbose_name_plural = "связи элементов с типами"
        unique_together = [['lab_element', 'element_type']]

    def __str__(self):
        return f"{self.lab_element} - {self.element_type}"


class Result(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='results',
        verbose_name="обучающийся"
    )
    element_type_binding = models.ForeignKey(
        ElementTypeBinding,
        on_delete=models.CASCADE,
        related_name='results',
        verbose_name="связь элемента с типом"
    )
    is_passed = models.BooleanField(default=False, verbose_name="пройдено")

    class Meta:
        verbose_name = "результат"
        verbose_name_plural = "результаты"
        unique_together = [['student', 'element_type_binding']]

    def __str__(self):
        status = "пройдено" if self.is_passed else "не пройдено"
        return f"{self.student.get_username()} - {self.element_type_binding} - {status}"


class Characteristic(models.Model):
    name = models.CharField(max_length=50, unique=True, verbose_name="название")

    class Meta:
        verbose_name = "характеристика"
        verbose_name_plural = "характеристики"

    def __str__(self):
        return self.name


class CharacteristicValue(models.Model):
    element_type_binding = models.ForeignKey(
        ElementTypeBinding,
        on_delete=models.CASCADE,
        related_name='characteristic_values',
        verbose_name="связь элемента с типом"
    )
    characteristic = models.ForeignKey(
        Characteristic,
        on_delete=models.CASCADE,
        verbose_name="характеристика"
    )

    value = models.TextField(blank=True, default="", verbose_name="значение")
    order = models.IntegerField(default=0, verbose_name="порядок")

    class Meta:
        verbose_name = "значение характеристики"
        verbose_name_plural = "значения характеристик"
        ordering = ['order']
    

    def __str__(self):
        return f"значение {self.characteristic.name}"

class Step(models.Model):

    step_order = models.IntegerField(default=0, verbose_name="порядок")
    title = models.CharField(max_length=255, verbose_name="название")
    description = models.TextField(blank=True, verbose_name="описание")
    instructions = models.TextField(blank=True, verbose_name="инструкция")
    summary = models.TextField(blank=True, default="", verbose_name="итог")
    element_type_binding = models.ForeignKey(
        ElementTypeBinding,
        on_delete=models.CASCADE,
        related_name='steps',
        verbose_name="связь элемента с типом"
    )

    class Meta:
        verbose_name = "шаг"
        verbose_name_plural = "шаги"
        ordering = ['step_order']
        unique_together = [['element_type_binding', 'step_order']]

    def __str__(self):
        return f"шаг {self.step_order}: {self.title}"
class TestType(models.Model):
    name = models.CharField(max_length=255, unique=True, verbose_name="название")

    class Meta:
        verbose_name = "тип теста"
        verbose_name_plural = "типы тестов"

    def __str__(self):
        return self.name


class Test(models.Model):

    question = models.TextField(verbose_name="вопрос")
    sort_order = models.IntegerField(default=0, verbose_name="порядок")


    step = models.ForeignKey(
        Step,
        on_delete=models.CASCADE,
        related_name='tests',
        verbose_name="шаг"
    )
    test_type = models.ForeignKey(
        TestType,
        on_delete=models.CASCADE,
        verbose_name="тип теста"
    )


    class Meta:
        verbose_name = "тест"
        verbose_name_plural = "тесты"
        ordering = ['sort_order']
        unique_together = [['step', 'sort_order']]

    def __str__(self):
        return self.question[:50]


class Answer(models.Model):
    test = models.ForeignKey(
        Test,
        on_delete=models.CASCADE,
        related_name='answers',
        verbose_name="тест"
    )
    answer_text = models.TextField(verbose_name="текст ответа")
    is_correct = models.BooleanField(default=False, verbose_name="правильный")

    class Meta:
        verbose_name = "вариант ответа"
        verbose_name_plural = "варианты ответов"

    def __str__(self):
        return self.answer_text[:10]
