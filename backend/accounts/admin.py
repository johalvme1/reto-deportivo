from django.contrib import admin
from .models import User, Team, TeamInvitation

admin.site.register(User)

class TeamAdmin(admin.ModelAdmin):
    list_display = ['name', 'supervisor', 'member_count', 'created_at']
    search_fields = ['name']

    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = 'Miembros'

admin.site.register(Team, TeamAdmin)

class TeamInvitationAdmin(admin.ModelAdmin):
    list_display = ['team', 'token', 'created_by', 'created_at', 'used_by', 'used_at']
    readonly_fields = ['token', 'created_at', 'used_at']

admin.site.register(TeamInvitation, TeamInvitationAdmin)
