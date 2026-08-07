from django.contrib.auth.models import AbstractUser
from django.db import models

class Team(models.Model):
    name = models.CharField(max_length=150, unique=True)
    supervisor = models.OneToOneField('accounts.User', on_delete=models.CASCADE, related_name='supervised_team', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class TeamInvitation(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='invitations')
    token = models.CharField(max_length=64, unique=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='created_invitations')
    created_at = models.DateTimeField(auto_now_add=True)
    used_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='used_invitations')
    used_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'{self.team} - {self.token[:8]}'

class User(AbstractUser):
    ROLE_CHOICES = [
        ('supervisor', 'Supervisor'),
        ('participant', 'Participant'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='participant')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    name = models.CharField(max_length=150, blank=True, default='')
    is_approved = models.BooleanField(default=True, help_text='Si es False, el usuario debe ser aprobado por un supervisor para poder ingresar')
    bonus_points = models.DecimalField(max_digits=6, decimal_places=1, default=0, help_text='Puntos manuales que suman al ranking sin estar ligados a un reto')
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name='members')

    def __str__(self):
        return self.name or self.username
