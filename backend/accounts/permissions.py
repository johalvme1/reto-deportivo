def is_supervisor_user(user):
    return user.is_authenticated and (user.role == 'supervisor' or user.is_staff or user.is_superuser)
