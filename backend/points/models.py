from django.db import models
from django.conf import settings

class DailyPoint(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='daily_points')
    date = models.DateField()
    image = models.ImageField(upload_to='uploads/', null=True, blank=True)
    video = models.FileField(upload_to='uploads/', null=True, blank=True)
    steps = models.IntegerField(null=True, blank=True)
    steps_image = models.ImageField(upload_to='steps/', null=True, blank=True)
    activity = models.ForeignKey('activities.Activity', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'date']

    @property
    def points(self):
        count = 0
        if self.image or self.video: count += 1
        if self.steps and self.steps_image: count += 1
        if self.activity_id: count += 1
        return count
