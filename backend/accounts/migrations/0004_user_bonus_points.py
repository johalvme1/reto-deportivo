from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_user_is_approved'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='bonus_points',
            field=models.DecimalField(decimal_places=1, default=0, help_text='Puntos manuales que suman al ranking sin estar ligados a un reto', max_digits=6),
        ),
    ]
