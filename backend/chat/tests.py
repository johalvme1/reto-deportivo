from django.contrib.auth import get_user_model
from django.test import TestCase
from chat.models import ChatMessage
from chat.views import visible_messages

User = get_user_model()


class ChatVisibilityTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username='a', role='participant', name='Ana')
        self.b = User.objects.create_user(username='b', role='participant', name='Beto')
        self.sup = User.objects.create_user(username='sup', role='supervisor', is_staff=True, name='Sup')

    def test_private_message_only_visible_to_recipient(self):
        private = ChatMessage.objects.create(user=self.sup, recipient=self.a, text='Solo Ana')
        global_msg = ChatMessage.objects.create(user=self.sup, text='Todos')
        self.assertIn(private, visible_messages(self.a))
        self.assertNotIn(private, visible_messages(self.b))
        self.assertNotIn(private, visible_messages(self.sup))
        self.assertIn(global_msg, visible_messages(self.a))
        self.assertIn(global_msg, visible_messages(self.b))