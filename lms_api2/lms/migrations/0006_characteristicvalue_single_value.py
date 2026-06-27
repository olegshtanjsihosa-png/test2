from django.db import migrations, models


def migrate_values(apps, schema_editor):
    CharacteristicValue = apps.get_model('lms', 'CharacteristicValue')

    for item in CharacteristicValue.objects.all():
        value = ''

        if item.value_text not in (None, ''):
            value = item.value_text
        elif item.value_integer is not None:
            value = str(item.value_integer)
        elif item.value_boolean is not None:
            value = 'true' if item.value_boolean else 'false'
        elif item.value_formula not in (None, ''):
            value = item.value_formula
        elif item.value_image:
            value = item.value_image.name

        item.value = value
        item.save(update_fields=['value'])


class Migration(migrations.Migration):

    dependencies = [
        ('lms', '0005_add_value_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='characteristicvalue',
            name='value',
            field=models.TextField(blank=True, default='', verbose_name='значение'),
        ),
        migrations.RunPython(migrate_values, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='characteristicvalue',
            name='value_text',
        ),
        migrations.RemoveField(
            model_name='characteristicvalue',
            name='value_integer',
        ),
        migrations.RemoveField(
            model_name='characteristicvalue',
            name='value_boolean',
        ),
        migrations.RemoveField(
            model_name='characteristicvalue',
            name='value_formula',
        ),
        migrations.RemoveField(
            model_name='characteristicvalue',
            name='value_image',
        ),
    ]
