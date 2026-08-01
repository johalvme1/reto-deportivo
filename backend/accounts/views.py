from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User
from .serializers import RegisterSerializer, UserSerializer

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.user.role == 'supervisor' or request.user.is_superuser)

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            'message': 'Registro exitoso. Un administrador debe aprobar tu cuenta para que puedas ingresar.',
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        try:
            user = User.objects.get(email=email)
            user = authenticate(username=user.username, password=password)
        except User.DoesNotExist:
            user = None

        if not user:
            return Response({'error': 'Credenciales inválidas'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_approved:
            return Response(
                {'error': 'Tu cuenta aún no ha sido aprobada por el administrador. Intenta más tarde.'},
                status=status.HTTP_403_FORBIDDEN
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            'token': str(refresh.access_token),
            'user': UserSerializer(user).data
        })

class PendingUsersView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        users = User.objects.filter(is_approved=False, is_active=True).order_by('-date_joined')
        return Response(UserSerializer(users, many=True).data)

class ReviewUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request):
        user_id = request.data.get('user_id')
        action = request.data.get('action')
        try:
            user = User.objects.get(id=user_id)
        except (User.DoesNotExist, TypeError, ValueError):
            return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        if action == 'approve':
            user.is_approved = True
            user.is_active = True
            user.save(update_fields=['is_approved', 'is_active'])
        elif action == 'reject':
            user.is_approved = True
            user.is_active = False
            user.save(update_fields=['is_approved', 'is_active'])
        else:
            return Response({'error': 'Acción inválida'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(UserSerializer(user).data)

class ProfileView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def put(self, request):
        user = request.user
        data = request.data
        if 'name' in data:
            user.name = data['name']
        if 'avatar' in data:
            user.avatar = data['avatar']
        user.save()
        return Response(UserSerializer(user).data)
