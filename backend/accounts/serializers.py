import re
from rest_framework import serializers
from .models import User

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
        return user

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'email', 'role', 'avatar', 'is_superuser']
