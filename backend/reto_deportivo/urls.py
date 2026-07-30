from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.generic import TemplateView

@require_GET
def api_root(request):
    return JsonResponse({
        'name': 'Reto Deportivo API',
        'version': '1.0.0',
        'endpoints': {
            'auth': '/api/auth/',
            'sports': '/api/sports/',
            'activities': '/api/activities/',
            'points': '/api/points/',
            'admin': '/admin/',
        }
    })

api_patterns = [
    path('api/auth/', include('accounts.urls')),
    path('api/sports/', include('sports.urls')),
    path('api/activities/', include('activities.urls')),
    path('api/points/', include('points.urls')),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', api_root),
] + api_patterns

# Serve React frontend for all other routes
urlpatterns += [
    re_path(r'^(?!api/|admin/|media/).*', TemplateView.as_view(template_name='index.html')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
