from rest_framework import viewsets, permissions
from .models import Sport
from .serializers import SportSerializer
from accounts.permissions import is_supervisor_user

class IsSupervisor(permissions.BasePermission):
    def has_permission(self, request, view):
        if view.action in ['create', 'update', 'partial_update', 'destroy']:
            return is_supervisor_user(request.user)
        return True

class SportViewSet(viewsets.ModelViewSet):
    queryset = Sport.objects.all()
    serializer_class = SportSerializer
    permission_classes = [permissions.IsAuthenticated, IsSupervisor]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
