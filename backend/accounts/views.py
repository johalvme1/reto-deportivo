from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from .models import User
from .serializers import RegisterSerializer, UserSerializer
from .permissions import is_supervisor_user

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_supervisor_user(request.user)

class IsSuperuser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superuser

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
            return Response(UserSerializer(user).data)
        elif action == 'reject':
            user.delete()
            return Response({'detail': 'Solicitud eliminada'}, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Acción inválida'}, status=status.HTTP_400_BAD_REQUEST)

class UsersListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperuser]

    def get(self, request):
        users = User.objects.order_by('name', 'username')
        return Response(UserSerializer(users, many=True).data)

class DeleteUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperuser]

    def post(self, request):
        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(id=user_id)
        except (User.DoesNotExist, TypeError, ValueError):
            return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        if user.id == request.user.id:
            return Response({'error': 'No puedes eliminarte a ti mismo'}, status=status.HTTP_400_BAD_REQUEST)
        if user.is_superuser:
            return Response({'error': 'No se puede eliminar un superusuario'}, status=status.HTTP_400_BAD_REQUEST)
        if user.role == 'supervisor':
            return Response({'error': 'No se puede eliminar otro supervisor'}, status=status.HTTP_400_BAD_REQUEST)
        if user.activity_set.exists():
            return Response({'error': 'No se puede eliminar a este usuario porque creó actividades'}, status=status.HTTP_400_BAD_REQUEST)

        user.delete()
        return Response({'detail': 'Usuario eliminado'}, status=status.HTTP_200_OK)

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

class PasswordResetRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request):
        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(id=user_id)
        except (User.DoesNotExist, TypeError, ValueError):
            return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        token = PasswordResetTokenGenerator().make_token(user)
        scheme = 'https' if request.is_secure() else 'http'
        reset_url = f'{scheme}://{request.get_host()}/reset-password?token={token}&user={user.id}'
        return Response({'reset_url': reset_url})

class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user_id = request.data.get('user_id')
        token = request.data.get('token')
        password = request.data.get('password')
        if not user_id or not token or not password:
            return Response({'error': 'Faltan datos para restablecer la contraseña'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=user_id)
        except (User.DoesNotExist, TypeError, ValueError):
            return Response({'error': 'Enlace inválido o expirado'}, status=status.HTTP_400_BAD_REQUEST)

        if not PasswordResetTokenGenerator().check_token(user, token):
            return Response({'error': 'Enlace inválido o expirado'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Contraseña actualizada. Ya puedes iniciar sesión.'})
