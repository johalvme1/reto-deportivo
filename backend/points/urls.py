from django.urls import path
from .views import TodayPointsView, ImageUploadView, CommentSubmitView, ActivitySubmitView, HistoryView, LeaderboardView

urlpatterns = [
    path('today/', TodayPointsView.as_view(), name='today-points'),
    path('image/', ImageUploadView.as_view(), name='image-upload'),
    path('comment/', CommentSubmitView.as_view(), name='comment-submit'),
    path('activity/', ActivitySubmitView.as_view(), name='activity-submit'),
    path('history/', HistoryView.as_view(), name='points-history'),
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
]
