from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = [
        ('supervisor', 'Supervisor'),
        ('participant', 'Participant'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='participant')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    name = models.CharField(max_length=150, blank=True, default='')

    def __str__(self):
        return self.name or self.username
