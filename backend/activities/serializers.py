from rest_framework import serializers
from .models import Activity

class ActivitySerializer(serializers.ModelSerializer):
    sport_name = serializers.CharField(source='sport.name', read_only=True, default=None)

    class Meta:
        model = Activity
        fields = ['id', 'sport', 'sport_name', 'name', 'description', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['created_by', 'created_at', 'updated_at']
        extra_kwargs = {'sport': {'required': False}}
