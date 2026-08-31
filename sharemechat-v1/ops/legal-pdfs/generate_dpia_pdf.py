# -*- coding: utf-8 -*-
"""
Generador del PDF de la DPIA (Data Protection Impact Assessment, GDPR Art. 35)
del flujo biometrico de verificacion de edad/identidad.

Documento INTERNO de accountability (no publico). Fuente autoritativa:
docs/01-business/dpia-biometric-age-verification.md (repo). Este script produce
la copia PDF entregable a un regulador / al PSP en due diligence, que se archiva
en ops/legal-history/compliance/ y se guarda en el bucket PRIVADO
(content-private-*/compliance/), NUNCA en el bucket publico assets/legal/.

Plantilla visual coherente con generate_legal_pdfs.py (A4, Helvetica, header con
marca + titulo, footer corporativo). A diferencia de las politicas, aqui se usan
tablas (reportlab Table) para el control del documento, el alcance de datos y la
matriz de riesgos.

Salida: DPIA_OUT (env) si esta seteada; si no, el default de Downloads.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
from reportlab.lib import colors

COLOR_TITLE = colors.HexColor('#1f2937')
COLOR_BODY = colors.HexColor('#4b5563')
COLOR_MUTED = colors.HexColor('#6b7280')
COLOR_BRAND = colors.HexColor('#1e3a8a')
COLOR_RULE = colors.HexColor('#e5e7eb')
COLOR_THBG = colors.HexColor('#f3f4f6')
COLOR_DRAFT = colors.HexColor('#9a5b06')
COLOR_DRAFTBG = colors.HexColor('#fdf4e6')

_styles = getSampleStyleSheet()

style_title = ParagraphStyle('DocTitle', parent=_styles['Title'],
    fontName='Helvetica-Bold', fontSize=21, leading=26,
    textColor=COLOR_TITLE, alignment=TA_LEFT, spaceAfter=6)
style_subtitle = ParagraphStyle('Sub', parent=_styles['Normal'],
    fontName='Helvetica', fontSize=10.5, leading=15,
    textColor=COLOR_MUTED, alignment=TA_LEFT, spaceAfter=12)
style_draft = ParagraphStyle('Draft', parent=_styles['Normal'],
    fontName='Helvetica-Oblique', fontSize=9.5, leading=14,
    textColor=COLOR_DRAFT, alignment=TA_JUSTIFY, spaceAfter=4,
    backColor=COLOR_DRAFTBG, borderPadding=8, spaceBefore=4)
style_section = ParagraphStyle('Sec', parent=_styles['Heading2'],
    fontName='Helvetica-Bold', fontSize=12.5, leading=16,
    textColor=COLOR_BRAND, alignment=TA_LEFT,
    spaceBefore=14, spaceAfter=5, keepWithNext=True)
style_sub = ParagraphStyle('SubH', parent=_styles['Heading3'],
    fontName='Helvetica-Bold', fontSize=10.5, leading=14,
    textColor=COLOR_TITLE, spaceBefore=8, spaceAfter=3, keepWithNext=True)
style_body = ParagraphStyle('Body', parent=_styles['Normal'],
    fontName='Helvetica', fontSize=10, leading=15,
    textColor=COLOR_BODY, alignment=TA_JUSTIFY, spaceAfter=6)
style_bullet = ParagraphStyle('Bullet', parent=style_body,
    leftIndent=16, firstLineIndent=-11, spaceAfter=3)
style_cell = ParagraphStyle('Cell', parent=_styles['Normal'],
    fontName='Helvetica', fontSize=8.8, leading=12, textColor=COLOR_BODY)
style_cellb = ParagraphStyle('CellB', parent=style_cell,
    fontName='Helvetica-Bold', textColor=COLOR_TITLE)
style_th = ParagraphStyle('Th', parent=_styles['Normal'],
    fontName='Helvetica-Bold', fontSize=8.2, leading=11, textColor=COLOR_TITLE)


def _draw_header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(COLOR_BRAND)
    canvas.drawString(2.5 * cm, A4[1] - 1.5 * cm, 'SharemeChat®')
    canvas.setFont('Helvetica', 8.5)
    canvas.setFillColor(COLOR_MUTED)
    canvas.drawRightString(A4[0] - 2.5 * cm, A4[1] - 1.5 * cm,
                           'DPIA — Biometric Age & Identity Verification')
    canvas.setStrokeColor(COLOR_RULE)
    canvas.setLineWidth(0.4)
    canvas.line(2.5 * cm, A4[1] - 1.7 * cm, A4[0] - 2.5 * cm, A4[1] - 1.7 * cm)
    canvas.line(2.5 * cm, 1.9 * cm, A4[0] - 2.5 * cm, 1.9 * cm)
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(COLOR_MUTED)
    canvas.drawCentredString(A4[0] / 2.0, 1.45 * cm,
        'Shareme Technologies OÜ  ·  Registry code 17444422  ·  '
        'Lõõtsa tn 5, 11415 Tallinn, Estonia  ·  INTERNAL — not for publication')
    canvas.drawRightString(A4[0] - 2.5 * cm, 0.75 * cm, 'Page %d' % doc.page)
    canvas.restoreState()


def P(t, s=style_cell):
    return Paragraph(t, s)


def make_table(data, col_widths, header=True):
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    style = [
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, COLOR_RULE),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    if header:
        style.append(('BACKGROUND', (0, 0), (-1, 0), COLOR_THBG))
    return Table(data, colWidths=col_widths, repeatRows=1 if header else 0,
                 style=TableStyle(style))


def build(outfile):
    doc = SimpleDocTemplate(outfile, pagesize=A4,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
        topMargin=2.5 * cm, bottomMargin=2.5 * cm,
        title='SharemeChat - DPIA Biometric Age & Identity Verification',
        author='Shareme Technologies OÜ',
        subject='Data Protection Impact Assessment (GDPR Art. 35)',
        creator='SharemeChat compliance export')

    s = []
    s.append(Paragraph('Data Protection Impact Assessment', style_title))
    s.append(Paragraph('Biometric age &amp; identity verification — GDPR Art. 35', style_subtitle))
    s.append(Paragraph(
        'INTERNAL ACCOUNTABILITY DOCUMENT — draft dated 2026-08-31. This DPIA '
        'describes and assesses a processing activity that is already implemented '
        'and active. It is maintained for accountability under GDPR Art. 5(2) and '
        'produced to the supervisory authority on request. Not for public '
        'distribution. Authoritative source: the versioned document in the company '
        'repository; this PDF is a rendered copy.', style_draft))
    s.append(Spacer(1, 8))

    # 0. Document control
    s.append(Paragraph('0. Document control', style_section))
    s.append(make_table([
        [P('Field', style_th), P('Value', style_th)],
        [P('Controller', style_cellb), P('Shareme Technologies OÜ · Registry 17444422 · Lõõtsa tn 5, 11415 Tallinn, Estonia · contact@sharemechat.com')],
        [P('Processor', style_cellb), P('Didit — single identity &amp; age verification provider (ADR-035)')],
        [P('DPO / owner', style_cellb), P('Alain Garmendia (Director). Formal DPO designation to be assessed by volume.')],
        [P('Version', style_cellb), P('1.0 (draft) · 2026-08-31 · reviewed annually or on vendor/purpose change')],
    ], [3.2 * cm, 11.3 * cm]))

    # 1. Necessity
    s.append(Paragraph('1. Why this DPIA is required', style_section))
    s.append(Paragraph('Under GDPR Art. 35 a DPIA is required where processing is likely to result in a high risk. Two independent triggers apply here:', style_body))
    for it in [
        '<b>Large-scale special-category data (Art. 9):</b> biometric data used to estimate/verify a person\u2019s age.',
        '<b>Systematic automated evaluation:</b> automated age estimation that conditions access to the service.',
    ]:
        s.append(Paragraph('•&nbsp;&nbsp;' + it, style_bullet))
    s.append(Paragraph('The processing sits within the adult/streaming classification (ADR-028), which requires consumer age verification under the regulation of the target markets (UK Online Safety Act / Ofcom 2025, EU DSA art. 28, US post <i>FSC v. Paxton</i>) and under card-network rules (Mastercard AN 5196, Visa Rule ID 0003356).', style_body))

    # 2. Description
    s.append(Paragraph('2. Description of the processing', style_section))
    s.append(Paragraph('2.1 Nature — two flows, both operated by Didit', style_sub))
    for it in [
        '<b>Client — age estimation:</b> facial age estimation (Didit \u201cAge Estimation\u201d workflow), with a document-based check as a fallback where estimation is inconclusive.',
        '<b>Model — full identity:</b> government document + selfie with liveness + face match + device/IP analysis, before onboarding and any live session.',
    ]:
        s.append(Paragraph('•&nbsp;&nbsp;' + it, style_bullet))
    s.append(Spacer(1, 4))
    s.append(Paragraph('2.2 Scope of data', style_sub))
    s.append(make_table([
        [P('Data', style_th), P('Processed by', style_th), P('Location', style_th)],
        [P('Facial image, document, liveness signals (raw biometrics)'), P('<b>Didit</b> (processor)', style_cell), P('Didit infrastructure — <b>not</b> in SharemeChat', style_cell)],
        [P('Decision outcome'), P('SharemeChat'), P('users.client_kyc_status, verification_status')],
        [P('Estimated age (number)'), P('SharemeChat'), P('users.client_kyc_estimated_age')],
        [P('Decision timestamp'), P('SharemeChat'), P('users.client_kyc_decided_at')],
    ], [5.6 * cm, 3.6 * cm, 5.3 * cm]))
    s.append(Paragraph('<b>Minimisation (implemented in code):</b> SharemeChat does not store raw biometrics. The internal KYC session DTO explicitly excludes biometric data and the provider\u2019s raw decision reason. The platform retains only the verdict and the estimated age; the biometric material stays with the processor.', style_body))
    s.append(Paragraph('2.4 Purposes', style_sub))
    for it in [
        'Prevent minors from accessing adult content (protection of minors).',
        'Verify identity and adult age of content providers (2257 / card-network rules / anti-fraud).',
        'Fraud and account-abuse prevention.',
    ]:
        s.append(Paragraph('•&nbsp;&nbsp;' + it, style_bullet))
    s.append(Paragraph('Not used for advertising, commercial profiling, or disclosure for marketing.', style_body))

    # 3. Necessity & proportionality
    s.append(Paragraph('3. Necessity and proportionality', style_section))
    s.append(Paragraph('3.1 Lawful basis', style_sub))
    for it in [
        '<b>Special category (Art. 9):</b> explicit consent Art. 9(2)(a), obtained before the flow; reinforced by Art. 9(2)(g) (substantial public interest: protection of minors) where national law enables it.',
        '<b>Base personal data (Art. 6):</b> 6(1)(c) legal obligation (age verification required by applicable regulation) and 6(1)(b) necessity for the contracted service.',
    ]:
        s.append(Paragraph('•&nbsp;&nbsp;' + it, style_bullet))
    s.append(Paragraph('Consent is freely given (an 18+ service can be declined), informed (privacy policy + in-flow notice) and specific (limited to age/identity verification).', style_body))
    s.append(Paragraph('3.2 Principles', style_sub))
    for it in [
        '<b>Purpose limitation:</b> data used only for age/identity verification.',
        '<b>Minimisation:</b> only decision + estimated age retained; raw biometrics stay with the processor.',
        '<b>Accuracy:</b> two layers (estimation + document fallback); re-verification on reasonable indication.',
        '<b>Storage limitation:</b> provider verification records \u2265 7 years after last activity (2257 / card rules); processor retention capped (target 6 months, not \u201cunlimited\u201d).',
        '<b>Integrity &amp; confidentiality:</b> encryption in transit, access control, signed webhooks (HMAC + anti-replay), separation of biometrics (processor) from verdict (platform).',
    ]:
        s.append(Paragraph('•&nbsp;&nbsp;' + it, style_bullet))
    s.append(Paragraph('3.3 Processor (Didit)', style_sub))
    s.append(Paragraph('Formalise the DPA + TOMs; confirm data location and international transfers (SCC if outside the EEA); configure capped retention in the provider console.', style_body))

    # 4-5 Risks
    s.append(Paragraph('4\u20135. Risk assessment and measures', style_section))
    s.append(make_table([
        [P('#', style_th), P('Risk to the data subject', style_th), P('Measures', style_th), P('Residual', style_th)],
        [P('R1'), P('Unauthorised access to raw biometrics'), P('Not stored on the platform; held by processor under DPA/TOMs; encrypted'), P('Low')],
        [P('R2'), P('False rejection of an adult'), P('Document fallback; re-verification; human review'), P('Low\u2013Med')],
        [P('R3'), P('Function creep'), P('Purpose limitation; only decision+age retained; no ad use'), P('Low')],
        [P('R4'), P('Processor breach'), P('Specialised vendor; DPA/TOMs; 72h breach notice; minimisation'), P('Low\u2013Med')],
        [P('R5'), P('Int\u2019l transfer without safeguard'), P('Confirm location in DPA; SCC or equivalent'), P('Low*')],
        [P('R6'), P('Processing a minor\u2019s data'), P('The very purpose is to detect and exclude minors; deletion + block on detection'), P('Low')],
        [P('R7'), P('Excessive retention'), P('Capped retention at processor; provider limited to legal obligation'), P('Low')],
    ], [1.0 * cm, 4.3 * cm, 7.2 * cm, 2.0 * cm]))
    s.append(Paragraph('* after formalising the DPA with Didit.', style_subtitle))

    # 6. Conclusion
    s.append(Paragraph('6. Conclusion and pending actions', style_section))
    s.append(Paragraph('With structural minimisation (biometrics never touch the platform), explicit consent, and purpose/storage limitation, the <b>residual risk is low</b> and proportionate to protecting minors and meeting applicable regulation. The processing is considered <b>necessary and proportionate</b>.', style_body))
    s.append(Paragraph('Pending to close (non-technical):', style_sub))
    for it in [
        'Formalise the <b>DPA + TOMs</b> with Didit; confirm location / transfers.',
        'Confirm the <b>retention period</b> configured in the Didit console (target 6 months).',
        '<b>Enrich the Privacy Policy</b> with the biometric-flow detail and the processor.',
        'Assess a <b>formal DPO designation</b> by volume.',
        'External legal validation, at the operator\u2019s discretion.',
    ]:
        s.append(Paragraph('•&nbsp;&nbsp;' + it, style_bullet))

    doc.build(s, onFirstPage=_draw_header_footer, onLaterPages=_draw_header_footer)


def main():
    out = os.environ.get('DPIA_OUT')
    if not out:
        outdir = r'C:\Users\alain\Downloads\sharemechat_legal_pdfs_segpay'
        os.makedirs(outdir, exist_ok=True)
        out = os.path.join(outdir, 'SharemeChat_DPIA_Biometric_Age_Verification.pdf')
    build(out)
    print('OK  %s  (%.1f KB)' % (out, os.path.getsize(out) / 1024.0))


if __name__ == '__main__':
    main()
