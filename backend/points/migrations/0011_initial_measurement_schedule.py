from datetime import date, timedelta
from django.db import migrations

def create_initial_schedules(apps, schema_editor):
    MeasurementSchedule = apps.get_model('points', 'MeasurementSchedule')
    User = apps.get_model('accounts', 'User')
    tomorrow = date.today() + timedelta(days=1)
    for u in User.objects.filter(is_active=True):
        MeasurementSchedule.objects.get_or_create(
            user=u,
            defaults={'next_date': tomorrow, 'interval_days': 15}
        )

def remove_schedules(apps, schema_editor):
    MeasurementSchedule = apps.get_model('points', 'MeasurementSchedule')
    MeasurementSchedule.objects.all().delete()

class Migration(migrations.Migration):

    dependencies = [
        ('points', '0010_musculo_help_text'),
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_initial_schedules, remove_schedules),
    ]
