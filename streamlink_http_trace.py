import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit

import requests
from streamlink.session.http import HTTPSession
from streamlink_cli.main import main


def log_http_event(event, method, url, elapsed_ms, status=None, error=None):
    parsed = urlsplit(url)
    path = re.sub(r"/[0-9a-fA-F-]{16,}(?=/|$)", "/[id]", parsed.path)
    path = re.sub(r"/(programs|slots|channel)/[^/]+", r"/\1/[id]", path)
    timestamp = datetime.now(timezone.utc).astimezone().isoformat(timespec="milliseconds")
    details = f"status={status}" if status is not None else f"error={error}"
    print(
        f"[HTTP診断] {timestamp} event={event} method={method} "
        f"host={parsed.hostname or 'unknown'} path={path} "
        f"elapsedMs={elapsed_ms:.1f} {details}",
        file=sys.stderr,
        flush=True,
    )


original_send = requests.Session.send


def traced_send(session, request, **kwargs):
    started = time.monotonic()
    try:
        response = original_send(session, request, **kwargs)
    except Exception as error:
        log_http_event(
            "transport-error",
            request.method,
            request.url,
            (time.monotonic() - started) * 1000,
            error=type(error).__name__,
        )
        raise
    log_http_event(
        "response-headers",
        request.method,
        response.url,
        (time.monotonic() - started) * 1000,
        status=response.status_code,
    )
    return response


requests.Session.send = traced_send

original_request = HTTPSession.request


def traced_request(session, method, url, *args, **kwargs):
    started = time.monotonic()
    try:
        response = original_request(session, method, url, *args, **kwargs)
    except Exception as error:
        log_http_event(
            "request-error",
            method,
            url,
            (time.monotonic() - started) * 1000,
            error=type(error).__name__,
        )
        raise
    log_http_event(
        "request-complete",
        method,
        response.url,
        (time.monotonic() - started) * 1000,
        status=response.status_code,
    )
    return response


HTTPSession.request = traced_request

sys.argv = ["streamlink", *sys.argv[1:]]
main()
