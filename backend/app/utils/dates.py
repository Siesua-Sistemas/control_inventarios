import calendar
from datetime import date


def add_months(d: date, months: int) -> date:
    """Suma `months` meses calendario a `d`, recortando el día al último día del mes destino."""
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    day = min(d.day, last_day)
    return date(year, month, day)
