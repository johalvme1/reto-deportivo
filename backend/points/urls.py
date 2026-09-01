from django.urls import path
from .views import TodayPointsView, ImageUploadView, StepsSubmitView, ActivitySubmitView, HistoryView, LeaderboardView, RestDayView, CompetitionPeriodView, CompetitionPeriodAdminView, MeasurementView

urlpatterns = [
    path('today/', TodayPointsView.as_view(), name='today-points'),
    path('image/', ImageUploadView.as_view(), name='image-upload'),
    path('steps/', StepsSubmitView.as_view(), name='steps-submit'),
    path('activity/', ActivitySubmitView.as_view(), name='activity-submit'),
    path('history/', HistoryView.as_view(), name='points-history'),
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('rest-day/', RestDayView.as_view(), name='rest-day'),
    path('competition-period/', CompetitionPeriodView.as_view(), name='competition-period'),
    path('competition-period/admin/', CompetitionPeriodAdminView.as_view(), name='competition-period-admin'),
    path('measurements/', MeasurementView.as_view(), name='measurements'),
]
