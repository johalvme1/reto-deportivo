from django.urls import path
from .views import ChatView, ChatReadView, ChatUnreadView

urlpatterns = [
    path('', ChatView.as_view(), name='chat'),
    path('read/', ChatReadView.as_view(), name='chat-read'),
    path('unread/', ChatUnreadView.as_view(), name='chat-unread'),
]
