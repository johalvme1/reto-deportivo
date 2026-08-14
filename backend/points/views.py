from datetime import date, timedelta
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from django.db.models import Count, Q
from .models import DailyPoint
from .serializers import DailyPointSerializer
from activities.models import Activity
from challenges.models import ChallengeSubmission
from django.contrib.auth import get_user_model
from uploads.views import claim_pending, resolve_field

class TodayPointsView(APIView):
    def get(self, request):
        today = date.today()
        dp = DailyPoint.objects.filter(user=request.user, date=today).first()

        week_ago = today - timedelta(days=7)
        weekly_points = sum(
            dp.points for dp in DailyPoint.objects.filter(user=request.user, date__gte=week_ago)
        )

        serializer = DailyPointSerializer(dp) if dp else None
        return Response({
            'date': today.isoformat(),
            'todayPoints': dp.points if dp else 0,
            'weeklyPoints': weekly_points,
            'maxToday': 3,
            'dailyPoint': serializer.data if serializer else None
        })

class ImageUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        image_raw, image_dest = resolve_field(request, 'image')
        video_raw, video_dest = resolve_field(request, 'video')
        if not (image_raw or image_dest or video_raw or video_dest):
            return Response({'error': 'Debes subir una foto o un video como evidencia'}, status=status.HTTP_400_BAD_REQUEST)

        today = date.today()
        dp, created = DailyPoint.objects.get_or_create(user=request.user, date=today)

        if dp.image or dp.video:
            return Response({'error': 'La evidencia de hoy ya fue registrada y está bloqueada'}, status=status.HTTP_400_BAD_REQUEST)

        if image_raw or image_dest:
            if image_raw:
                dp.image = image_raw
            else:
                dp.image.name = image_dest
        else:
            if video_raw:
                dp.video = video_raw
            else:
                dp.video.name = video_dest
        dp.save()
        return Response(DailyPointSerializer(dp).data)

class StepsSubmitView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        steps = request.data.get('steps')
        file = request.FILES.get('steps_image')
        dest = claim_pending(request.data.get('steps_image_upload_id'))
        if not file and not dest:
            return Response({'error': 'Debes subir una foto como evidencia de tus pasos'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            steps = int(steps)
        except (TypeError, ValueError):
            return Response({'error': 'Cantidad de pasos inválida'}, status=status.HTTP_400_BAD_REQUEST)

        if steps < 0:
            return Response({'error': 'La cantidad de pasos no puede ser negativa'}, status=status.HTTP_400_BAD_REQUEST)

        today = date.today()
        dp, created = DailyPoint.objects.get_or_create(user=request.user, date=today)

        if dp.steps is not None and dp.steps_image:
            return Response({'error': 'Los pasos de hoy ya fueron registrados y están bloqueados'}, status=status.HTTP_400_BAD_REQUEST)

        dp.steps = steps
        if file:
            dp.steps_image = file
        else:
            dp.steps_image.name = dest
        dp.save()
        return Response(DailyPointSerializer(dp).data)

class ActivitySubmitView(APIView):
    def post(self, request):
        activity_id = request.data.get('activity_id')
        if not activity_id:
            return Response({'error': 'Actividad requerida'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            activity = Activity.objects.get(id=activity_id)
        except Activity.DoesNotExist:
            return Response({'error': 'Actividad no encontrada'}, status=status.HTTP_404_NOT_FOUND)

        today = date.today()
        dp, created = DailyPoint.objects.get_or_create(user=request.user, date=today)

        if dp.activity_id:
            return Response({'error': 'La actividad de hoy ya fue registrada y está bloqueada'}, status=status.HTTP_400_BAD_REQUEST)

        dp.activity = activity
        dp.save()
        return Response(DailyPointSerializer(dp).data)

class HistoryView(APIView):
    def get(self, request):
        dps = DailyPoint.objects.filter(user=request.user).select_related('activity__sport').order_by('-date')[:30]
        return Response(DailyPointSerializer(dps, many=True).data)

class LeaderboardView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.db.models import Count, Q, Sum, Case, When, Value, DecimalField, Max, F
        User = get_user_model()

        daily_agg = DailyPoint.objects.values('user').annotate(
            image_count=Count('pk', filter=Q(image__isnull=False) & ~Q(image='') | Q(video__isnull=False) & ~Q(video='')),
            steps_points=Sum(
                Case(
                    When(steps__gte=5000, then=Value(1)),
                    When(steps__gte=3000, then=Value(0.5)),
                    default=Value(0),
                    output_field=DecimalField(max_digits=10, decimal_places=2),
                ),
                filter=Q(steps__isnull=False) & Q(steps_image__isnull=False),
            ),
            activity_count=Count('pk', filter=Q(activity__isnull=False)),
        )
        daily_map = {entry['user']: entry for entry in daily_agg}

        challenge_agg = (
            ChallengeSubmission.objects.filter(status='approved')
            .values('user', 'challenge')
            .annotate(challenge_pts=Max(F('challenge__points')))
        )
        extra_map = {}
        for entry in challenge_agg:
            extra_map[entry['user']] = extra_map.get(entry['user'], 0) + entry['challenge_pts']

        leaderboard = []
        for user in User.objects.filter(role='participant', is_superuser=False, is_approved=True, is_active=True):
            d = daily_map.get(user.id, {})
            total = float(d.get('image_count', 0) or 0) + float(d.get('steps_points', 0) or 0) + float(d.get('activity_count', 0) or 0) + float(extra_map.get(user.id, 0) or 0) + float(user.bonus_points or 0)
            leaderboard.append({
                'id': user.id,
                'name': user.name or user.username,
                'avatar': user.avatar.url if user.avatar else None,
                'total_points': total
            })

        leaderboard.sort(key=lambda e: e['total_points'], reverse=True)
        return Response(leaderboard)
