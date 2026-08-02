# -*- coding: utf-8 -*-
"""
Generador PDF del borrador Contrato Master v2 (docs/01-business/
master-contract-v2-draft.md).

Reutiliza estilos + header/footer del generate_legal_pdfs.py (mismo
look-and-feel que los 10 documentos legales para SegPay).

Parser markdown → reportlab minimalista dedicado a este documento:
soporta headings ##, párrafos numerados con **bold**, bullets con -,
tablas markdown estándar, código `inline`, y bloques citación >.

Uso:
    python ops/legal-pdfs/generate_master_contract_v2_pdf.py
Output:
    .tmp/master-contract-v2-draft.pdf
"""

import os
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether,
)
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
from reportlab.lib import colors


# ----------------------------------------------------------------------
# Estilos (idénticos a generate_legal_pdfs.py para coherencia visual)
# ----------------------------------------------------------------------
COLOR_TITLE = colors.HexColor('#1f2937')
COLOR_BODY = colors.HexColor('#4b5563')
COLOR_MUTED = colors.HexColor('#6b7280')
COLOR_BRAND = colors.HexColor('#1e3a8a')
COLOR_RULE = colors.HexColor('#e5e7eb')
COLOR_WARN_BG = colors.HexColor('#fef3c7')
COLOR_WARN_FG = colors.HexColor('#92400e')

_styles = getSampleStyleSheet()

style_title = ParagraphStyle(
    'DocTitle', parent=_styles['Title'],
    fontName='Helvetica-Bold', fontSize=20, leading=26,
    textColor=COLOR_TITLE, alignment=TA_LEFT, spaceAfter=10,
)
style_intro = ParagraphStyle(
    'DocIntro', parent=_styles['Normal'],
    fontName='Helvetica-Oblique', fontSize=10, leading=15,
    textColor=COLOR_MUTED, alignment=TA_JUSTIFY, spaceAfter=14,
)
style_section = ParagraphStyle(
    'SectionTitle', parent=_styles['Heading2'],
    fontName='Helvetica-Bold', fontSize=12, leading=16,
    textColor=COLOR_TITLE, alignment=TA_LEFT,
    spaceBefore=14, spaceAfter=6, keepWithNext=True,
)
style_body = ParagraphStyle(
    'SectionBody', parent=_styles['Normal'],
    fontName='Helvetica', fontSize=10, leading=15,
    textColor=COLOR_BODY, alignment=TA_JUSTIFY, spaceAfter=6,
)
style_bullet = ParagraphStyle(
    'Bullet', parent=style_body,
    leftIndent=18, firstLineIndent=-12, spaceAfter=3,
)
style_warn = ParagraphStyle(
    'Warn', parent=style_body,
    backColor=COLOR_WARN_BG, textColor=COLOR_WARN_FG,
    borderPadding=8, spaceBefore=8, spaceAfter=12,
)


# ----------------------------------------------------------------------
# Header / Footer (mismo layout que legal_pdfs)
# ----------------------------------------------------------------------
def _draw_header_footer(canvas, doc):
    canvas.saveState()

    # Header
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(COLOR_BRAND)
    canvas.drawString(2.5 * cm, A4[1] - 1.5 * cm, 'SharemeChat®')

    canvas.setFont('Helvetica', 8.5)
    canvas.setFillColor(COLOR_MUTED)
    canvas.drawRightString(
        A4[0] - 2.5 * cm, A4[1] - 1.5 * cm,
        'Contrato Master — v2 (borrador)'
    )

    canvas.setStrokeColor(COLOR_RULE)
    canvas.setLineWidth(0.4)
    canvas.line(2.5 * cm, A4[1] - 1.7 * cm, A4[0] - 2.5 * cm, A4[1] - 1.7 * cm)

    # Footer
    canvas.line(2.5 * cm, 1.9 * cm, A4[0] - 2.5 * cm, 1.9 * cm)

    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(COLOR_MUTED)
    canvas.drawCentredString(
        A4[0] / 2.0, 1.45 * cm,
        'Shareme Technologies OÜ  ·  Registry code 17444422  '
        '·  Lõõtsa tn 5, 11415 Tallinn, Estonia',
    )
    canvas.drawCentredString(
        A4[0] / 2.0, 1.10 * cm,
        'legal@sharemechat.com',
    )
    canvas.drawRightString(
        A4[0] - 2.5 * cm, 0.75 * cm,
        'Página %d' % doc.page,
    )
    canvas.restoreState()


# ----------------------------------------------------------------------
# Parser MD → flowables reportlab
# ----------------------------------------------------------------------
INLINE_BOLD_RE = re.compile(r'\*\*(.+?)\*\*')
INLINE_CODE_RE = re.compile(r'`([^`]+)`')


def _inline_md_to_rl(text):
    """Convierte bold y code inline a HTML mini soportado por Paragraph."""
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;').replace('>', '&gt;')
    # Restaurar entidades que introdujimos
    text = text.replace('&amp;lt;', '&lt;').replace('&amp;gt;', '&gt;')
    text = INLINE_BOLD_RE.sub(r'<b>\1</b>', text)
    text = INLINE_CODE_RE.sub(r'<font face="Courier" size="9">\1</font>', text)
    return text


def _parse_markdown_to_flowables(md_text):
    """Parser específico del contrato v2. Detecta:
    - ## Título → sección
    - > cita → aviso destacado
    - --- → separador (ignoramos, ya hay espaciado)
    - - item / párrafo → bullets vs. párrafos normales
    - | tabla | ... → tabla reportlab
    - # H1 y ### H3 → tratados como sección (mismo estilo).
    """
    flowables = []
    lines = md_text.splitlines()
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i].rstrip()

        # Título nivel 1: preámbulo tipo "# Contrato Master ↔ SharemeChat"
        if line.startswith('# ') and not line.startswith('## '):
            title = line[2:].strip()
            flowables.append(Paragraph(_inline_md_to_rl(title), style_title))
            i += 1
            continue

        # Sección nivel 2
        if line.startswith('## '):
            title = line[3:].strip()
            flowables.append(Paragraph(_inline_md_to_rl(title), style_section))
            i += 1
            continue

        # Sub-heading nivel 3 (dentro de secciones, e.g. "Contenido mínimo del acuerdo")
        if line.startswith('### '):
            title = line[4:].strip()
            flowables.append(Paragraph('<b>' + _inline_md_to_rl(title) + '</b>', style_body))
            i += 1
            continue

        # Separador horizontal
        if line.strip() == '---':
            flowables.append(Spacer(1, 6))
            i += 1
            continue

        # Blockquote / avisos (líneas empezando por >)
        if line.startswith('> '):
            block = []
            while i < n and (lines[i].startswith('> ') or lines[i].startswith('>')):
                block.append(lines[i][2:] if lines[i].startswith('> ') else lines[i][1:])
                i += 1
            joined = ' '.join(bl.strip() for bl in block if bl.strip())
            if joined:
                flowables.append(Paragraph(_inline_md_to_rl(joined), style_warn))
            continue

        # Tabla markdown (pipe-based)
        if line.startswith('|'):
            table_rows = []
            while i < n and lines[i].strip().startswith('|'):
                row_line = lines[i].strip()
                # Skip separator row (---|---|---)
                if re.match(r'^\|[\s:\-\|]+\|$', row_line):
                    i += 1
                    continue
                cells = [c.strip() for c in row_line.strip('|').split('|')]
                table_rows.append(cells)
                i += 1
            if table_rows:
                # Convertir cada celda a Paragraph con inline formatting.
                cell_style = ParagraphStyle(
                    'CellBody', parent=style_body,
                    fontSize=9, leading=12, alignment=TA_LEFT, spaceAfter=0,
                )
                cell_head = ParagraphStyle(
                    'CellHead', parent=cell_style,
                    fontName='Helvetica-Bold', textColor=COLOR_TITLE,
                )
                header = [Paragraph(_inline_md_to_rl(c), cell_head) for c in table_rows[0]]
                body_rows = [
                    [Paragraph(_inline_md_to_rl(c), cell_style) for c in row]
                    for row in table_rows[1:]
                ]
                data = [header] + body_rows
                tbl = Table(data, hAlign='LEFT', colWidths=None, repeatRows=1)
                tbl.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
                    ('BOX', (0, 0), (-1, -1), 0.4, COLOR_RULE),
                    ('INNERGRID', (0, 0), (-1, -1), 0.3, COLOR_RULE),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]))
                flowables.append(Spacer(1, 4))
                flowables.append(tbl)
                flowables.append(Spacer(1, 8))
            continue

        # Bullet list
        if line.startswith('- '):
            while i < n and lines[i].startswith('- '):
                item = lines[i][2:].strip()
                flowables.append(
                    Paragraph('•&nbsp;&nbsp;' + _inline_md_to_rl(item), style_bullet)
                )
                i += 1
            flowables.append(Spacer(1, 4))
            continue

        # Línea vacía
        if not line.strip():
            i += 1
            continue

        # Párrafo normal (puede ocupar varias líneas hasta línea en blanco / próximo bloque)
        para_lines = [line]
        i += 1
        while i < n:
            nxt = lines[i]
            if not nxt.strip():
                break
            if (nxt.startswith('#') or nxt.startswith('- ') or nxt.startswith('|')
                    or nxt.startswith('> ') or nxt.strip() == '---'):
                break
            para_lines.append(nxt)
            i += 1
        para = ' '.join(pl.strip() for pl in para_lines)
        if para:
            flowables.append(Paragraph(_inline_md_to_rl(para), style_body))
        continue

    return flowables


# ----------------------------------------------------------------------
# Generación
# ----------------------------------------------------------------------
def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    md_path = os.path.join(repo_root, 'docs', '01-business', 'master-contract-v2-draft.md')
    out_dir = os.path.join(repo_root, '..', '.tmp')
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'master-contract-v2-draft.pdf')

    with open(md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    flowables = _parse_markdown_to_flowables(md_text)

    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
        topMargin=2.5 * cm, bottomMargin=2.5 * cm,
        title='SharemeChat — Contrato Master v2 (borrador)',
        author='Shareme Technologies OÜ',
        subject='Contrato Master v2 borrador',
        creator='SharemeChat legal export',
    )

    doc.build(flowables, onFirstPage=_draw_header_footer,
              onLaterPages=_draw_header_footer)

    size_kb = os.path.getsize(out_path) / 1024.0
    print('OK  %s  (%.1f KB)' % (out_path, size_kb))


if __name__ == '__main__':
    main()
