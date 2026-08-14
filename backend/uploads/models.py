import uuid

from django.db import models


class PendingUpload(models.Model):
    """A file being uploaded in parts that stays under PythonAnywhere's request limit."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    original_name = models.CharField(max_length=255)
    size = models.BigIntegerField()
    total_parts = models.PositiveIntegerField()
    parts_received = models.PositiveIntegerField(default=0)
    staging_name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed = models.BooleanField(default=False)

    def __str__(self):
        return f'{self.original_name} ({self.parts_received}/{self.total_parts})'
