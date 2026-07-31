from datetime import date, timedelta
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from django.db.models import Count, Q
from .models import DailyPoint
from .serializers import DailyPointSerializer
from activities.models import Activity

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
        file = request.FILES.get('image')
        if not file:
            return Response({'error': 'Imagen requerida'}, status=status.HTTP_400_BAD_REQUEST)

        today = date.today()
        dp, created = DailyPoint.objects.get_or_create(user=request.user, date=today)

        if dp.image and not created:
            return Response({'error': 'Ya subiste una imagen hoy'}, status=status.HTTP_400_BAD_REQUEST)

        dp.image = file
        dp.save()
        return Response(DailyPointSerializer(dp).data)

class StepsSubmitView(APIView):
    def post(self, request):
        steps = request.data.get('steps')
        try:
            steps = int(steps)
            if steps <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response({'error': 'Cantidad de pasos inválida'}, status=status.HTTP_400_BAD_REQUEST)

        today = date.today()
        dp, created = DailyPoint.objects.get_or_create(user=request.user, date=today)

        if dp.steps and not created:
            return Response({'error': 'Ya registraste tus pasos hoy'}, status=status.HTTP_400_BAD_REQUEST)

        dp.steps = steps
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

        if dp.activity_id and not created:
            return Response({'error': 'Ya registraste una actividad hoy'}, status=status.HTTP_400_BAD_REQUEST)

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
        all_users = DailyPoint.objects.values('user', 'user__username', 'user__name', 'user__avatar').annotate(
            image_count=Count('pk', filter=Q(image__isnull=False) & ~Q(image='')),
            steps_count=Count('pk', filter=Q(steps__isnull=False)),
            activity_count=Count('pk', filter=Q(activity__isnull=False)),
        ).order_by('-image_count', '-steps_count', '-activity_count')

        leaderboard = []
        for entry in all_users:
            total = entry['image_count'] + entry['steps_count'] + entry['activity_count']
            leaderboard.append({
                'id': entry['user'],
                'name': entry['user__name'] or entry['user__username'],
                'avatar': entry['user__avatar'],
                'total_points': total
            })

        return Response(leaderboard)
