from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models import Max, F, Count, Q, Sum, Case, When, Value, DecimalField
from challenges.models import ChallengeSubmission
from points.models import DailyPoint

User = get_user_model()


class Command(BaseCommand):
    help = (
        'Reconciliacion de puntos: muestra por participante los retos aprobados por el supervisor '
        'y compara los puntos correctos (challenge.points una vez) con lo almacenado (points_awarded). '
        'Con --apply corrige points_awarded en las evidencias aprobadas.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Corrige points_awarded de las evidencias aprobadas al valor del reto')

    def handle(self, *args, **options):
        apply = options['apply']

        self.stdout.write(self.style.HTTP_INFO('=== PUNTOS DE RETOS APROBADOS POR SUPERVISOR (una vez por participante+reto) ==='))
        self.stdout.write(f'{"participante":<22} {"reto":<26} {"pts_correctos":>13} {"pts_guardados":>13} {"estado":>10}')
        self.stdout.write('-' * 88)

        rows = []
        for s in ChallengeSubmission.objects.filter(status='approved').select_related('user', 'challenge').order_by('user_id', 'challenge_id'):
            rows.append({
                'user': s.user,
                'username': s.user.username,
                'name': s.user.name or s.user.username,
                'challenge': s.challenge.title,
                'correct': s.challenge.points,
                'stored': s.points_awarded,
                'sub_id': s.id,
            })

        fixed = 0
        dupes = {}
        for r in rows:
            ok = r['stored'] == r['correct']
            state = 'OK' if ok else 'CATCH UP'
            self.stdout.write(
                f'{r["name"]:<22} {r["challenge"]:<26} {r["correct"]:>13} {r["stored"]:>13} {state:>10}'
            )
            if apply and not ok:
                ChallengeSubmission.objects.filter(id=r['sub_id']).update(points_awarded=r['correct'])
                fixed += 1
            dupes.setdefault((r['username'], r['challenge']), 0)
            dupes[(r['username'], r['challenge'])] += 1

        if apply:
            self.stdout.write(self.style.SUCCESS(f'\nActualizadas: {fixed} evidencia(s) aprobadas (points_awarded = challenge.points)'))

        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO('=== EVIDENCIAS APROBADADAS DUPLICADAS (mismo participante+reto) ==='))
        any_dup = False
        for (username, challenge), n in dupes.items():
            if n > 1:
                any_dup = True
                self.stdout.write(f'{username} | {challenge} | aprobadas={n}')
        if not any_dup:
            self.stdout.write('(ninguna)')

        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO('=== PUNTOS DIARIOS POR PARTICIPANTE (evidencias, pasos, actividades) ==='))
        daily = (
            DailyPoint.objects.values('user', 'user__name', 'user__username')
            .annotate(
                images=Count('pk', filter=Q(image__isnull=False) & ~Q(image='') | Q(video__isnull=False) & ~Q(video='')),
                steps_pts=Sum(
                    Case(
                        When(steps__gte=5000, then=Value(1)),
                        When(steps__gte=3000, then=Value(0.5)),
                        default=Value(0),
                        output_field=DecimalField(max_digits=10, decimal_places=2),
                    ),
                    filter=Q(steps__isnull=False) & Q(steps_image__isnull=False),
                ),
                activities=Count('pk', filter=Q(activity__isnull=False)),
            )
        )
        self.stdout.write(f'{"participante":<22} {"evidencias":>10} {"pts_pasos":>10} {"actividades":>11} {"total_diario":>12}')
        self.stdout.write('-' * 68)
        for d in daily.order_by('user'):
            name = d['user__name'] or d['user__username']
            total = float(d['images'] or 0) + float(d['steps_pts'] or 0) + float(d['activities'] or 0)
            self.stdout.write(
                f'{name:<22} {d["images"]:>10} {d["steps_pts"] or 0:>10} {d["activities"]:>11} {total:>12}'
            )
        if not daily:
            self.stdout.write('(sin puntos diarios)')

        if not rows and not daily:
            self.stdout.write(self.style.WARNING('\nNo hay datos registrados.'))
