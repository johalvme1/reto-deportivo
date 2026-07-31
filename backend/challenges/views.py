from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from django.utils import timezone
from .models import Challenge, ChallengeSubmission, Medal
from .serializers import ChallengeSerializer, ChallengeSubmissionSerializer, MedalSerializer

class IsSupervisor(permissions.BasePermission):
    def has_permission(self, request, view):
        action = getattr(view, 'action', None)
        if action is None or action in ['create', 'update', 'partial_update', 'destroy']:
            return request.user.is_authenticated and (request.user.role == 'supervisor' or request.user.is_superuser)
        return request.user.is_authenticated

class ChallengeViewSet(viewsets.ModelViewSet):
    queryset = Challenge.objects.all()
    serializer_class = ChallengeSerializer
    permission_classes = [permissions.IsAuthenticated, IsSupervisor]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        active = self.request.query_params.get('active')
        if active == 'true':
            qs = qs.filter(active=True)
        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class SubmitEvidenceView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, challenge_id):
        try:
            challenge = Challenge.objects.get(id=challenge_id, active=True)
        except Challenge.DoesNotExist:
            return Response({'error': 'Reto no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        if not challenge.active:
            return Response({'error': 'Este reto no está activo'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if challenge.start_date and now < challenge.start_date:
            return Response({'error': 'Este reto aún no ha iniciado'}, status=status.HTTP_400_BAD_REQUEST)
        if challenge.end_date and now > challenge.end_date:
            return Response({'error': 'Este reto ya terminó, no se pueden enviar evidencias'}, status=status.HTTP_400_BAD_REQUEST)

        image = request.FILES.get('image')
        video = request.FILES.get('video')

        if not image and not video:
            return Response({'error': 'Debes subir una foto o un video como evidencia'}, status=status.HTTP_400_BAD_REQUEST)

        existing = ChallengeSubmission.objects.filter(challenge=challenge, user=request.user).first()
        if existing and existing.status == 'pending':
            return Response({'error': 'Ya tienes una evidencia pendiente de revisión para este reto'}, status=status.HTTP_400_BAD_REQUEST)
        if existing and existing.status == 'approved':
            return Response({'error': 'Ya completaste este reto'}, status=status.HTTP_400_BAD_REQUEST)

        submission = ChallengeSubmission.objects.create(
            challenge=challenge,
            user=request.user,
            image=image,
            video=video,
        )
        return Response(ChallengeSubmissionSerializer(submission).data, status=status.HTTP_201_CREATED)

class ReviewSubmissionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSupervisor]

    def patch(self, request, submission_id):
        try:
            submission = ChallengeSubmission.objects.get(id=submission_id)
        except ChallengeSubmission.DoesNotExist:
            return Response({'error': 'Evidencia no encontrada'}, status=status.HTTP_404_NOT_FOUND)

        decision = request.data.get('status')
        if decision not in ['approved', 'rejected']:
            return Response({'error': 'Acción inválida'}, status=status.HTTP_400_BAD_REQUEST)

        if submission.status == 'approved' and decision == 'approved':
            return Response({'error': 'Esta evidencia ya fue aprobada'}, status=status.HTTP_400_BAD_REQUEST)

        submission.status = decision
        submission.save()

        if decision == 'approved':
            Medal.objects.get_or_create(user=submission.user, challenge=submission.challenge)

        return Response(ChallengeSubmissionSerializer(submission).data)

class MedalsView(APIView):
    def get(self, request):
        medals = Medal.objects.select_related('user', 'challenge')
        if request.query_params.get('mine') == 'true':
            medals = medals.filter(user=request.user)
        return Response(MedalSerializer(medals, many=True).data)

class EvidenceGalleryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        subs = (
            ChallengeSubmission.objects.filter(status='approved')
            .exclude(user__is_superuser=True)
            .select_related('user', 'challenge')
            .order_by('-created_at')[:60]
        )
        return Response(ChallengeSubmissionSerializer(subs, many=True).data)

class ChallengeSubmissionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, challenge_id):
        try:
            challenge = Challenge.objects.get(id=challenge_id)
        except Challenge.DoesNotExist:
            return Response({'error': 'Reto no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        is_supervisor = request.user.role == 'supervisor' or request.user.is_superuser

        if not is_supervisor and not challenge.submissions.filter(user=request.user).exists():
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        subs = challenge.submissions.select_related('user')
        if not is_supervisor:
            subs = subs.filter(user=request.user)

        status_filter = request.query_params.get('status')
        if status_filter:
            subs = subs.filter(status=status_filter)

        return Response(ChallengeSubmissionSerializer(subs, many=True).data)

class MySubmissionsView(APIView):
    def get(self, request):
        subs = ChallengeSubmission.objects.filter(user=request.user).select_related('challenge')
        return Response(ChallengeSubmissionSerializer(subs, many=True).data)
