from django.contrib import admin

from .models import (
    Module,
    LaboratoryWork,
    LabElement,
    ElementType,
    ElementTypeBinding,
    Characteristic,
    CharacteristicValue,
    Step,
    TestType,
    Test,
    Answer,
    Result,
)


class CharacteristicValueInline(admin.TabularInline):
    model = CharacteristicValue
    extra = 0
    fields = ('characteristic', 'order', 'value')
    show_change_link = True


class StepInline(admin.TabularInline):
    model = Step
    extra = 0
    fields = ('step_order', 'title', 'description', 'summary')
    ordering = ('step_order',)
    show_change_link = True


class ElementTypeBindingAdmin(admin.ModelAdmin):
    list_display = ('id', 'lab_element', 'element_type')
    list_filter = ('element_type', 'lab_element__laboratory_work')
    search_fields = (
        'lab_element__title',
        'lab_element__laboratory_work__title',
        'element_type__name',
    )
    inlines = [CharacteristicValueInline, StepInline]


class LabElementInline(admin.TabularInline):
    model = LabElement
    extra = 0
    fields = ('title', 'position')
    ordering = ('position',)
    show_change_link = True


class LaboratoryWorkAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'module', 'position')
    list_filter = ('module',)
    search_fields = ('title', 'module__title')
    ordering = ('position',)
    inlines = [LabElementInline]


class ElementTypeInline(admin.TabularInline):
    model = ElementTypeBinding
    extra = 0
    fields = ('element_type',)
    show_change_link = True


class LabElementAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'laboratory_work', 'position')
    list_filter = ('laboratory_work',)
    search_fields = ('title', 'laboratory_work__title')
    ordering = ('position',)
    inlines = [ElementTypeInline]


class CharacteristicValueAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'element_type_binding',
        'characteristic',
        'order',
        'value',
    )
    list_filter = ('characteristic', 'element_type_binding__element_type')
    search_fields = (
        'value',
        'characteristic__name',
        'element_type_binding__lab_element__title',
    )


class CharacteristicAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)


class ElementTypeAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)


class ResultAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'element_type_binding', 'is_passed')
    list_filter = ('is_passed',)
    search_fields = ('student__username', 'element_type_binding__lab_element__title')


class StepAdmin(admin.ModelAdmin):
    list_display = ('id', 'step_order', 'title', 'element_type_binding')
    list_filter = ('element_type_binding__element_type',)
    search_fields = ('title', 'description', 'summary', 'element_type_binding__lab_element__title')
    ordering = ('step_order',)


class TestAdmin(admin.ModelAdmin):
    list_display = ('id', 'sort_order', 'step', 'test_type')
    list_filter = ('test_type', 'step__element_type_binding__element_type')
    search_fields = ('question', 'step__title')
    ordering = ('sort_order',)


class AnswerAdmin(admin.ModelAdmin):
    list_display = ('id', 'test', 'answer_text', 'is_correct')
    list_filter = ('is_correct', 'test__test_type')
    search_fields = ('answer_text', 'test__question')


admin.site.register(Module)
admin.site.register(LaboratoryWork, LaboratoryWorkAdmin)
admin.site.register(LabElement, LabElementAdmin)
admin.site.register(ElementType, ElementTypeAdmin)
admin.site.register(ElementTypeBinding, ElementTypeBindingAdmin)
admin.site.register(Characteristic, CharacteristicAdmin)
admin.site.register(CharacteristicValue, CharacteristicValueAdmin)
admin.site.register(Step, StepAdmin)
admin.site.register(TestType)
admin.site.register(Test, TestAdmin)
admin.site.register(Answer, AnswerAdmin)
admin.site.register(Result, ResultAdmin)
