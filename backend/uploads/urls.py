from django.urls import path

from .views import UploadCompleteView, UploadInitView, UploadPartView

urlpatterns = [
    path('', UploadInitView.as_view(), name='upload-init'),
    path('<uuid:upload_id>/parts/', UploadPartView.as_view(), name='upload-part'),
    path('<uuid:upload_id>/complete/', UploadCompleteView.as_view(), name='upload-complete'),
]
