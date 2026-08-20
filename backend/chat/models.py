from django.db import models
from django.conf import settings

class ChatMessage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_messages')
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='direct_messages', help_text='Si se define, el mensaje es privado y solo lo ve ese usuario')
    text = models.CharField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.user.name or self.user.username}: {self.text[:40]}'

class ChatReadState(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_read_state')
    last_read_id = models.PositiveBigIntegerField(default=0)

    def __str__(self):
        return f'{self.user}: hasta {self.last_read_id}'

