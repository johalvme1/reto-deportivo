from django.db import migrations


def assign_default_team(apps, schema_editor):
    Team = apps.get_model('accounts', 'Team')
    ChatMessage = apps.get_model('chat', 'ChatMessage')
    team = Team.objects.order_by('id').first()
    if team is None:
        return
    ChatMessage.objects.filter(team__isnull=True).update(team=team)


def unassign(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0003_chatmessage_team'),
        ('accounts', '0006_assign_default_teams'),
    ]

    operations = [
        migrations.RunPython(assign_default_team, unassign),
    ]
