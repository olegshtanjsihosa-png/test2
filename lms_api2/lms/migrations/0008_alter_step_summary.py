from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lms', '0007_step_summary'),
    ]

    operations = [
        migrations.AlterField(
            model_name='step',
            name='summary',
            field=models.TextField(blank=True, default='', verbose_name='итог'),
        ),
    ]
