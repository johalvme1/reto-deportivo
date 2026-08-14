from django.db import migrations


def assign_teams(apps, schema_editor):
    Team = apps.get_model('accounts', 'Team')
    User = apps.get_model('accounts', 'User')

    supervisors = list(User.objects.filter(role='supervisor').order_by('id'))
    preferred = [s for s in supervisors if not s.is_superuser]
    chosen = (preferred or supervisors)[:1]

    team = None
    for supervisor in chosen:
        team = Team.objects.create(
            name='Divinas Challenge' if team is None else f'Equipo de {supervisor.name or supervisor.username}',
            supervisor=supervisor,
        )
        User.objects.filter(pk=supervisor.pk).update(team=team)

    if team is None:
        return

    User.objects.filter(team__isnull=True, is_superuser=False).update(team=team)


def unassign_teams(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_team_user_team_teaminvitation'),
    ]

    operations = [
        migrations.RunPython(assign_teams, unassign_teams),
    ]
