from django.urls import path
from .views import RegisterView, LoginView, ProfileView, PendingUsersView, ReviewUserView, PasswordResetRequestView, PasswordResetConfirmView, UsersListView, DeleteUserView, MyTeamView, CreateTeamView, RenameTeamView, CreateInvitationView, JoinTeamView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('pending-users/', PendingUsersView.as_view(), name='pending-users'),
    path('users/', UsersListView.as_view(), name='users-list'),
    path('users/review/', ReviewUserView.as_view(), name='review-user'),
    path('users/delete/', DeleteUserView.as_view(), name='delete-user'),
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('teams/me/', MyTeamView.as_view(), name='my-team'),
    path('teams/create/', CreateTeamView.as_view(), name='create-team'),
    path('teams/rename/', RenameTeamView.as_view(), name='rename-team'),
    path('teams/invite/', CreateInvitationView.as_view(), name='create-invitation'),
    path('teams/join/', JoinTeamView.as_view(), name='join-team'),
]
