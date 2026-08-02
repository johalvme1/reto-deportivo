from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Q
from django.contrib.auth import get_user_model
from .models import Challenge, ChallengeSubmission, Medal, ChallengeCompletion
from .serializers import ChallengeSerializer, ChallengeSubmissionSerializer, MedalSerializer
from points.models import DailyPoint

User = get_user_model()

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
            challenge = Challenge.objects.get(id=challenge_id)
        except Challenge.DoesNotExist:
            return Response({'error': 'Reto no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()

        if not challenge.effective_active(now):
            return Response({'error': 'Este reto no está activo'}, status=status.HTTP_400_BAD_REQUEST)

        if challenge.start_date and now < challenge.start_date:
            return Response({'error': 'Este reto aún no ha iniciado'}, status=status.HTTP_400_BAD_REQUEST)
        if challenge.end_date and now > challenge.end_date:
            return Response({'error': 'Este reto ya terminó, no se pueden enviar evidencias'}, status=status.HTTP_400_BAD_REQUEST)

        image = request.FILES.get('image')
        video = request.FILES.get('video')

        if not image and not video:
            return Response({'error': 'Debes subir una foto o un video como evidencia'}, status=status.HTTP_400_BAD_REQUEST)

        MAX_SUBMISSIONS = 3
        active_count = ChallengeSubmission.objects.filter(challenge=challenge, user=request.user).exclude(status='rejected').count()
        if active_count >= MAX_SUBMISSIONS:
            return Response({'error': f'Ya subiste las {MAX_SUBMISSIONS} evidencias permitidas para este reto'}, status=status.HTTP_400_BAD_REQUEST)

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

        comment = request.data.get('comment')
        if comment is not None:
            submission.review_comment = str(comment).strip()
        submission.reviewed_at = timezone.now()

        if decision == 'approved':
            already_approved = submission.challenge.submissions.filter(
                user=submission.user, status='approved'
            ).exclude(id=submission.id).exists()
            if already_approved:
                return Response(
                    {'error': 'Este participante ya tiene una evidencia aprobada para este reto'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            submission.points_awarded = submission.challenge.points
            submission.status = 'approved'
            Medal.objects.get_or_create(user=submission.user, challenge=submission.challenge)
        else:
            submission.status = 'rejected'
            submission.points_awarded = 0
            has_other_approved = submission.challenge.submissions.filter(
                user=submission.user, status='approved'
            ).exclude(id=submission.id).exists()
            if not has_other_approved:
                Medal.objects.filter(user=submission.user, challenge=submission.challenge).delete()

        submission.save()

        return Response(ChallengeSubmissionSerializer(submission).data)

class ApproveUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSupervisor]

    def post(self, request, challenge_id):
        user_id = request.data.get('user_id')
        try:
            challenge = Challenge.objects.get(id=challenge_id)
            target = User.objects.get(id=user_id)
        except (Challenge.DoesNotExist, User.DoesNotExist):
            return Response({'error': 'No encontrado'}, status=status.HTTP_404_NOT_FOUND)

        if challenge.submissions.filter(user=target, status='approved').exists():
            return Response({'error': 'Este participante ya completó el reto'}, status=status.HTTP_400_BAD_REQUEST)

        pending = challenge.submissions.filter(user=target, status='pending').order_by('created_at')
        if not pending.exists():
            return Response({'error': 'No hay evidencias pendientes de este participante'}, status=status.HTTP_400_BAD_REQUEST)

        first = pending.first()
        first.status = 'approved'
        first.points_awarded = challenge.points
        first.reviewed_at = timezone.now()
        first.save()
        Medal.objects.get_or_create(user=target, challenge=challenge)
        ChallengeCompletion.objects.filter(user=target, challenge=challenge, status='requested').update(status='approved')

        for s in pending.exclude(id=first.id):
            s.status = 'rejected'
            s.points_awarded = 0
            s.review_comment = 'Reto completado con otra evidencia'
            s.reviewed_at = timezone.now()
            s.save()

        return Response({'ok': True, 'awarded': challenge.points})

class CompleteChallengeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, challenge_id):
        try:
            challenge = Challenge.objects.get(id=challenge_id)
        except Challenge.DoesNotExist:
            return Response({'error': 'Reto no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        if challenge.submissions.filter(user=request.user, status='approved').exists():
            return Response({'error': 'Ya completaste este reto'}, status=status.HTTP_400_BAD_REQUEST)

        has_evidence = challenge.submissions.filter(user=request.user).exclude(status='rejected').exists()
        if not has_evidence:
            return Response({'error': 'Envía al menos una evidencia antes de marcar tu reto como completado'}, status=status.HTTP_400_BAD_REQUEST)

        message = request.data.get('message', '')
        completion, _ = ChallengeCompletion.objects.get_or_create(user=request.user, challenge=challenge)
        completion.message = str(message).strip()
        completion.status = 'requested'
        completion.save()

        return Response({'ok': True})

class PendingCompletionsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSupervisor]

    def get(self, request):
        completions = (
            ChallengeCompletion.objects
            .filter(status='requested')
            .select_related('user', 'challenge')
            .order_by('-requested_at')
        )
        return Response([{
            'user': c.user_id,
            'user_name': c.user.name or c.user.username,
            'challenge': c.challenge_id,
            'challenge_title': c.challenge.title,
            'message': c.message,
            'requested_at': c.requested_at.isoformat(),
        } for c in completions])

class DeleteSubmissionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSupervisor]

    def delete(self, request, submission_id):
        try:
            submission = ChallengeSubmission.objects.get(id=submission_id)
        except ChallengeSubmission.DoesNotExist:
            return Response({'error': 'Evidencia no encontrada'}, status=status.HTTP_404_NOT_FOUND)

        if submission.status == 'approved':
            has_other_approved = submission.challenge.submissions.filter(
                user=submission.user, status='approved'
            ).exclude(id=submission.id).exists()
            if not has_other_approved:
                Medal.objects.filter(user=submission.user, challenge=submission.challenge).delete()

        submission.delete()
        return Response({'detail': 'Evidencia eliminada'}, status=status.HTTP_200_OK)

class MedalsView(APIView):
    def get(self, request):
        medals = Medal.objects.select_related('user', 'challenge')
        if request.query_params.get('mine') == 'true':
            medals = medals.filter(user=request.user)
        return Response(MedalSerializer(medals, many=True).data)

class EvidenceGalleryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import datetime, time as dtime

        items = []

        subs = (
            ChallengeSubmission.objects
            .exclude(user__is_superuser=True)
            .select_related('user', 'challenge')
            .order_by('-created_at')[:300]
        )
        for s in subs:
            items.append({
                'id': f'c{s.id}',
                'kind': 'challenge',
                'user_id': s.user_id,
                'user_name': s.user.name or s.user.username,
                'title': s.challenge.title,
                'status': s.status,
                'points': (s.points_awarded or s.challenge.points) if s.status == 'approved' else 0,
                'image': s.image.url if s.image else None,
                'video': s.video.url if s.video else None,
                'date': s.created_at.strftime('%Y-%m-%d'),
                'sort_key': s.created_at.timestamp(),
            })

        dps = (
            DailyPoint.objects
            .exclude(user__is_superuser=True)
            .filter(Q(image__isnull=False) & ~Q(image='') | Q(video__isnull=False) & ~Q(video='') | Q(steps_image__isnull=False) & ~Q(steps_image=''))
            .select_related('user')
            .order_by('-date')[:300]
        )
        for d in dps:
            sort_key = datetime.combine(d.date, dtime.min).timestamp()
            user_name = d.user.name or d.user.username
            if d.image:
                items.append({
                    'id': f'd{d.id}-img',
                    'kind': 'daily',
                    'user_id': d.user_id,
                    'user_name': user_name,
                    'title': 'Evidencia diaria',
                    'status': 'approved',
                    'points': 1,
                    'image': d.image.url,
                    'video': None,
                    'date': d.date.isoformat(),
                    'sort_key': sort_key,
                })
            if d.video:
                items.append({
                    'id': f'd{d.id}-vid',
                    'kind': 'daily',
                    'user_id': d.user_id,
                    'user_name': user_name,
                    'title': 'Evidencia diaria',
                    'status': 'approved',
                    'points': 1,
                    'image': None,
                    'video': d.video.url,
                    'date': d.date.isoformat(),
                    'sort_key': sort_key,
                })
            if d.steps_image:
                items.append({
                    'id': f'd{d.id}-steps',
                    'kind': 'daily',
                    'user_id': d.user_id,
                    'user_name': user_name,
                    'title': 'Evidencia de pasos',
                    'status': 'approved',
                    'points': 1,
                    'image': d.steps_image.url,
                    'video': None,
                    'date': d.date.isoformat(),
                    'sort_key': sort_key,
                })

        items.sort(key=lambda e: e['sort_key'], reverse=True)
        return Response(items)

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

        completions = ChallengeCompletion.objects.filter(
            challenge=challenge, status='requested'
        ).select_related('user')
        return Response({
            'submissions': ChallengeSubmissionSerializer(subs, many=True).data,
            'completions': [{
                'user': c.user_id,
                'user_name': c.user.name or c.user.username,
                'message': c.message,
                'requested_at': c.requested_at.isoformat(),
            } for c in completions],
        })

class MySubmissionsView(APIView):
    def get(self, request):
        subs = ChallengeSubmission.objects.filter(user=request.user).select_related('challenge')
        return Response(ChallengeSubmissionSerializer(subs, many=True).data)
