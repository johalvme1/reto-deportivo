from rest_framework import viewsets, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Q, Count
from django.contrib.auth import get_user_model
from datetime import timedelta
from .models import Challenge, ChallengeSubmission, Medal, ChallengeCompletion, EvidenceLike, ChallengeExpiryNotice
from .serializers import ChallengeSerializer, ChallengeSubmissionSerializer, MedalSerializer
from accounts.permissions import is_supervisor_user
from points.models import DailyPoint
from chat.models import ChatMessage
from reto_deportivo.media_stream import media_stream_url
from uploads.views import claim_pending, resolve_field

User = get_user_model()

def send_expired_challenge_notices(user):
    now = timezone.now()
    expired = Challenge.objects.filter(end_date__lt=now)
    for c in expired:
        if c.submissions.filter(user=user).exists():
            continue
        if ChallengeExpiryNotice.objects.filter(user=user, challenge=c).exists():
            continue
        ChallengeExpiryNotice.objects.create(user=user, challenge=c)
        author = c.created_by if c.created_by_id else User.objects.filter(is_superuser=True).first()
        if author:
            ChatMessage.objects.create(
                user=author,
                text=f'⚠️ El reto "{c.title}" terminó y no enviaste ninguna evidencia. Perdiste los puntos de este reto.'
            )

class IsSupervisor(permissions.BasePermission):
    def has_permission(self, request, view):
        action = getattr(view, 'action', None)
        if action is None or action in ['create', 'update', 'partial_update', 'destroy']:
            return is_supervisor_user(request.user)
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

    def list(self, request, *args, **kwargs):
        if request.user.is_authenticated and not is_supervisor_user(request.user):
            send_expired_challenge_notices(request.user)
        return super().list(request, *args, **kwargs)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        video_dest = None
        if request.data.get('video_upload_id'):
            video_dest = claim_pending(request.data.get('video_upload_id'))
            if not video_dest:
                return Response({'error': 'La subida del video no es válida'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(created_by=self.request.user)
        if video_dest:
            instance.video.name = video_dest
            instance.save(update_fields=['video'])
        serializer = self.get_serializer(instance)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_destroy(self, instance):
        raise PermissionDenied('Eliminar retos solo se permite desde el panel de administración de Django (/admin/)')

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

        if challenge.submissions.filter(user=request.user, status='approved').exists():
            return Response({'error': 'Ya completaste este reto con una evidencia aprobada'}, status=status.HTTP_400_BAD_REQUEST)

        image_raw, image_dest = resolve_field(request, 'image')
        video_raw, video_dest = resolve_field(request, 'video')

        if not (image_raw or image_dest or video_raw or video_dest):
            return Response({'error': 'Debes subir una foto o un video como evidencia'}, status=status.HTTP_400_BAD_REQUEST)

        MAX_SUBMISSIONS = 3
        active_count = ChallengeSubmission.objects.filter(challenge=challenge, user=request.user).exclude(status__in=['rejected', 'returned']).count()
        if active_count >= MAX_SUBMISSIONS:
            return Response({'error': f'Ya subiste las {MAX_SUBMISSIONS} evidencias permitidas para este reto'}, status=status.HTTP_400_BAD_REQUEST)

        submission = ChallengeSubmission(challenge=challenge, user=request.user)
        if image_raw or image_dest:
            if image_raw:
                submission.image = image_raw
            else:
                submission.image.name = image_dest
        else:
            if video_raw:
                submission.video = video_raw
            else:
                submission.video.name = video_dest
        submission.save()
        return Response(ChallengeSubmissionSerializer(submission).data, status=status.HTTP_201_CREATED)

class ReviewSubmissionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSupervisor]

    def patch(self, request, submission_id):
        try:
            submission = ChallengeSubmission.objects.get(id=submission_id)
        except ChallengeSubmission.DoesNotExist:
            return Response({'error': 'Evidencia no encontrada'}, status=status.HTTP_404_NOT_FOUND)

        decision = request.data.get('status')
        if decision not in ['approved', 'rejected', 'returned']:
            return Response({'error': 'Acción inválida'}, status=status.HTTP_400_BAD_REQUEST)

        if submission.status == 'approved' and decision == 'approved':
            return Response({'error': 'Esta evidencia ya fue aprobada'}, status=status.HTTP_400_BAD_REQUEST)

        if decision == 'returned' and submission.status not in ['pending', 'returned']:
            return Response({'error': 'Solo se pueden devolver evidencias pendientes'}, status=status.HTTP_400_BAD_REQUEST)

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
        elif decision == 'returned':
            submission.status = 'returned'
            submission.points_awarded = 0
            has_other_approved = submission.challenge.submissions.filter(
                user=submission.user, status='approved'
            ).exclude(id=submission.id).exists()
            if not has_other_approved:
                Medal.objects.filter(user=submission.user, challenge=submission.challenge).delete()
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
            s.status = 'approved'
            s.points_awarded = 0
            s.reviewed_at = timezone.now()
            s.save()

        return Response({'ok': True, 'awarded': challenge.points, 'approved': pending.count()})

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
        completion, created = ChallengeCompletion.objects.get_or_create(user=request.user, challenge=challenge)
        if completion.status != 'requested':
            ChatMessage.objects.create(
                user=request.user,
                text=f'🏅 {request.user.name or request.user.username} marcó su reto "{challenge.title}" como completado',
            )
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
        return Response(
            {'error': 'Eliminar evidencias solo se permite desde el panel de administración de Django (/admin/)'},
            status=status.HTTP_403_FORBIDDEN,
        )

class MedalsView(APIView):
    def get(self, request):
        medals = Medal.objects.select_related('user', 'challenge')
        if request.query_params.get('mine') == 'true':
            medals = medals.filter(user=request.user)
        return Response(MedalSerializer(medals, many=True).data)

class MedalSummaryView(APIView):
    def get(self, request):
        by_user = {}
        for m in Medal.objects.select_related('user', 'challenge'):
            entry = by_user.setdefault(m.user_id, {
                'user': m.user_id,
                'user_name': m.user.name or m.user.username,
                'count': 0,
                'points': 0,
            })
            entry['count'] += 1
            entry['points'] += m.challenge.points
        summary = sorted(by_user.values(), key=lambda e: (-e['count'], e['user_name'].lower()))
        return Response(summary)

class SupervisorDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSupervisor]

    def get(self, request):
        today = timezone.localdate()

        weeks = []
        for offset in range(7, -1, -1):
            monday = today - timedelta(days=today.weekday() + offset * 7)
            sunday = monday + timedelta(days=7)
            medals = Medal.objects.filter(awarded_at__date__gte=monday, awarded_at__date__lt=sunday)
            daily = DailyPoint.objects.filter(date__gte=monday, date__lt=sunday)
            challenge_points = sum(m.challenge.points for m in medals)
            daily_points = sum(dp.points for dp in daily)
            weeks.append({
                'week': monday.isoformat(),
                'label': f'{monday.strftime("%d/%m")} - {(sunday - timedelta(days=1)).strftime("%d/%m")}',
                'challenges_completed': medals.count(),
                'challenge_points': challenge_points,
                'daily_points': daily_points,
                'total_points': challenge_points + daily_points,
            })

        participants = []
        start_day = today - timedelta(days=29)
        week_bounds = []
        for offset in range(7, -1, -1):
            monday = today - timedelta(days=today.weekday() + offset * 7)
            sunday = monday + timedelta(days=7)
            week_bounds.append((monday, sunday))

        for u in User.objects.filter(role='participant', is_superuser=False, is_approved=True, is_active=True):
            medals = Medal.objects.filter(user=u)
            daily = DailyPoint.objects.filter(user=u)
            challenge_points = sum(m.challenge.points for m in medals)
            daily_points = sum(dp.points for dp in daily)

            user_medals = list(medals.select_related('challenge'))
            user_daily = list(daily)
            user_weeks = []
            for monday, sunday in week_bounds:
                mpts = sum(m.challenge.points for m in user_medals if monday <= m.awarded_at.date() < sunday)
                dpts = sum(dp.points for dp in user_daily if monday <= dp.date < sunday)
                user_weeks.append({
                    'week': monday.isoformat(),
                    'label': f'{monday.strftime("%d/%m")} - {(sunday - timedelta(days=1)).strftime("%d/%m")}',
                    'challenges_completed': sum(1 for m in user_medals if monday <= m.awarded_at.date() < sunday),
                    'challenge_points': mpts,
                    'daily_points': dpts,
                    'total_points': mpts + dpts,
                })

            steps_qs = DailyPoint.objects.filter(user=u, date__gte=start_day, steps__isnull=False)
            steps_by_day = {dp.date.isoformat(): dp.steps for dp in steps_qs}
            steps_series = []
            cursor = start_day
            for _ in range(30):
                steps_series.append({'date': cursor.isoformat(), 'steps': steps_by_day.get(cursor.isoformat(), 0)})
                cursor += timedelta(days=1)

            participants.append({
                'id': u.id,
                'name': u.name or u.username,
                'username': u.username,
                'avatar': u.avatar.url if u.avatar else None,
                'challenges_completed': medals.count(),
                'challenge_points': challenge_points,
                'daily_points': daily_points,
                'bonus_points': float(u.bonus_points or 0),
                'total_points': challenge_points + daily_points + float(u.bonus_points or 0),
                'steps_total': sum(dp.steps for dp in steps_qs),
                'steps_series': steps_series,
                'weeks': user_weeks,
                'daily': [{
                    'date': d.date.isoformat(),
                    'image': bool(d.image),
                    'video': bool(d.video),
                    'steps': d.steps,
                    'activity': d.activity.name if d.activity_id else None,
                    'points': d.points,
                } for d in user_daily],
            })
        participants.sort(key=lambda p: p['total_points'], reverse=True)

        return Response({'weeks': weeks, 'participants': participants})

class EvidenceLikeToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        evidence_id = (request.data.get('evidence_id') or '').strip()
        if not evidence_id:
            return Response({'error': 'Falta el campo evidence_id'}, status=status.HTTP_400_BAD_REQUEST)
        like, created = EvidenceLike.objects.get_or_create(user=request.user, evidence_id=evidence_id)
        if not created:
            like.delete()
        return Response({
            'evidence_id': evidence_id,
            'liked': created,
            'likes_count': EvidenceLike.objects.filter(evidence_id=evidence_id).count(),
        })

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
                'video': media_stream_url(s.video),
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
                    'video': media_stream_url(d.video),
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

        ids = [e['id'] for e in items]
        like_counts = dict(
            EvidenceLike.objects.filter(evidence_id__in=ids)
            .values_list('evidence_id')
            .annotate(c=Count('pk')).values_list('evidence_id', 'c')
        )
        my_likes = set(
            EvidenceLike.objects.filter(evidence_id__in=ids, user=request.user)
            .values_list('evidence_id', flat=True)
        )
        for e in items:
            e['likes_count'] = like_counts.get(e['id'], 0)
            e['liked'] = e['id'] in my_likes

        return Response(items)

class ChallengeSubmissionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, challenge_id):
        try:
            challenge = Challenge.objects.get(id=challenge_id)
        except Challenge.DoesNotExist:
            return Response({'error': 'Reto no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        is_supervisor = is_supervisor_user(request.user)

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
