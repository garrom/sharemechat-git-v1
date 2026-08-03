# -*- coding: utf-8 -*-
"""
Generador PDF del Contrato Master v3.2 (docs/01-business/
master-contract-v3-2-draft.md). Look and feel coherente con
generate_legal_pdfs.py.

Uso:
    python ops/legal-pdfs/generate_master_contract_v3_2_pdf.py
Output:
    .tmp/master-contract-v3-2.pdf
"""

import os
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT
from reportlab.lib import colors


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
    textColor=COLOR_MUTED, alignment=TA_LEFT, spaceAfter=14,
)
style_section = ParagraphStyle(
    'SectionTitle', parent=_styles['Heading2'],
    fontName='Helvetica-Bold', fontSize=12, leading=16,
    textColor=COLOR_TITLE, alignment=TA_LEFT,
    spaceBefore=14, spaceAfter=6, keepWithNext=True,
)
style_subsection = ParagraphStyle(
    'SubSectionTitle', parent=_styles['Heading3'],
    fontName='Helvetica-Bold', fontSize=10.5, leading=14,
    textColor=COLOR_TITLE, alignment=TA_LEFT,
    spaceBefore=8, spaceAfter=4, keepWithNext=True,
)
style_body = ParagraphStyle(
    'SectionBody', parent=_styles['Normal'],
    fontName='Helvetica', fontSize=10, leading=15,
    textColor=COLOR_BODY, alignment=TA_LEFT, spaceAfter=6,
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


def _draw_header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(COLOR_BRAND)
    canvas.drawString(2.5 * cm, A4[1] - 1.5 * cm, 'SharemeChat®')
    canvas.setFont('Helvetica', 8.5)
    canvas.setFillColor(COLOR_MUTED)
    canvas.drawRightString(
        A4[0] - 2.5 * cm, A4[1] - 1.5 * cm,
        'Contrato Master — v3.2'
    )
    canvas.setStrokeColor(COLOR_RULE)
    canvas.setLineWidth(0.4)
    canvas.line(2.5 * cm, A4[1] - 1.7 * cm, A4[0] - 2.5 * cm, A4[1] - 1.7 * cm)
    canvas.line(2.5 * cm, 1.9 * cm, A4[0] - 2.5 * cm, 1.9 * cm)
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(COLOR_MUTED)
    canvas.drawCentredString(
        A4[0] / 2.0, 1.45 * cm,
        'Shareme Technologies OÜ  ·  Registry code 17444422  '
        '·  Lõõtsa tn 5, 11415 Tallinn, Estonia',
    )
    canvas.drawCentredString(A4[0] / 2.0, 1.10 * cm, 'legal@sharemechat.com')
    canvas.drawRightString(A4[0] - 2.5 * cm, 0.75 * cm, 'Página %d' % doc.page)
    canvas.restoreState()


INLINE_BOLD_RE = re.compile(r'\*\*(.+?)\*\*')
INLINE_ITALIC_RE = re.compile(r'(?<!\*)\*(?!\*)([^\*]+)\*(?!\*)')
INLINE_CODE_RE = re.compile(r'`([^`]+)`')


def _inline_md_to_rl(text):
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;').replace('>', '&gt;')
    text = text.replace('&amp;lt;', '&lt;').replace('&amp;gt;', '&gt;')
    text = INLINE_BOLD_RE.sub(r'<b>\1</b>', text)
    text = INLINE_ITALIC_RE.sub(r'<i>\1</i>', text)
    text = INLINE_CODE_RE.sub(r'<font face="Courier" size="9">\1</font>', text)
    return text


def _parse_markdown_to_flowables(md_text):
    flowables = []
    lines = md_text.splitlines()
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i].rstrip()
        if line.startswith('# ') and not line.startswith('## '):
            flowables.append(Paragraph(_inline_md_to_rl(line[2:].strip()), style_title))
            i += 1
            continue
        if line.startswith('## '):
            flowables.append(Paragraph(_inline_md_to_rl(line[3:].strip()), style_section))
            i += 1
            continue
        if line.startswith('### '):
            flowables.append(Paragraph(_inline_md_to_rl(line[4:].strip()), style_subsection))
            i += 1
            continue
        if line.strip() == '---':
            flowables.append(Spacer(1, 6))
            i += 1
            continue
        if line.startswith('> '):
            block = []
            while i < n and (lines[i].startswith('> ') or lines[i].startswith('>')):
                block.append(lines[i][2:] if lines[i].startswith('> ') else lines[i][1:])
                i += 1
            joined = ' '.join(bl.strip() for bl in block if bl.strip())
            if joined:
                flowables.append(Paragraph(_inline_md_to_rl(joined), style_warn))
            continue
        if line.startswith('|'):
            table_rows = []
            while i < n and lines[i].strip().startswith('|'):
                row_line = lines[i].strip()
                if re.match(r'^\|[\s:\-\|]+\|$', row_line):
                    i += 1
                    continue
                cells = [c.strip() for c in row_line.strip('|').split('|')]
                table_rows.append(cells)
                i += 1
            if table_rows:
                cell_style = ParagraphStyle('CellBody', parent=style_body, fontSize=9, leading=12, alignment=TA_LEFT, spaceAfter=0)
                cell_head = ParagraphStyle('CellHead', parent=cell_style, fontName='Helvetica-Bold', textColor=COLOR_TITLE)
                header = [Paragraph(_inline_md_to_rl(c), cell_head) for c in table_rows[0]]
                body_rows = [[Paragraph(_inline_md_to_rl(c), cell_style) for c in row] for row in table_rows[1:]]
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
        if line.startswith('- '):
            while i < n and lines[i].startswith('- '):
                flowables.append(Paragraph('•&nbsp;&nbsp;' + _inline_md_to_rl(lines[i][2:].strip()), style_bullet))
                i += 1
            flowables.append(Spacer(1, 4))
            continue
        if not line.strip():
            i += 1
            continue
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
    return flowables


def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    md_path = os.path.join(repo_root, 'docs', '01-business', 'master-contract-v3-2-draft.md')
    out_dir = os.path.abspath(os.path.join(repo_root, '..', '.tmp'))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'master-contract-v3-2.pdf')

    with open(md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    flowables = _parse_markdown_to_flowables(md_text)

    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
        topMargin=2.5 * cm, bottomMargin=2.5 * cm,
        title='SharemeChat — Contrato Master v3.2',
        author='Shareme Technologies OÜ',
        subject='Contrato Master v3.2',
        creator='SharemeChat legal export',
    )
    doc.build(flowables, onFirstPage=_draw_header_footer, onLaterPages=_draw_header_footer)
    print('OK  %s  (%.1f KB)' % (out_path, os.path.getsize(out_path) / 1024.0))


if __name__ == '__main__':
    main()
