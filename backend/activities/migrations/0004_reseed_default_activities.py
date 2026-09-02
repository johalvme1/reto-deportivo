from django.db import migrations
from django.conf import settings

DEFAULT_ACTIVITIES = [
    'Caminar',
    'Trotar',
    'Correr',
    'Bailar',
    'Zumba',
    'Aeróbicos',
    'Bicicleta',
    'Brincar Suiza',
    'Subir y Bajar Gradas',
    'Senderismo',
    'Pesas',
    'Juegos Activos con los Hijos',
    'Sentadillas',
    'Lagartijas',
    'Desplantes',
]

def seed_activities(apps, schema_editor):
    Activity = apps.get_model('activities', 'Activity')
    User = apps.get_model(settings.AUTH_USER_MODEL)
    supervisor = User.objects.filter(role='supervisor').first()
    if not supervisor:
        supervisor = User.objects.filter(is_superuser=True).first()
    if not supervisor:
        return

    for name in DEFAULT_ACTIVITIES:
        Activity.objects.get_or_create(
            name=name,
            created_by=supervisor,
        )

def unseed_activities(apps, schema_editor):
    Activity = apps.get_model('activities', 'Activity')
    Activity.objects.filter(name__in=DEFAULT_ACTIVITIES).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('activities', '0003_seed_default_activities'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(seed_activities, unseed_activities),
    ]
