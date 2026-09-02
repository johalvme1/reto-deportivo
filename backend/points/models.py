from django.db import models
from django.conf import settings
from django.utils import timezone

class DailyPoint(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='daily_points')
    date = models.DateField()
    image = models.ImageField(upload_to='uploads/', null=True, blank=True)
    video = models.FileField(upload_to='uploads/', null=True, blank=True)
    steps = models.IntegerField(null=True, blank=True)
    steps_image = models.ImageField(upload_to='steps/', null=True, blank=True)
    activity = models.ForeignKey('activities.Activity', on_delete=models.SET_NULL, null=True, blank=True)
    is_rest_day = models.BooleanField(default=False, help_text='Día de descanso: otorga puntos sin evidencia')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'date']

    def __str__(self):
        return f'{self.user.name or self.user.username} - {self.date} ({self.points} pts)'

    @property
    def points(self):
        if self.is_rest_day:
            return 3
        count = 0
        if self.image or self.video: count += 1
        if self.steps is not None and self.steps_image:
            if self.steps >= 5000:
                count += 1
            elif self.steps >= 3000:
                count += 0.5
        if self.activity_id: count += 1
        return count

class RestDay(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='rest_days')
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'date')
        ordering = ['-date']

    def __str__(self):
        return f'Descanso: {self.user.name or self.user.username} - {self.date}'

class CompetitionPeriod(models.Model):
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Competencia: {self.start_date} al {self.end_date}'

    @classmethod
    def current(cls):
        return cls.objects.filter(is_active=True).order_by('-created_at').first()

class Measurement(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='measurements')
    date = models.DateField()
    peso = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='Peso en kg')
    grasa_corporal = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='Grasa corporal en %')
    grasa_visceral = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='Grasa visceral')
    musculo = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='Músculo en %')
    photo = models.ImageField(upload_to='measurements/', null=True, blank=True, help_text='Foto de las medidas')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Medidas: {self.user.name or self.user.username} - {self.date}'


class MeasurementSchedule(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='measurement_schedule')
    next_date = models.DateField(help_text='Fecha de la próxima medición')
    interval_days = models.IntegerField(default=15, help_text='Días entre mediciones')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Schedule: {self.user.name or self.user.username} - próxima: {self.next_date}'
