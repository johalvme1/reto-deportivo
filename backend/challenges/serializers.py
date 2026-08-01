from rest_framework import serializers
from .models import Challenge, ChallengeSubmission, Medal

class ChallengeSerializer(serializers.ModelSerializer):
    submissions_count = serializers.SerializerMethodField()
    user_submission = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = ['id', 'title', 'description', 'points', 'video', 'start_date', 'end_date', 'active', 'is_active', 'created_by', 'created_at', 'submissions_count', 'user_submission']
        read_only_fields = ['created_by', 'created_at']

    def get_is_active(self, obj):
        return obj.effective_active()

    def get_submissions_count(self, obj):
        return obj.submissions.count()

    def get_user_submission(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        subs = obj.submissions.filter(user=request.user).order_by('-created_at')
        if not subs.exists():
            return None
        approved = [s for s in subs if s.status == 'approved']
        return {
            'count': subs.count(),
            'active_count': subs.exclude(status='rejected').count(),
            'max': 3,
            'total_points': sum(s.points_awarded for s in approved),
            'submissions': [{
                'id': s.id,
                'status': s.status,
                'points_awarded': s.points_awarded,
                'review_comment': s.review_comment or '',
                'image': s.image.url if s.image else None,
                'video': s.video.url if s.video else None,
                'created_at': s.created_at.isoformat(),
            } for s in subs],
        }

class ChallengeSubmissionSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    challenge_title = serializers.CharField(source='challenge.title', read_only=True)
    challenge_points = serializers.IntegerField(source='challenge.points', read_only=True)

    class Meta:
        model = ChallengeSubmission
        fields = ['id', 'challenge', 'challenge_title', 'challenge_points', 'user', 'user_name', 'image', 'video', 'status', 'points_awarded', 'review_comment', 'reviewed_at', 'created_at']
        read_only_fields = ['user', 'status', 'created_at']

class MedalSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    challenge_title = serializers.CharField(source='challenge.title', read_only=True)
    challenge_points = serializers.SerializerMethodField()

    class Meta:
        model = Medal
        fields = ['id', 'user', 'user_name', 'challenge', 'challenge_title', 'challenge_points', 'awarded_at']

    def get_challenge_points(self, obj):
        return sum(
            s.points_awarded for s in obj.challenge.submissions.filter(user=obj.user, status='approved')
        )
