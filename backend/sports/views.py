from rest_framework import viewsets, permissions
from .models import Sport
from .serializers import SportSerializer

class IsSupervisor(permissions.BasePermission):
    def has_permission(self, request, view):
        if view.action in ['create', 'update', 'partial_update', 'destroy']:
            return request.user.is_authenticated and (request.user.role == 'supervisor' or request.user.is_superuser)
        return True

class SportViewSet(viewsets.ModelViewSet):
    queryset = Sport.objects.all()
    serializer_class = SportSerializer
    permission_classes = [permissions.IsAuthenticated, IsSupervisor]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
