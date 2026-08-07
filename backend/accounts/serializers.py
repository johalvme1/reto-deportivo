import re
from rest_framework import serializers
from .models import User, Team

def generate_username(email, name=''):
    base = name or email.split('@')[0]
    base = re.sub(r'[^a-zA-Z0-9._@+-]', '', base).lower()
    if not base:
        base = 'user'
    username = base
    counter = 1
    while User.objects.filter(username=username).exists():
        counter += 1
        username = f'{base}{counter}'
    return username

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    username = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'email', 'password', 'role']

    def create(self, validated_data):
        email = validated_data.get('email', '')
        name = validated_data.get('name', '')
        user = User.objects.create_user(
            username=generate_username(email, name),
            email=email,
            password=validated_data['password'],
            name=name,
        )
        user.is_approved = False
        user.save(update_fields=['is_approved'])
        return user

class TeamSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    supervisor_name = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ['id', 'name', 'supervisor', 'supervisor_name', 'member_count', 'created_at']
        read_only_fields = ['id', 'supervisor', 'created_at']

    def get_member_count(self, obj):
        return obj.members.count()

    def get_supervisor_name(self, obj):
        return obj.supervisor.name if obj.supervisor_id else None

class UserSerializer(serializers.ModelSerializer):
    team = serializers.PrimaryKeyRelatedField(read_only=True)
    team_name = serializers.SerializerMethodField()
    supervised_team_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'email', 'role', 'avatar', 'is_superuser', 'is_approved', 'date_joined', 'team', 'team_name', 'supervised_team_name']

    def get_team_name(self, obj):
        return obj.team.name if obj.team_id else None

    def get_supervised_team_name(self, obj):
        team = getattr(obj, 'supervised_team', None)
        return team.name if team else None
