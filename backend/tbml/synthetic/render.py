"""Render an `Invoice` to PDF through one of the Jinja2 HTML templates and WeasyPrint."""

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from tbml.schemas import Invoice

TEMPLATE_DIR = Path(__file__).parent / "templates"

DATE_FORMATS = {"classic": "%d %B %Y", "modern": "%Y-%m-%d", "trade": "%d/%m/%Y"}
SYNTHETIC_NOTICE = (
    "SYNTHETIC TEST DOCUMENT: all companies, people and addresses are fictional. "
    "Generated for software testing; not a real invoice."
)


def fmt_qty(v: float) -> str:
    return f"{v:,.0f}" if float(v).is_integer() else f"{v:,.1f}"


def fmt_price(v: float) -> str:
    return f"{v:,.2f}" if v >= 10 else f"{v:.4f}" if v >= 0.01 else f"{v:.6f}"


def fmt_money(v: float) -> str:
    return f"{v:,.2f}"


_env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    undefined=StrictUndefined,
    autoescape=True,
)
_env.filters.update(qty=fmt_qty, price=fmt_price, money=fmt_money)


def render_html(invoice: Invoice, template: str) -> str:
    return _env.get_template(f"{template}.html").render(
        inv=invoice,
        date=invoice.invoice_date.strftime(DATE_FORMATS[template]),
        notice=SYNTHETIC_NOTICE,
    )


def render_pdf(invoice: Invoice, template: str, out_path: Path) -> None:
    from weasyprint import HTML

    HTML(string=render_html(invoice, template), base_url=str(TEMPLATE_DIR)).write_pdf(out_path)
