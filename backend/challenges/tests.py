from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from challenges.models import Challenge, ChallengeSubmission, ChallengeExpiryNotice
from challenges.views import send_expired_challenge_notices
from chat.models import ChatMessage

User = get_user_model()


class ChallengeExpiryTests(TestCase):
    def setUp(self):
        self.supervisor = User.objects.create_user(
            username='sup', role='supervisor', is_staff=True, name='Supervisor')
        self.participant = User.objects.create_user(
            username='par', role='participant', name='Participante')
        self.challenge = Challenge.objects.create(
            title='Reto vencido',
            created_by=self.supervisor,
            end_date=timezone.now() - timedelta(days=1),
        )

    def test_notice_sent_and_message_created(self):
        send_expired_challenge_notices(self.participant)
        self.assertTrue(ChallengeExpiryNotice.objects.filter(
            user=self.participant, challenge=self.challenge).exists())
        self.assertEqual(ChatMessage.objects.count(), 1)
        msg = ChatMessage.objects.first()
        self.assertEqual(msg.user, self.supervisor)
        self.assertIn('Reto vencido', msg.text)
        self.assertIn('no enviaste ninguna evidencia', msg.text)

    def test_notice_not_sent_twice(self):
        send_expired_challenge_notices(self.participant)
        send_expired_challenge_notices(self.participant)
        self.assertEqual(ChatMessage.objects.count(), 1)

    def test_no_notice_when_evidence_exists(self):
        ChallengeSubmission.objects.create(
            user=self.participant, challenge=self.challenge, status='pending')
        send_expired_challenge_notices(self.participant)
        self.assertFalse(ChallengeExpiryNotice.objects.filter(
            user=self.participant, challenge=self.challenge).exists())
        self.assertEqual(ChatMessage.objects.count(), 0)

    def test_hidden_field(self):
        from challenges.serializers import ChallengeSerializer
        now = timezone.now()
        data = ChallengeSerializer(
            self.challenge, context={'request': None}).data
        self.assertFalse(data['hidden'])

        class FakeRequest:
            user = self.participant
            is_authenticated = True

        data = ChallengeSerializer(
            self.challenge, context={'request': FakeRequest}).data
        self.assertTrue(data['hidden'])

        class FakeSupervisor:
            user = self.supervisor
            is_authenticated = True

        data = ChallengeSerializer(
            self.challenge, context={'request': FakeSupervisor}).data
        self.assertFalse(data['hidden'])

        self.challenge.end_date = now + timedelta(days=1)
        self.challenge.save()
        data = ChallengeSerializer(
            self.challenge, context={'request': FakeRequest}).data
        self.assertFalse(data['hidden'])

    def test_hidden_false_when_submission_pending(self):
        from challenges.serializers import ChallengeSerializer
        ChallengeSubmission.objects.create(
            user=self.participant, challenge=self.challenge, status='pending')

        class FakeRequest:
            user = self.participant
            is_authenticated = True

        data = ChallengeSerializer(
            self.challenge, context={'request': FakeRequest}).data
        self.assertFalse(data['hidden'])

    def test_not_hidden_when_deactivated_before_end_date(self):
        from challenges.serializers import ChallengeSerializer
        self.challenge.end_date = timezone.now() + timedelta(days=1)
        self.challenge.active = False
        self.challenge.save()

        class FakeRequest:
            user = self.participant
            is_authenticated = True

        data = ChallengeSerializer(
            self.challenge, context={'request': FakeRequest}).data
        self.assertFalse(data['hidden'])

    def test_hidden_true_when_rejected_finished(self):
        from challenges.serializers import ChallengeSerializer
        ChallengeSubmission.objects.create(
            user=self.participant, challenge=self.challenge, status='rejected')

        class FakeRequest:
            user = self.participant
            is_authenticated = True

        data = ChallengeSerializer(
            self.challenge, context={'request': FakeRequest}).data
        self.assertTrue(data['hidden'])
