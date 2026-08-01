from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChallengeViewSet, SubmitEvidenceView, ReviewSubmissionView, DeleteSubmissionView, ChallengeSubmissionsView, MySubmissionsView, MedalsView, EvidenceGalleryView

router = DefaultRouter()
router.register(r'', ChallengeViewSet)

urlpatterns = [
    path('evidence/', EvidenceGalleryView.as_view(), name='evidence-gallery'),
    path('medals/', MedalsView.as_view(), name='medals'),
    path('submissions/mine/', MySubmissionsView.as_view(), name='my-submissions'),
    path('submissions/<int:submission_id>/review/', ReviewSubmissionView.as_view(), name='review-submission'),
    path('submissions/<int:submission_id>/', DeleteSubmissionView.as_view(), name='delete-submission'),
    path('<int:challenge_id>/submit/', SubmitEvidenceView.as_view(), name='submit-evidence'),
    path('<int:challenge_id>/submissions/', ChallengeSubmissionsView.as_view(), name='challenge-submissions'),
    path('', include(router.urls)),
]
