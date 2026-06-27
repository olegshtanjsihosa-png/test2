from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LabElementViewSet,
    ModuleViewSet,
    LaboratoryWorkViewSet,
    ResultViewSet,
    RegisterView,
    LoginView,
    LogoutView,
    CurrentUserView,
)

router = DefaultRouter()
router.register(r'modules', ModuleViewSet, basename='module')
router.register(r'laboratory-works', LaboratoryWorkViewSet, basename='laboratorywork')
router.register(r'lab-elements', LabElementViewSet, basename='labelement')
router.register(r'results', ResultViewSet, basename='result')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/user/', CurrentUserView.as_view(), name='auth-user'),
]
