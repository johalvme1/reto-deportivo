from datetime import date, timedelta
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from django.db.models import Count, Q, Sum, Value, IntegerField
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

class CommentSubmitView(APIView):
    def post(self, request):
        comment = request.data.get('comment', '').strip()
        if not comment:
            return Response({'error': 'Comentario requerido'}, status=status.HTTP_400_BAD_REQUEST)

        today = date.today()
        dp, created = DailyPoint.objects.get_or_create(user=request.user, date=today)

        if dp.comment and not created:
            return Response({'error': 'Ya agregaste un comentario hoy'}, status=status.HTTP_400_BAD_REQUEST)

        dp.comment = comment
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
        users = DailyPoint.objects.values('user', 'user__username', 'user__avatar').annotate(
            total_points=Count('id')  # placeholder, will recalculate
        ).order_by('-total_points')

        # Recalculate properly
        leaderboard = []
        all_users = DailyPoint.objects.values('user', 'user__username', 'user__avatar').annotate(
            image_count=Count('pk', filter=Q(image__isnull=False)),
            comment_count=Count('pk', filter=Q(comment__isnull=False)),
            activity_count=Count('pk', filter=Q(activity__isnull=False)),
        ).order_by('-image_count', '-comment_count', '-activity_count')

        for entry in all_users:
            total = entry['image_count'] + entry['comment_count'] + entry['activity_count']
            leaderboard.append({
                'id': entry['user'],
                'name': entry['user__username'],
                'avatar': entry['user__avatar'],
                'total_points': total
            })

        return Response(leaderboard)
