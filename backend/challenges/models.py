from django.db import models
from django.conf import settings
from django.utils import timezone

class Challenge(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    points = models.PositiveIntegerField(default=5)
    video = models.FileField(upload_to='challenge_videos/', null=True, blank=True, help_text='Video explicativo opcional del reto')
    start_date = models.DateTimeField(null=True, blank=True, help_text='Fecha y hora de inicio del reto')
    end_date = models.DateTimeField(null=True, blank=True, help_text='Fecha y hora límite del reto')
    active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    def effective_active(self, now=None):
        now = now or timezone.now()
        if self.active:
            return True
        if not self.start_date:
            return False
        if self.start_date > now:
            return False
        if self.end_date and now > self.end_date:
            return False
        return True

class ChallengeSubmission(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('approved', 'Aprobado'),
        ('rejected', 'Rechazado'),
        ('returned', 'Devuelto'),
    ]
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='submissions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='challenge_submissions')
    image = models.ImageField(upload_to='challenges/', null=True, blank=True)
    video = models.FileField(upload_to='challenges/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    points_awarded = models.PositiveIntegerField(default=0, help_text='Puntos asignados por el supervisor')
    review_comment = models.TextField(blank=True, default='', help_text='Comentario del supervisor para el participante')
    reviewed_at = models.DateTimeField(null=True, blank=True)
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

class ChallengeCompletion(models.Model):
    STATUS_CHOICES = [
        ('requested', 'Solicitado'),
        ('approved', 'Aprobado'),
        ('rejected', 'Rechazado'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='completions')
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='completions')
    message = models.TextField(blank=True, default='', help_text='Mensaje del participante al marcar su reto como completado')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')
    requested_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'challenge')
        ordering = ['-requested_at']

    def __str__(self):
        return f'{self.user} - {self.challenge.title} ({self.status})'

class EvidenceLike(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='evidence_likes')
    evidence_id = models.CharField(max_length=32, db_index=True, help_text='ID de la evidencia (ej: c5, d3-img)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'evidence_id')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} → {self.evidence_id}'
