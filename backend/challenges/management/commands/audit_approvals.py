from django.core.management.base import BaseCommand
from django.db.models import Count
from challenges.models import ChallengeSubmission, Medal, ChallengeCompletion


class Command(BaseCommand):
    help = 'Audita aprobaciones de evidencias de retos para detectar aprobaciones sospechosas'

    def handle(self, *args, **options):
        self.stdout.write(self.style.HTTP_INFO('=== 1. EVIDENCIAS APROBADAS (detalle) ==='))
        approved = ChallengeSubmission.objects.filter(status='approved').select_related('user', 'challenge').order_by('challenge_id', 'user_id')
        for s in approved:
            flags = []
            if s.points_awarded == 0:
                flags.append('PTS=0')
            if s.reviewed_at is None:
                flags.append('SIN_FECHA_REVISION')
            line = (
                f'{s.challenge_id} | {s.challenge.title} | user={s.user.username} ({s.user.name}) '
                f'| pts={s.points_awarded} | reviewed={s.reviewed_at} | creada={s.created_at} '
                f'| comentario={s.review_comment or ""!r}'
            )
            if flags:
                line += '  <<< ' + ', '.join(flags)
            self.stdout.write(line)

        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO('=== 2. VARIAS EVIDENCIAS APROBADAS EN EL MISMO RETO/USUARIO ==='))
        dups = (
            approved.values('user', 'challenge')
            .annotate(n=Count('id'))
            .filter(n__gt=1)
        )
        for d in dups:
            self.stdout.write(f'user_id={d["user"]} challenge_id={d["challenge"]} aprobadas={d["n"]}')
        if not dups:
            self.stdout.write('(ninguno)')

        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO('=== 3. MEDALLAS ==='))
        for m in Medal.objects.select_related('user', 'challenge').order_by('challenge_id', 'user_id'):
            has_approved = approved.filter(challenge=m.challenge, user=m.user).exists()
            flag = '' if has_approved else '  <<< MEDALLA SIN EVIDENCIA APROBADA'
            self.stdout.write(f'user={m.user.username} | {m.challenge.title} | {m.awarded_at}{flag}')

        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO('=== 4. EVIDENCIAS APROBADAS SIN MEDALLA ==='))
        orphans = [s for s in approved if not Medal.objects.filter(challenge=s.challenge, user=s.user).exists()]
        for s in orphans:
            self.stdout.write(f'user={s.user.username} | {s.challenge.title} | pts={s.points_awarded}')
        if not orphans:
            self.stdout.write('(ninguna)')

        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO('=== 5. SOLICITUDES DE COMPLETADO ==='))
        for c in ChallengeCompletion.objects.select_related('user', 'challenge').order_by('challenge_id', 'user_id'):
            self.stdout.write(
                f'user={c.user.username} | {c.challenge.title} | status={c.status} '
                f'| msg={c.message or ""!r} | {c.requested_at}'
            )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=== RESUMEN ==='))
        self.stdout.write(f'Aprobadas: {approved.count()}')
        self.stdout.write(f'Medallas: {Medal.objects.count()}')
        self.stdout.write(f'Solicitudes completado: {ChallengeCompletion.objects.count()}')
