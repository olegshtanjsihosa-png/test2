from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lms', '0004_result'),
    ]

    operations = [
        migrations.AddField(
            model_name='characteristicvalue',
            name='value_image',
            field=models.ImageField(upload_to='characteristic_images/', null=True, blank=True, verbose_name='фото'),
        ),
    ]
