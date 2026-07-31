from rest_framework import viewsets, permissions
from .models import Activity
from .serializers import ActivitySerializer

class IsSupervisorForModification(permissions.BasePermission):
    def has_permission(self, request, view):
        if view.action in ['update', 'partial_update', 'destroy']:
            return request.user.is_authenticated and (request.user.role == 'supervisor' or request.user.is_superuser)
        return request.user.is_authenticated

class ActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.select_related('sport').all()
    serializer_class = ActivitySerializer
    permission_classes = [permissions.IsAuthenticated, IsSupervisorForModification]

    def get_queryset(self):
        qs = super().get_queryset()
        sport_id = self.request.query_params.get('sport_id')
        if sport_id:
            qs = qs.filter(sport_id=sport_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
