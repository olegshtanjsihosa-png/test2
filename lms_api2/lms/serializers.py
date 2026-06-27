from django.contrib.auth import get_user_model
from rest_framework import serializers

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
    Result
)


class ModuleSerializer(serializers.ModelSerializer):

    class Meta:
        model = Module
        fields = "__all__"


class LaboratoryWorkSerializer(serializers.ModelSerializer):

    class Meta:
        model = LaboratoryWork
        fields = "__all__"


class LabElementSerializer(serializers.ModelSerializer):

    class Meta:
        model = LabElement
        fields = "__all__"


class ElementTypeSerializer(serializers.ModelSerializer):

    class Meta:
        model = ElementType
        fields = "__all__"


class ElementTypeBindingSerializer(serializers.ModelSerializer):

    class Meta:
        model = ElementTypeBinding
        fields = "__all__"


class CharacteristicSerializer(serializers.ModelSerializer):

    class Meta:
        model = Characteristic
        fields = "__all__"


class CharacteristicValueSerializer(serializers.ModelSerializer):

    class Meta:
        model = CharacteristicValue
        fields = "__all__"


class CharacteristicValueNestedSerializer(serializers.ModelSerializer):

    characteristic = CharacteristicSerializer(read_only=True)

    class Meta:
        model = CharacteristicValue

        fields = [
            "id",
            "characteristic",
            "order",
            "value",
        ]


class ElementTypeBindingNestedSerializer(serializers.ModelSerializer):

    element_type = ElementTypeSerializer(read_only=True)

    characteristic_values = CharacteristicValueNestedSerializer(
        many=True,
        read_only=True
    )

    lab_element_title = serializers.CharField(
        source="lab_element.title",
        read_only=True
    )

    laboratory_work_title = serializers.CharField(
        source="lab_element.laboratory_work.title",
        read_only=True
    )

    result_id = serializers.SerializerMethodField()
    result_is_passed = serializers.SerializerMethodField()

    class Meta:
        model = ElementTypeBinding

        fields = [
            "id",
            "element_type",
            "lab_element_title",
            "laboratory_work_title",
            "characteristic_values",
            "result_id",
            "result_is_passed",
        ]

    def get_result_id(self, obj):

        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            return None

        result = Result.objects.filter(
            student=request.user,
            element_type_binding=obj
        ).first()

        if not result:
            return None

        return result.id

    def get_result_is_passed(self, obj):

        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            return False

        result = Result.objects.filter(
            student=request.user,
            element_type_binding=obj
        ).first()

        if not result:
            return False

        return result.is_passed


class LabElementWithBindingsSerializer(serializers.ModelSerializer):

    type_bindings = ElementTypeBindingNestedSerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = LabElement

        fields = [
            "id",
            "title",
            "position",
            "type_bindings",
        ]


class LaboratoryWorkDetailSerializer(serializers.ModelSerializer):

    module = ModuleSerializer(read_only=True)

    elements = LabElementWithBindingsSerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = LaboratoryWork

        fields = [
            "id",
            "module",
            "title",
            "position",
            "elements",
        ]


class StepSerializer(serializers.ModelSerializer):

    class Meta:
        model = Step

        fields = [
            "id",
            "step_order",
            "title",
            "description",
            "instructions",
            "summary",
            "element_type_binding",
        ]


class TestTypeSerializer(serializers.ModelSerializer):

    class Meta:
        model = TestType
        fields = "__all__"


class TestSerializer(serializers.ModelSerializer):

    class Meta:
        model = Test
        fields = "__all__"


class AnswerSerializer(serializers.ModelSerializer):

    class Meta:
        model = Answer
        fields = "__all__"


class UserSerializer(serializers.ModelSerializer):

    class Meta:
        model = get_user_model()

        fields = [
            "id",
            "username",
            "email"
        ]


class ResultSerializer(serializers.ModelSerializer):

    student = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.all(),
        default=serializers.CurrentUserDefault()
    )

    student_data = UserSerializer(
        source="student",
        read_only=True
    )

    element_type_binding_data = ElementTypeBindingNestedSerializer(
        source="element_type_binding",
        read_only=True
    )

    class Meta:
        model = Result

        fields = [
            "id",
            "student",
            "student_data",
            "element_type_binding",
            "element_type_binding_data",
            "is_passed",
        ]

        read_only_fields = [
            "student_data",
            "element_type_binding_data"
        ]
