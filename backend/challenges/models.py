from django.db import models
from django.conf import settings

class Challenge(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    points = models.PositiveIntegerField(default=5)
    start_date = models.DateTimeField(null=True, blank=True, help_text='Fecha y hora de inicio del reto')
    end_date = models.DateTimeField(null=True, blank=True, help_text='Fecha y hora límite del reto')
    active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

class ChallengeSubmission(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('approved', 'Aprobado'),
        ('rejected', 'Rechazado'),
    ]
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='submissions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='challenge_submissions')
    image = models.ImageField(upload_to='challenges/', null=True, blank=True)
    video = models.FileField(upload_to='challenges/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} - {self.challenge.title}'

class Medal(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='medals')
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='medals')
    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'challenge')
        ordering = ['-awarded_at']

    def __str__(self):
        return f'Medalla: {self.user.name} - {self.challenge.title}'
