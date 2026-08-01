from django.urls import path
from .views import RegisterView, LoginView, ProfileView, PendingUsersView, ReviewUserView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('pending-users/', PendingUsersView.as_view(), name='pending-users'),
    path('users/review/', ReviewUserView.as_view(), name='review-user'),
]
