import mimetypes
import os
from urllib.parse import unquote

from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound, StreamingHttpResponse

CHUNK_SIZE = 65536


def media_stream_url(field):
    """Return a range-capable /stream/ URL for a media FileField (or None)."""
    if not field:
        return None
    url = field.url
    if url.startswith(settings.MEDIA_URL):
        return settings.MEDIA_STREAM_URL + url[len(settings.MEDIA_URL):]
    return url


def _safe_path(path):
    path = unquote(path).replace('\\', '/')
    root = os.path.realpath(settings.MEDIA_ROOT)
    full = os.path.realpath(os.path.join(root, path))
    try:
        if os.path.commonpath([full, root]) != root:
            return None
    except ValueError:
        return None
    if not os.path.isfile(full):
        return None
    return full


def _normalize_range(size, start, end):
    if start is None:
        length = min(end or 0, size)
        start = max(0, size - length)
        end = size - 1
    else:
        if start >= size:
            return None
        if end is None or end >= size:
            end = size - 1
        if end < start:
            return None
    return start, end


def _chunks(full, start, length):
    with open(full, 'rb') as f:
        f.seek(start)
        remaining = length
        while remaining > 0:
            chunk = f.read(min(CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


def stream_media(request, path):
    full = _safe_path(path)
    if not full:
        return HttpResponseNotFound('Archivo no encontrado')

    size = os.path.getsize(full)
    content_type = mimetypes.guess_type(full)[0] or 'application/octet-stream'
    range_header = request.headers.get('Range', '')

    if range_header:
        try:
            unit, spec = range_header.split('=', 1)
            if unit != 'bytes' or ',' in spec:
                raise ValueError
            start_s, end_s = spec.split('-', 1)
            start = int(start_s) if start_s else None
            end = int(end_s) if end_s else None
        except ValueError:
            return HttpResponse(status=416, headers={'Content-Range': f'bytes */{size}'})

        rng = _normalize_range(size, start, end)
        if rng is None:
            return HttpResponse(status=416, headers={'Content-Range': f'bytes */{size}'})
        start, end = rng
        response = StreamingHttpResponse(
            _chunks(full, start, end - start + 1),
            status=206,
            content_type=content_type,
        )
        response['Content-Range'] = f'bytes {start}-{end}/{size}'
        response['Content-Length'] = str(end - start + 1)
        response['Accept-Ranges'] = 'bytes'
        return response

    response = StreamingHttpResponse(_chunks(full, 0, size), content_type=content_type)
    response['Content-Length'] = str(size)
    response['Accept-Ranges'] = 'bytes'
    return response
