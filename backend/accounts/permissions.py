from django.contrib.auth import get_user_model


def is_supervisor_user(user):
    return user.is_authenticated and (user.role == 'supervisor' or user.is_staff or user.is_superuser)


def team_member_qs(user):
    """Usuarios visibles para el usuario: admin ve todos, el resto solo su equipo."""
    if not user.is_authenticated:
        return get_user_model().objects.none()
    if user.is_superuser:
        return get_user_model().objects.all()
    if user.team_id:
        return get_user_model().objects.filter(team=user.team)
    return get_user_model().objects.none()


def can_access_team(user, team):
    if user.is_superuser:
        return True
    return bool(team) and user.team_id == team.id
