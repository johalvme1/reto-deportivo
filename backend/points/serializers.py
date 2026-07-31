from rest_framework import serializers
from .models import DailyPoint

class DailyPointSerializer(serializers.ModelSerializer):
    activity_name = serializers.CharField(source='activity.name', read_only=True, default=None)
    sport_name = serializers.CharField(source='activity.sport.name', read_only=True, default=None)
    points = serializers.IntegerField(read_only=True)

    class Meta:
        model = DailyPoint
        fields = ['id', 'user', 'date', 'image', 'steps', 'activity', 'activity_name', 'sport_name', 'points', 'created_at']
        read_only_fields = ['user', 'created_at']
