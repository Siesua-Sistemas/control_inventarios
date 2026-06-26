import csv
import io
from typing import Any

from fastapi import Response


def csv_response(filename: str, headers: list[str], rows: list[list[Any]]) -> Response:
    """Construye una respuesta CSV (UTF-8 con BOM, para Excel) lista para descargar."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(rows)
    return Response(
        content='﻿' + buffer.getvalue(),
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )
