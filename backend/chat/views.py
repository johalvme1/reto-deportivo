from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from .models import ChatMessage, ChatReadState
from .serializers import ChatMessageSerializer


def get_read_state(user):
    state, _ = ChatReadState.objects.get_or_create(user=user)
    return state


def team_messages_qs(user):
    if user.is_superuser:
        return ChatMessage.objects.all()
    if user.team_id:
        return ChatMessage.objects.filter(Q(team=user.team) | Q(team__isnull=True))
    return ChatMessage.objects.filter(team__isnull=True)


def unread_count_for(state, user):
    return team_messages_qs(user).filter(id__gt=state.last_read_id).count()


class ChatView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = team_messages_qs(request.user).select_related('user').order_by('-created_at')[:100]
        messages = list(reversed(qs))
        state = get_read_state(request.user)
        return Response({
            'messages': ChatMessageSerializer(messages, many=True).data,
            'last_read_id': state.last_read_id,
            'unread_count': unread_count_for(state, request.user),
        })

    def post(self, request):
        text = request.data.get('text', '')
        if not isinstance(text, str) or not text.strip():
            return Response({'error': 'El mensaje no puede estar vacío'}, status=status.HTTP_400_BAD_REQUEST)
        text = text.strip()[:1000]

        team = None if request.user.is_superuser else request.user.team
        if team is None and not request.user.is_superuser:
            return Response({'error': 'Únete a un equipo para participar en el chat'}, status=status.HTTP_400_BAD_REQUEST)

        message = ChatMessage.objects.create(user=request.user, text=text, team=team)

        state = get_read_state(request.user)
        if message.id > state.last_read_id:
            state.last_read_id = message.id
            state.save()

        return Response(ChatMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class ChatReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        raw = request.data.get('last_read_id')
        try:
            last_read_id = int(raw)
        except (TypeError, ValueError):
            return Response({'error': 'last_read_id inválido'}, status=status.HTTP_400_BAD_REQUEST)

        state = get_read_state(request.user)
        if last_read_id > state.last_read_id:
            state.last_read_id = last_read_id
            state.save()
        return Response({'unread_count': unread_count_for(state, request.user)})


class ChatUnreadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        state = get_read_state(request.user)
        return Response({'unread_count': unread_count_for(state, request.user)})
