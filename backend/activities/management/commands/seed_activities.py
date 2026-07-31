from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from activities.models import Activity

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

class Command(BaseCommand):
    help = 'Siembra las 15 actividades deportivas estándar'

    def handle(self, *args, **options):
        User = get_user_model()
        supervisor = User.objects.filter(role='supervisor').first()
        if not supervisor:
            supervisor = User.objects.filter(is_superuser=True).first()
        if not supervisor:
            self.stderr.write('No hay supervisor ni superusuario; crea uno primero.')
            return

        created = 0
        for name in DEFAULT_ACTIVITIES:
            _, was_created = Activity.objects.get_or_create(name=name)
            if was_created:
                created += 1

        total = Activity.objects.count()
        self.stdout.write(self.style.SUCCESS(f'{created} actividades nuevas sembradas. Total en la lista: {total}'))
