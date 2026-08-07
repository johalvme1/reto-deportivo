from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, Team


@receiver(post_save, sender=User)
def create_supervisor_team(sender, instance, **kwargs):
    if kwargs.get('raw'):
        return
    if instance.role != 'supervisor' or instance.is_superuser:
        return
    if hasattr(instance, 'supervised_team'):
        return
    team = Team.objects.create(
        name=f'Equipo de {instance.name or instance.username}',
        supervisor=instance,
    )
    User.objects.filter(pk=instance.pk).update(team=team)
