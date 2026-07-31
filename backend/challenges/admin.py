from django.contrib import admin
from .models import Challenge, ChallengeSubmission, Medal

admin.site.register(Challenge)
admin.site.register(ChallengeSubmission)
admin.site.register(Medal)
