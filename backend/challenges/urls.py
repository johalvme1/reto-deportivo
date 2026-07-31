from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChallengeViewSet, SubmitEvidenceView, ReviewSubmissionView, ChallengeSubmissionsView, MySubmissionsView

router = DefaultRouter()
router.register(r'', ChallengeViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('<int:challenge_id>/submit/', SubmitEvidenceView.as_view(), name='submit-evidence'),
    path('<int:challenge_id>/submissions/', ChallengeSubmissionsView.as_view(), name='challenge-submissions'),
    path('submissions/mine/', MySubmissionsView.as_view(), name='my-submissions'),
    path('submissions/<int:submission_id>/review/', ReviewSubmissionView.as_view(), name='review-submission'),
]
