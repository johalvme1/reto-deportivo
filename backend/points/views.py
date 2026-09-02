import uuid
from datetime import date, timedelta
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from django.db.models import Count, Q
from .models import DailyPoint, RestDay, CompetitionPeriod, Measurement, MeasurementSchedule
from .serializers import DailyPointSerializer
from activities.models import Activity
from challenges.models import ChallengeSubmission, Challenge, Medal
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

        has_rest_today = RestDay.objects.filter(user=request.user, date=today).exists()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        has_rest_this_week = RestDay.objects.filter(
            user=request.user, date__gte=week_start, date__lte=week_end
        ).exists()

        has_active_challenge = Challenge.objects.filter(
            start_date__date__lte=today,
            end_date__date__gte=today,
            active=True
        ).exists()

        serializer = DailyPointSerializer(dp) if dp else None
        return Response({
            'date': today.isoformat(),
            'todayPoints': dp.points if dp else 0,
            'weeklyPoints': weekly_points,
            'maxToday': 3,
            'dailyPoint': serializer.data if dp else None,
            'hasRestToday': has_rest_today,
            'hasRestThisWeek': has_rest_this_week,
            'hasActiveChallenge': has_active_challenge,
        })

class ImageUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        today = date.today()
        if RestDay.objects.filter(user=request.user, date=today).exists():
            return Response({'error': 'Hoy es tu día de descanso. No puedes subir evidencia.'}, status=status.HTTP_400_BAD_REQUEST)

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
        today = date.today()
        if RestDay.objects.filter(user=request.user, date=today).exists():
            return Response({'error': 'Hoy es tu día de descanso. No puedes subir pasos.'}, status=status.HTTP_400_BAD_REQUEST)

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
        today = date.today()
        if RestDay.objects.filter(user=request.user, date=today).exists():
            return Response({'error': 'Hoy es tu día de descanso. No puedes registrar actividad.'}, status=status.HTTP_400_BAD_REQUEST)

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
            total_steps=Sum('steps', filter=Q(steps__isnull=False)),
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
                'total_points': total,
                'total_steps': int(d.get('total_steps', 0) or 0)
            })

        leaderboard.sort(key=lambda e: e['total_points'], reverse=True)
        return Response(leaderboard)

class RestDayView(APIView):
    def post(self, request):
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)

        if RestDay.objects.filter(user=request.user, date__gte=week_start, date__lte=week_end).exists():
            return Response({'error': 'Ya usaste tu día de descanso esta semana'}, status=status.HTTP_400_BAD_REQUEST)

        if Challenge.objects.filter(start_date__date__lte=today, end_date__date__gte=today, active=True).exists():
            return Response({'error': 'No puedes usar descanso cuando hay un reto activo ese día'}, status=status.HTTP_400_BAD_REQUEST)

        dp, created = DailyPoint.objects.get_or_create(user=request.user, date=today)
        if dp.is_rest_day:
            return Response({'error': 'Hoy ya es tu día de descanso'}, status=status.HTTP_400_BAD_REQUEST)

        dp.is_rest_day = True
        dp.steps = 5000

        import base64, os
        from django.conf import settings
        placeholder_dir = settings.MEDIA_ROOT / 'uploads'
        placeholder_dir.mkdir(parents=True, exist_ok=True)
        placeholder_name = f'uploads/rest_day_{uuid.uuid4().hex[:8]}.png'
        placeholder_path = settings.MEDIA_ROOT / placeholder_name
        if not placeholder_path.exists():
            tiny_png = base64.b64decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
            )
            with open(placeholder_path, 'wb') as f:
                f.write(tiny_png)

        dp.image.name = placeholder_name
        dp.steps_image.name = placeholder_name

        descanso_activity, _ = Activity.objects.get_or_create(
            name='Día de descanso',
            defaults={'created_by': request.user},
        )
        dp.activity = descanso_activity
        dp.save()

        RestDay.objects.create(user=request.user, date=today)

        return Response({
            'ok': True,
            'message': 'Día de descanso registrado. ¡Descansa!',
            'dailyPoints': dp.points,
        })

class CompetitionPeriodView(APIView):
    def get(self, request):
        period = CompetitionPeriod.current()
        if not period:
            return Response({'active': False, 'message': 'Sin periodo definido'})
        today = date.today()
        is_active = period.start_date <= today <= period.end_date
        return Response({
            'active': is_active,
            'start_date': period.start_date.isoformat(),
            'end_date': period.end_date.isoformat(),
        })

class CompetitionPeriodAdminView(APIView):
    def post(self, request):
        from accounts.permissions import is_supervisor_user
        if not is_supervisor_user(request.user):
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        start = request.data.get('start_date')
        end = request.data.get('end_date')
        if not start or not end:
            return Response({'error': 'Fechas requeridas'}, status=status.HTTP_400_BAD_REQUEST)

        period = CompetitionPeriod.objects.create(
            start_date=start,
            end_date=end,
            is_active=True
        )
        CompetitionPeriod.objects.exclude(id=period.id).update(is_active=False)

        return Response({
            'ok': True,
            'start_date': period.start_date.isoformat(),
            'end_date': period.end_date.isoformat(),
        })

class MeasurementView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        user_id = request.query_params.get('user_id')
        if user_id:
            measurements = Measurement.objects.filter(user_id=user_id).order_by('-created_at')[:50]
        else:
            measurements = Measurement.objects.select_related('user').order_by('-created_at')[:200]
        data = []
        for m in measurements:
            data.append({
                'id': m.id,
                'date': m.date.isoformat(),
                'created_at': m.created_at.isoformat(),
                'user_id': m.user_id,
                'user_name': m.user.name or m.user.username,
                'peso': float(m.peso) if m.peso is not None else None,
                'grasa_corporal': float(m.grasa_corporal) if m.grasa_corporal is not None else None,
                'grasa_visceral': float(m.grasa_visceral) if m.grasa_visceral is not None else None,
                'musculo': float(m.musculo) if m.musculo is not None else None,
                'photo': m.photo.url if m.photo else None,
            })

        return Response({'measurements': data})

    def post(self, request):
        from datetime import date as date_type, timedelta
        today = date_type.today()

        peso = request.data.get('peso')
        grasa_corporal = request.data.get('grasa_corporal')
        grasa_visceral = request.data.get('grasa_visceral')
        musculo = request.data.get('musculo')
        photo = request.FILES.get('photo')

        if peso is None or grasa_corporal is None or grasa_visceral is None or musculo is None:
            return Response({'error': 'Todos los campos son obligatorios (peso, grasa corporal, grasa visceral, músculo)'}, status=status.HTTP_400_BAD_REQUEST)

        m = Measurement(user=request.user, date=today)
        if peso is not None: m.peso = peso
        if grasa_corporal is not None: m.grasa_corporal = grasa_corporal
        if grasa_visceral is not None: m.grasa_visceral = grasa_visceral
        if musculo is not None: m.musculo = musculo
        if photo: m.photo = photo
        m.save()

        return Response({
            'id': m.id,
            'date': m.date.isoformat(),
            'created_at': m.created_at.isoformat(),
            'user_id': m.user_id,
            'user_name': m.user.name or m.user.username,
            'peso': float(m.peso) if m.peso is not None else None,
            'grasa_corporal': float(m.grasa_corporal) if m.grasa_corporal is not None else None,
            'grasa_visceral': float(m.grasa_visceral) if m.grasa_visceral is not None else None,
            'musculo': float(m.musculo) if m.musculo is not None else None,
            'photo': m.photo.url if m.photo else None,
        })

    def put(self, request):
        measurement_id = request.query_params.get('id')
        if not measurement_id:
            return Response({'error': 'Falta id'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            m = Measurement.objects.get(id=measurement_id, user=request.user)
        except Measurement.DoesNotExist:
            return Response({'error': 'No encontrada'}, status=status.HTTP_404_NOT_FOUND)

        photo = request.FILES.get('photo')
        if photo:
            m.photo = photo
            m.save(update_fields=['photo'])

        return Response({
            'id': m.id,
            'date': m.date.isoformat(),
            'created_at': m.created_at.isoformat(),
            'user_id': m.user_id,
            'user_name': m.user.name or m.user.username,
            'peso': float(m.peso) if m.peso is not None else None,
            'grasa_corporal': float(m.grasa_corporal) if m.grasa_corporal is not None else None,
            'grasa_visceral': float(m.grasa_visceral) if m.grasa_visceral is not None else None,
            'musculo': float(m.musculo) if m.musculo is not None else None,
            'photo': m.photo.url if m.photo else None,
        })


class DangerZoneWipeView(APIView):
    def post(self, request):
        from accounts.permissions import is_supervisor_user
        if not is_supervisor_user(request.user):
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        confirm = request.data.get('confirm')
        if confirm != 'BORRAR_TODO':
            return Response({'error': 'Envía confirm: "BORRAR_TODO"'}, status=status.HTTP_400_BAD_REQUEST)

        import shutil
        from django.conf import settings
        from points.models import DailyPoint, RestDay, CompetitionPeriod, Measurement
        from challenges.models import Challenge, ChallengeSubmission, Medal, ChallengeCompletion, ChallengeExpiryNotice
        from activities.models import Activity
        from sports.models import Sport
        from chat.models import ChatMessage
        from uploads.models import PendingUpload

        ChallengeCompletion.objects.all().delete()
        ChallengeExpiryNotice.objects.all().delete()
        ChallengeSubmission.objects.all().delete()
        Medal.objects.all().delete()
        Challenge.objects.all().delete()
        DailyPoint.objects.all().delete()
        RestDay.objects.all().delete()
        CompetitionPeriod.objects.all().delete()
        Measurement.objects.all().delete()
        MeasurementSchedule.objects.all().delete()
        ChatMessage.objects.all().delete()
        PendingUpload.objects.all().delete()

        User = get_user_model()
        User.objects.all().update(bonus_points=0)

        for folder in ['uploads', 'steps', 'measurements', 'challenges', 'pending']:
            path = settings.MEDIA_ROOT / folder
            if path.exists():
                shutil.rmtree(path, ignore_errors=True)

        return Response({'ok': True, 'message': 'Datos y archivos borrados. Usuarios conservados.'})
