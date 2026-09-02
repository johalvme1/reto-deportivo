from django.db import migrations
from django.conf import settings

NEW_ACTIVITIES = [
    'Calistenia',
    'Tai Chi',
]

def add_activities(apps, schema_editor):
    Activity = apps.get_model('activities', 'Activity')
    User = apps.get_model(settings.AUTH_USER_MODEL)
    supervisor = User.objects.filter(role='supervisor').first()
    if not supervisor:
        supervisor = User.objects.filter(is_superuser=True).first()
    if not supervisor:
        return

    for name in NEW_ACTIVITIES:
        Activity.objects.get_or_create(
            name=name,
            created_by=supervisor,
        )

def remove_activities(apps, schema_editor):
    Activity = apps.get_model('activities', 'Activity')
    Activity.objects.filter(name__in=NEW_ACTIVITIES).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('activities', '0004_reseed_default_activities'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(add_activities, remove_activities),
    ]
