from rest_framework import serializers
from .models import Challenge, ChallengeSubmission

class ChallengeSerializer(serializers.ModelSerializer):
    submissions_count = serializers.SerializerMethodField()
    user_submission = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = ['id', 'title', 'description', 'points', 'active', 'created_by', 'created_at', 'submissions_count', 'user_submission']
        read_only_fields = ['created_by', 'created_at']

    def get_submissions_count(self, obj):
        return obj.submissions.count()

    def get_user_submission(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        sub = obj.submissions.filter(user=request.user).first()
        if not sub:
            return None
        return {
            'id': sub.id,
            'status': sub.status,
            'image': sub.image.url if sub.image else None,
            'video': sub.video.url if sub.video else None,
            'points': obj.points if sub.status == 'approved' else 0,
        }

class ChallengeSubmissionSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    challenge_title = serializers.CharField(source='challenge.title', read_only=True)
    challenge_points = serializers.IntegerField(source='challenge.points', read_only=True)

    class Meta:
        model = ChallengeSubmission
        fields = ['id', 'challenge', 'challenge_title', 'challenge_points', 'user', 'user_name', 'image', 'video', 'status', 'created_at']
        read_only_fields = ['user', 'status', 'created_at']
