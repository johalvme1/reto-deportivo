from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import ChatMessage
from .serializers import ChatMessageSerializer

class ChatView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = ChatMessage.objects.select_related('user').order_by('-created_at')[:100]
        messages = list(reversed(qs))
        return Response(ChatMessageSerializer(messages, many=True).data)

    def post(self, request):
        text = request.data.get('text', '')
        if not isinstance(text, str) or not text.strip():
            return Response({'error': 'El mensaje no puede estar vacío'}, status=status.HTTP_400_BAD_REQUEST)
        text = text.strip()[:1000]
        message = ChatMessage.objects.create(user=request.user, text=text)
        return Response(ChatMessageSerializer(message).data, status=status.HTTP_201_CREATED)
