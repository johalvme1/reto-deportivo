from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from challenges.models import Challenge, ChallengeSubmission, Medal

User = get_user_model()


class Command(BaseCommand):
    help = (
        'Revoca la aprobacion de evidencias de un reto para participantes especificos: '
        'las devuelve a "pendiente", quita los puntos y elimina la medalla.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--users', required=True, help='Usernames separados por coma')
        parser.add_argument('--challenge', required=True, type=int, help='ID del reto')
        parser.add_argument('--yes', action='store_true', help='No pedir confirmacion')

    def handle(self, *args, **options):
        usernames = [u.strip() for u in options['users'].split(',') if u.strip()]
        challenge_id = options['challenge']

        challenge = Challenge.objects.filter(id=challenge_id).first()
        if not challenge:
            self.stdout.write(self.style.ERROR(f'Reto {challenge_id} no encontrado'))
            return

        plan = []
        for username in usernames:
            user = User.objects.filter(username=username).first()
            if not user:
                self.stdout.write(self.style.ERROR(f'Usuario "{username}" no encontrado'))
                continue
            subs = list(ChallengeSubmission.objects.filter(challenge=challenge, user=user, status='approved'))
            if not subs:
                self.stdout.write(self.style.WARNING(f'{username}: no tiene evidencias aprobadas en "{challenge.title}"'))
                continue
            plan.append((user, subs))

        if not plan:
            self.stdout.write(self.style.WARNING('Nada que revertir.'))
            return

        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO(f'Se revertirá en el reto "{challenge.title}" (id={challenge.id}):'))
        for user, subs in plan:
            self.stdout.write(
                f' - {user.username} ({user.name or user.username}): {len(subs)} evidencia(s) aprobada(s)'
                ' -> pendiente, puntos a 0, medalla eliminada'
            )

        if not options['yes'] and input('¿Continuar? (s/N): ').strip().lower() != 's':
            self.stdout.write(self.style.WARNING('Cancelado.'))
            return

        for user, subs in plan:
            Medal.objects.filter(challenge=challenge, user=user).delete()
            ids = [s.id for s in subs]
            ChallengeSubmission.objects.filter(id__in=ids).update(
                status='pending', points_awarded=0, reviewed_at=None, review_comment=''
            )
            self.stdout.write(self.style.SUCCESS(f'Reversión completada para {user.username}.'))

        self.stdout.write(self.style.SUCCESS('Listo.'))
