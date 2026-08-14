import os
import shutil
import uuid

from django.conf import settings
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PendingUpload

MAX_TOTAL = 500 * 1024 * 1024  # 500 MiB upper bound per file


def claim_pending(upload_id):
    """Move a completed PendingUpload into MEDIA_ROOT and return its relative name.

    Returns None if the upload id is missing, unknown or not completed.
    """
    if not upload_id:
        return None
    try:
        pending = PendingUpload.objects.get(id=upload_id, completed=True)
    except PendingUpload.DoesNotExist:
        return None

    src = settings.MEDIA_ROOT / pending.staging_name
    if not src.exists():
        pending.delete()
        return None

    ext = os.path.splitext(pending.original_name)[1].lower()
    dest_name = f'uploads/{uuid.uuid4().hex}{ext}'
    dest_path = settings.MEDIA_ROOT / dest_name
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dest_path))
    pending.delete()
    return dest_name


def resolve_field(request, field):
    """Return (raw_file, dest_name) for a model field, using a direct upload or a chunked one."""
    raw = request.FILES.get(field)
    dest = claim_pending(request.data.get(f'{field}_upload_id'))
    return raw, dest


class UploadInitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        filename = (request.data.get('filename') or '').strip()
        try:
            size = int(request.data.get('size') or 0)
            total_parts = int(request.data.get('total_parts') or 0)
        except (TypeError, ValueError):
            return Response({'error': 'Datos de subida inválidos'}, status=status.HTTP_400_BAD_REQUEST)

        if not filename or size <= 0 or total_parts <= 0 or size > MAX_TOTAL or total_parts > 1000:
            return Response({'error': 'Datos de subida inválidos'}, status=status.HTTP_400_BAD_REQUEST)

        pending = PendingUpload.objects.create(
            original_name=filename[:255],
            size=size,
            total_parts=total_parts,
            staging_name=f'pending/{uuid.uuid4().hex}.part',
        )
        return Response({'upload_id': str(pending.id)}, status=status.HTTP_201_CREATED)


class UploadPartView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, upload_id):
        try:
            pending = PendingUpload.objects.get(id=upload_id)
        except PendingUpload.DoesNotExist:
            return Response({'error': 'Subida no encontrada'}, status=status.HTTP_404_NOT_FOUND)

        if pending.completed:
            return Response({'error': 'La subida ya fue completada'}, status=status.HTTP_400_BAD_REQUEST)
        if pending.parts_received >= pending.total_parts:
            return Response({'error': 'Ya se recibieron todas las partes'}, status=status.HTTP_400_BAD_REQUEST)

        part = request.FILES.get('part')
        if not part:
            return Response({'error': 'Falta la parte'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            offset = int(request.data.get('offset') or 0)
        except (TypeError, ValueError):
            return Response({'error': 'offset inválido'}, status=status.HTTP_400_BAD_REQUEST)

        path = settings.MEDIA_ROOT / pending.staging_name
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.touch()
        with open(path, 'r+b') as f:
            f.seek(offset)
            for chunk in part.chunks():
                f.write(chunk)

        pending.parts_received += 1
        pending.save()
        return Response({'parts_received': pending.parts_received, 'total_parts': pending.total_parts})


class UploadCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, upload_id):
        try:
            pending = PendingUpload.objects.get(id=upload_id)
        except PendingUpload.DoesNotExist:
            return Response({'error': 'Subida no encontrada'}, status=status.HTTP_404_NOT_FOUND)

        if pending.parts_received < pending.total_parts:
            return Response(
                {'error': f'Faltan partes: {pending.parts_received}/{pending.total_parts}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        path = settings.MEDIA_ROOT / pending.staging_name
        if not path.exists() or os.path.getsize(path) != pending.size:
            return Response({'error': 'El archivo no coincide con el tamaño esperado'}, status=status.HTTP_400_BAD_REQUEST)

        pending.completed = True
        pending.save()
        return Response({'upload_id': str(pending.id), 'name': pending.original_name, 'size': pending.size})
