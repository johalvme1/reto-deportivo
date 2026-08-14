from django.db import migrations


def assign_default_team(apps, schema_editor):
    Team = apps.get_model('accounts', 'Team')
    Challenge = apps.get_model('challenges', 'Challenge')
    team = Team.objects.order_by('id').first()
    if team is None:
        return
    Challenge.objects.filter(team__isnull=True).update(team=team)


def unassign(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('challenges', '0010_challenge_team'),
        ('accounts', '0006_assign_default_teams'),
    ]

    operations = [
        migrations.RunPython(assign_default_team, unassign),
    ]
