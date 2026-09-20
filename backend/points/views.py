import uuid
from datetime import date, timedelta
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from django.db.models import Count, Q
from .models import DailyPoint, RestDay, CompetitionPeriod, Measurement, MeasurementSchedule, AdminLog
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

        active_challenge = None
        for c in Challenge.objects.all():
            if c.effective_active():
                active_challenge = c
                break

        serializer = DailyPointSerializer(dp) if dp else None
        return Response({
            'date': today.isoformat(),
            'todayPoints': dp.points if dp else 0,
            'weeklyPoints': weekly_points,
            'maxToday': 3,
            'dailyPoint': serializer.data if dp else None,
            'hasRestToday': has_rest_today,
            'hasRestThisWeek': has_rest_this_week,
            'hasActiveChallenge': active_challenge is not None,
            'activeChallengeName': active_challenge.title if active_challenge else None,
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
        from datetime import date as date_type
        today = date_type.today()
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

        User = get_user_model()
        all_users = User.objects.filter(is_active=True).order_by('name', 'username')
        users_data = [{'id': u.id, 'name': u.name or u.username} for u in all_users]

        from accounts.permissions import is_supervisor_user
        schedule_user = request.user
        if user_id and is_supervisor_user(request.user):
            schedule_user = User.objects.filter(id=user_id).first() or request.user

        schedule, _ = MeasurementSchedule.objects.get_or_create(
            user=schedule_user,
            defaults={'next_date': today, 'interval_days': 15}
        )

        return Response({
            'measurements': data,
            'users': users_data,
            'schedule': {
                'user_id': schedule_user.id,
                'user_name': schedule_user.name or schedule_user.username,
                'next_date': schedule.next_date.isoformat(),
                'interval_days': schedule.interval_days,
                'is_measurement_day': today == schedule.next_date,
            }
        })

    def post(self, request):
        from datetime import date as date_type, timedelta
        from accounts.permissions import is_supervisor_user
        today = date_type.today()

        is_supervisor = is_supervisor_user(request.user)
        target_user_id = request.data.get('user_id') if is_supervisor else None
        target_user = request.user
        if target_user_id and is_supervisor:
            User = get_user_model()
            try:
                target_user = User.objects.get(id=target_user_id)
            except User.DoesNotExist:
                return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        measurement_date = today
        if is_supervisor and request.data.get('measurement_date'):
            try:
                measurement_date = date_type.fromisoformat(request.data.get('measurement_date'))
            except ValueError:
                return Response({'error': 'Formato de fecha inválido'}, status=status.HTTP_400_BAD_REQUEST)

        schedule, _ = MeasurementSchedule.objects.get_or_create(
            user=target_user,
            defaults={'next_date': today, 'interval_days': 15}
        )
        if not is_supervisor and today != schedule.next_date:
            return Response({
                'error': f'Solo puedes registrar medidas el día de tu medición. Próxima medición: {schedule.next_date.strftime("%d/%m/%Y")}'
            }, status=status.HTTP_400_BAD_REQUEST)

        peso = request.data.get('peso')
        grasa_corporal = request.data.get('grasa_corporal')
        grasa_visceral = request.data.get('grasa_visceral')
        musculo = request.data.get('musculo')
        photo = request.FILES.get('photo')

        if peso is None or grasa_corporal is None or grasa_visceral is None or musculo is None:
            return Response({'error': 'Todos los campos son obligatorios (peso, grasa corporal, grasa visceral, músculo)'}, status=status.HTTP_400_BAD_REQUEST)

        m = Measurement(user=target_user, date=measurement_date)
        if peso is not None: m.peso = peso
        if grasa_corporal is not None: m.grasa_corporal = grasa_corporal
        if grasa_visceral is not None: m.grasa_visceral = grasa_visceral
        if musculo is not None: m.musculo = musculo
        if photo: m.photo = photo
        m.save()

        schedule.next_date = measurement_date + timedelta(days=schedule.interval_days)
        schedule.save(update_fields=['next_date'])

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
            'next_date': schedule.next_date.isoformat(),
        })

    def put(self, request):
        from accounts.permissions import is_supervisor_user
        measurement_id = request.query_params.get('id')
        if not measurement_id:
            return Response({'error': 'Falta id'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            m = Measurement.objects.get(id=measurement_id)
        except Measurement.DoesNotExist:
            return Response({'error': 'No encontrada'}, status=status.HTTP_404_NOT_FOUND)

        is_supervisor = is_supervisor_user(request.user)
        if not is_supervisor and m.user_id != request.user.id:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        peso = request.data.get('peso')
        grasa_corporal = request.data.get('grasa_corporal')
        grasa_visceral = request.data.get('grasa_visceral')
        musculo = request.data.get('musculo')
        photo = request.FILES.get('photo')
        measurement_date = request.data.get('measurement_date')

        if peso is not None: m.peso = peso
        if grasa_corporal is not None: m.grasa_corporal = grasa_corporal
        if grasa_visceral is not None: m.grasa_visceral = grasa_visceral
        if musculo is not None: m.musculo = musculo
        if photo: m.photo = photo
        if measurement_date and is_supervisor:
            from datetime import date as date_type
            try:
                m.date = date_type.fromisoformat(measurement_date)
            except ValueError:
                pass
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

    def delete(self, request):
        from accounts.permissions import is_supervisor_user
        measurement_id = request.query_params.get('id')
        if not measurement_id:
            return Response({'error': 'Falta id'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            m = Measurement.objects.get(id=measurement_id)
        except Measurement.DoesNotExist:
            return Response({'error': 'No encontrada'}, status=status.HTTP_404_NOT_FOUND)

        is_supervisor = is_supervisor_user(request.user)
        if not is_supervisor and m.user_id != request.user.id:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        m.delete()
        return Response({'ok': True})


class MeasurementScheduleView(APIView):
    def get(self, request):
        from accounts.permissions import is_supervisor_user
        User = get_user_model()
        today = date.today()

        target = request.user
        user_id = request.query_params.get('user_id')
        if user_id and is_supervisor_user(request.user):
            target = User.objects.filter(id=user_id).first() or request.user

        schedule, _ = MeasurementSchedule.objects.get_or_create(
            user=target,
            defaults={'next_date': today, 'interval_days': 15}
        )
        return Response({
            'user_id': target.id,
            'user_name': target.name or target.username,
            'next_date': schedule.next_date.isoformat(),
            'interval_days': schedule.interval_days,
            'is_measurement_day': today == schedule.next_date,
        })

    def post(self, request):
        from accounts.permissions import is_supervisor_user
        if not is_supervisor_user(request.user):
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        User = get_user_model()
        next_date_raw = request.data.get('next_date')
        if not next_date_raw:
            return Response({'error': 'next_date es requerido'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            next_date = date.fromisoformat(str(next_date_raw))
        except (TypeError, ValueError):
            return Response({'error': 'Formato de fecha inválido (YYYY-MM-DD)'}, status=status.HTTP_400_BAD_REQUEST)

        interval = request.data.get('interval_days')
        if interval not in (None, ''):
            try:
                interval = int(interval)
                if interval < 1:
                    raise ValueError
            except (TypeError, ValueError):
                return Response({'error': 'interval_days inválido'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            interval = None

        apply_all = str(request.data.get('all')).lower() in ('1', 'true', 'yes')

        if apply_all:
            targets = User.objects.filter(role='participant', is_active=True)
            count = 0
            for target in targets:
                schedule, _ = MeasurementSchedule.objects.get_or_create(
                    user=target,
                    defaults={'next_date': next_date, 'interval_days': interval or 15}
                )
                schedule.next_date = next_date
                if interval is not None:
                    schedule.interval_days = interval
                schedule.save()
                count += 1
            return Response({
                'ok': True,
                'all': True,
                'count': count,
                'next_date': next_date.isoformat(),
                'interval_days': interval or 15,
            })

        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id o all=true son requeridos'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        schedule, _ = MeasurementSchedule.objects.get_or_create(
            user=target,
            defaults={'next_date': next_date, 'interval_days': interval or 15}
        )
        schedule.next_date = next_date
        if interval is not None:
            schedule.interval_days = interval
        schedule.save()
        return Response({
            'ok': True,
            'user_id': target.id,
            'user_name': target.name or target.username,
            'next_date': schedule.next_date.isoformat(),
            'interval_days': schedule.interval_days,
        })


class AdminDailyRecordView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        from accounts.permissions import is_supervisor_user
        if not is_supervisor_user(request.user):
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        User = get_user_model()
        user_id = request.query_params.get('user_id')
        target_date = request.query_params.get('date')
        qs = DailyPoint.objects.select_related('user', 'activity')
        if user_id:
            qs = qs.filter(user_id=user_id)
        if target_date:
            qs = qs.filter(date=target_date)
        records = [{
            'id': r.id,
            'user_id': r.user_id,
            'user_name': r.user.name or r.user.username,
            'date': r.date.isoformat(),
            'image': r.image.url if r.image else None,
            'video': r.video.url if r.video else None,
            'steps': r.steps,
            'steps_image': r.steps_image.url if r.steps_image else None,
            'activity_id': r.activity_id,
            'activity_name': r.activity.name if r.activity_id else None,
            'is_rest_day': r.is_rest_day,
            'points': r.points,
            'created_at': r.created_at.isoformat(),
        } for r in qs.order_by('-date')[:50]]
        return Response({'records': records})

    def post(self, request):
        from accounts.permissions import is_supervisor_user
        if not is_supervisor_user(request.user):
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        User = get_user_model()
        user_id = request.data.get('user_id')
        raw_date = request.data.get('date')
        comment = (request.data.get('comment') or '').strip()
        if not user_id or not raw_date:
            return Response({'error': 'user_id y date son requeridos'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        try:
            target_date = date.fromisoformat(str(raw_date))
        except (TypeError, ValueError):
            return Response({'error': 'Formato de fecha inválido (YYYY-MM-DD)'}, status=status.HTTP_400_BAD_REQUEST)

        dp, created = DailyPoint.objects.get_or_create(user=target, date=target_date)

        old = {
            'image': bool(dp.image),
            'video': bool(dp.video),
            'steps': dp.steps,
            'activity': dp.activity_id,
            'points': dp.points,
        }

        image_raw, image_dest = resolve_field(request, 'image')
        video_raw, video_dest = resolve_field(request, 'video')
        steps_image_raw, steps_image_dest = resolve_field(request, 'steps_image')

        if image_raw or image_dest:
            dp.image = image_raw if image_raw else image_dest
        if video_raw or video_dest:
            dp.video = video_raw if video_raw else video_dest
        if request.data.get('clear_image') == 'true':
            dp.image = None
        if request.data.get('clear_video') == 'true':
            dp.video = None
        if request.data.get('clear_steps') == 'true':
            dp.steps = None
            dp.steps_image = None
        if steps_image_raw or steps_image_dest:
            dp.steps_image = steps_image_raw if steps_image_raw else steps_image_dest

        steps_raw = request.data.get('steps')
        if steps_raw not in (None, ''):
            try:
                steps_val = int(steps_raw)
                if steps_val < 0:
                    raise ValueError
            except (TypeError, ValueError):
                return Response({'error': 'Cantidad de pasos inválida'}, status=status.HTTP_400_BAD_REQUEST)
            dp.steps = steps_val

        activity_id = request.data.get('activity_id')
        if activity_id not in (None, ''):
            try:
                dp.activity = Activity.objects.get(id=int(activity_id))
            except (Activity.DoesNotExist, TypeError, ValueError):
                return Response({'error': 'Actividad no encontrada'}, status=status.HTTP_400_BAD_REQUEST)
        if request.data.get('clear_activity') == 'true':
            dp.activity = None

        dp.save()

        new = {
            'image': bool(dp.image),
            'video': bool(dp.video),
            'steps': dp.steps,
            'activity': dp.activity_id,
            'points': dp.points,
        }

        AdminLog.objects.create(
            admin=request.user,
            participant=target,
            action='daily_point',
            date=target_date,
            comment=comment or ('Se creó el registro diario' if created else 'Se editó el registro diario'),
            details={'created': created, 'old': old, 'new': new},
        )

        return Response({
            'id': dp.id,
            'user_id': dp.user_id,
            'user_name': target.name or target.username,
            'date': dp.date.isoformat(),
            'image': dp.image.url if dp.image else None,
            'video': dp.video.url if dp.video else None,
            'steps': dp.steps,
            'steps_image': dp.steps_image.url if dp.steps_image else None,
            'activity_id': dp.activity_id,
            'activity_name': dp.activity.name if dp.activity_id else None,
            'is_rest_day': dp.is_rest_day,
            'points': dp.points,
            'created': created,
        })


class AdminBonusPointsView(APIView):
    def post(self, request):
        from accounts.permissions import is_supervisor_user
        if not is_supervisor_user(request.user):
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        User = get_user_model()
        user_id = request.data.get('user_id')
        bonus = request.data.get('bonus')
        comment = (request.data.get('comment') or '').strip()
        if not user_id or bonus is None:
            return Response({'error': 'user_id y bonus son requeridos'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        try:
            bonus = round(float(bonus), 1)
        except (TypeError, ValueError):
            return Response({'error': 'Valor de puntos inválido'}, status=status.HTTP_400_BAD_REQUEST)
        old = float(target.bonus_points or 0)
        target.bonus_points = bonus
        target.save(update_fields=['bonus_points'])
        AdminLog.objects.create(
            admin=request.user,
            participant=target,
            action='bonus_points',
            comment=comment or 'Ajuste de puntos bonus',
            details={'old_bonus': old, 'new_bonus': bonus},
        )
        return Response({
            'ok': True,
            'user_id': target.id,
            'user_name': target.name or target.username,
            'bonus_points': bonus,
            'old_bonus': old,
        })


class AdminLogsView(APIView):
    def get(self, request):
        from accounts.permissions import is_supervisor_user
        if not is_supervisor_user(request.user):
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        qs = AdminLog.objects.select_related('admin', 'participant')
        user_id = request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(participant_id=user_id)
        logs = [{
            'id': l.id,
            'action': l.action,
            'action_label': l.get_action_display(),
            'admin': l.admin.name or l.admin.username,
            'participant': l.participant.name or l.participant.username if l.participant_id else None,
            'participant_id': l.participant_id,
            'date': l.date.isoformat() if l.date else None,
            'comment': l.comment,
            'details': l.details,
            'created_at': l.created_at.isoformat(),
        } for l in qs.order_by('-created_at')[:200]]
        return Response({'logs': logs})


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
