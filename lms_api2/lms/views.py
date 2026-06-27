from django.contrib.auth import authenticate, get_user_model, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import LaboratoryWork, Module, ElementTypeBinding, LabElement, Result
from .serializers import (
    ModuleSerializer,
    LaboratoryWorkSerializer,
    LaboratoryWorkDetailSerializer,
    LabElementSerializer,
    ElementTypeBindingNestedSerializer,
    UserSerializer,
    ResultSerializer,
)
from .services.lab_service import LabService
import re


class ModuleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Module.objects.all().order_by('id')
    serializer_class = ModuleSerializer

    @action(detail=True, methods=['get'], url_path='laboratory-works', name='лабораторные работы')
    def laboratory_works(self, request, pk=None):
        module = self.get_object()
        serializer = LaboratoryWorkSerializer(module.laboratory_works.all(), many=True)
        return Response(serializer.data)


class LaboratoryWorkViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LaboratoryWork.objects.all()
    serializer_class = LaboratoryWorkSerializer

    def get_serializer_class(self):
        if self.action in ('retrieve', 'characteristics', 'theory', 'training', 'task', 'with_data'):
            return LaboratoryWorkDetailSerializer
        return LaboratoryWorkSerializer

    @action(detail=True, methods=['get'], name='характеристики')
    def characteristics(self, request, pk=None):
        # лабораторная + тип элемента -> характеристики для теории/заданий
        element_type_name = request.query_params.get('type')
        lab = self.get_object()
        data = self._collect_characteristics(lab, element_type_name)
        if request.user.is_authenticated:
            data = self._attach_result_data(data)
        return Response(data)

    @action(detail=True, methods=['get'], name='теория')
    def theory(self, request, pk=None):
        lab = self.get_object()
        data = self._collect_characteristics(lab, 'theory')
        if request.user.is_authenticated:
            data = self._attach_result_data(data)
        return Response(data)

    @action(detail=True, methods=['get'], name='обучающее задание')
    def training(self, request, pk=None):
        lab = self.get_object()
        data = self._collect_characteristics(lab, 'training')
        if request.user.is_authenticated:
            data = self._attach_result_data(data)
        return Response(data)

    @action(detail=True, methods=['get'], name='самостоятельное задание')
    def task(self, request, pk=None):
        lab = self.get_object()
        data = self._collect_characteristics(lab, 'task')
        if request.user.is_authenticated:
            data = self._attach_result_data(data)
        return Response(data)

    @action(detail=True, methods=['get'], url_path='task/with_data', name='самостоятельное задание с данными')
    def task_with_data(self, request, pk=None):
        # lab_id -> самостоятельное задание с рассчитанными вопросами
        service = LabService()
        result = service.get_task_element_with_data(pk)

        if result['success'] and request.user.is_authenticated:
            binding_id = result.get('element_type_binding_id')
            if binding_id:
                user_result = Result.objects.filter(
                    student=request.user,
                    element_type_binding_id=binding_id
                ).first()
                if user_result:
                    result['result_id'] = user_result.id
                    result['result_is_passed'] = user_result.is_passed

        if result['success']:
            return Response(result)
        return Response(result, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'], url_path='with_data', name='обучающее задание с данными')
    def with_data(self, request, pk=None):
        # lab_id -> обучающее задание с рассчитанными шагами
        service = LabService()
        result = service.get_training_element_with_data(pk)

        if result['success'] and 'steps' in result:
            self._add_input_labels_to_steps(result['steps'])

        if result['success'] and request.user.is_authenticated:
            binding_id = result.get('element_type_binding_id')
            if binding_id:
                user_result = Result.objects.filter(
                    student=request.user,
                    element_type_binding_id=binding_id
                ).first()
                if user_result:
                    result['result_id'] = user_result.id
                    result['result_is_passed'] = user_result.is_passed

        if result['success']:
            return Response(result)
        return Response(result, status=status.HTTP_404_NOT_FOUND)

    def _collect_characteristics(self, lab, element_type_name=None):
        # лабораторная + тип -> сериализованные элементы этого типа
        bindings = ElementTypeBinding.objects.filter(
            lab_element__laboratory_work=lab
        ).select_related('element_type', 'lab_element')

        if element_type_name:
            bindings = bindings.filter(element_type__name=element_type_name)

        serializer = ElementTypeBindingNestedSerializer(bindings, many=True)
        data = serializer.data
        return data

    def _attach_result_data(self, data):
        # элементы лабораторной -> те же элементы со статусом текущего пользователя
        if not self.request.user.is_authenticated:
            return data

        binding_ids = [item['id'] for item in data if item.get('id')]
        if not binding_ids:
            return data

        results = Result.objects.filter(
            student=self.request.user,
            element_type_binding_id__in=binding_ids
        )
        result_map = {result.element_type_binding_id: result for result in results}

        for item in data:
            binding_id = item.get('id')
            if binding_id and binding_id in result_map:
                user_result = result_map[binding_id]
                item['result_id'] = user_result.id
                item['result_is_passed'] = user_result.is_passed
            else:
                item['result_id'] = None
                item['result_is_passed'] = False

            item = self._add_input_labels_to_tests(item)

        return data

    def _add_input_labels_to_tests(self, item):
        # вопросы с {expr} -> список подписей для input
        if 'steps' not in item:
            return item

        self._add_input_labels_to_steps(item.get('steps', []))
        return item

    def _add_input_labels_to_steps(self, steps):
        # шаги API -> input_labels для отображения полей ввода
        for step in steps:
            for test in step.get('tests', []):
                if test.get('type') == 'calculated_input':
                    question = test.get('question', '')
                    test['input_labels'] = re.findall(r'\{([^}]+)\}', question)


class LabElementViewSet(viewsets.ModelViewSet):
    queryset = LabElement.objects.all()
    serializer_class = LabElementSerializer

    @action(detail=True, methods=['get'], name='элемент с данными')
    def with_data(self, request, pk=None):
        service = LabService()
        result = service.get_element_with_data(pk)

        if result['success']:
            return Response(result)
        return Response(result, status=status.HTTP_404_NOT_FOUND)


class ResultViewSet(viewsets.ModelViewSet):
    queryset = Result.objects.all()
    serializer_class = ResultSerializer
    permission_classes = [IsAuthenticated]

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def get_queryset(self):
        # пользователь -> его результаты по порядку лабораторных
        user = self.request.user
        ordering = (
            'element_type_binding__lab_element__laboratory_work__position',
            'element_type_binding__lab_element__position',
            'element_type_binding__id',
        )
        self._ensure_results(user)
        return Result.objects.filter(student=user).order_by(*ordering)

    def _ensure_results(self, user):
        # пользователь + элементы курса -> недостающие строки статистики
        existing_binding_ids = set(
            Result.objects.filter(student=user).values_list('element_type_binding_id', flat=True)
        )
        missing_bindings = ElementTypeBinding.objects.exclude(id__in=existing_binding_ids)
        Result.objects.bulk_create(
            [
                Result(student=user, element_type_binding=binding, is_passed=False)
                for binding in missing_bindings
            ],
            ignore_conflicts=True,
        )

    def perform_create(self, serializer):
        if 'student' not in serializer.validated_data:
            serializer.save(student=self.request.user)
        else:
            serializer.save()


class RegisterView(APIView):
    name = 'регистрация'
    permission_classes = [AllowAny]
    authentication_classes = []

    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def _create_initial_results(self, user):
        # новый пользователь -> пустая статистика по всем элементам
        bindings = ElementTypeBinding.objects.all()
        results = [
            Result(student=user, element_type_binding=binding, is_passed=False)
            for binding in bindings
        ]
        Result.objects.bulk_create(results)

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email', '')

        if not username or not password:
            return Response({'detail': 'имя пользователя и пароль обязательны'}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        if User.objects.filter(username=username).exists():
            return Response({'detail': 'пользователь с таким именем уже существует'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, email=email, password=password)
        self._create_initial_results(user)
        login(request, user)
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    name = 'вход'
    permission_classes = [AllowAny]
    authentication_classes = []

    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response({'detail': 'имя пользователя и пароль обязательны'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({'detail': 'неверный логин или пароль'}, status=status.HTTP_400_BAD_REQUEST)

        login(request, user)
        serializer = UserSerializer(user)
        return Response(serializer.data)


class LogoutView(APIView):
    name = 'выход'

    def post(self, request):
        logout(request)
        return Response({'detail': 'успешный выход'})


class CurrentUserView(APIView):
    name = 'текущий пользователь'

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'is_authenticated': False})
        serializer = UserSerializer(request.user)
        data = serializer.data
        data['is_authenticated'] = True
        return Response(data)
