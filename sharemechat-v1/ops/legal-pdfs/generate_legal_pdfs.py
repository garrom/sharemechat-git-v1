# -*- coding: utf-8 -*-
"""
Generador de los 8 PDFs legales de SharemeChat para SegPay (PSP US).

Template visual coherente entre todos: A4, Helvetica, márgenes 2.5cm,
header con marca + título del doc, footer con info corporativa + paginación.

Contenido extraído literal de:
  - frontend/src/footer/Legal.jsx (tabs terms, privacy, cookies, refunds,
    contact, complaints, appeals)
  - frontend/src/footer/Safety.jsx + frontend/src/footer/Rules.jsx
    (combinados en un único PDF en dos partes I y II)

Destino:
  C:\\Users\\alain\\Downloads\\sharemechat_legal_pdfs_segpay\\
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
)
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
from reportlab.lib import colors


# ----------------------------------------------------------------------
# Estilos
# ----------------------------------------------------------------------
COLOR_TITLE = colors.HexColor('#1f2937')
COLOR_BODY = colors.HexColor('#4b5563')
COLOR_MUTED = colors.HexColor('#6b7280')
COLOR_BRAND = colors.HexColor('#1e3a8a')
COLOR_RULE = colors.HexColor('#e5e7eb')

_styles = getSampleStyleSheet()

style_title = ParagraphStyle(
    'DocTitle', parent=_styles['Title'],
    fontName='Helvetica-Bold', fontSize=22, leading=28,
    textColor=COLOR_TITLE, alignment=TA_LEFT, spaceAfter=10,
)
style_intro = ParagraphStyle(
    'DocIntro', parent=_styles['Normal'],
    fontName='Helvetica', fontSize=10.5, leading=16,
    textColor=COLOR_BODY, alignment=TA_JUSTIFY, spaceAfter=18,
)
style_part_title = ParagraphStyle(
    'PartTitle', parent=_styles['Heading1'],
    fontName='Helvetica-Bold', fontSize=15, leading=20,
    textColor=COLOR_TITLE, alignment=TA_LEFT,
    spaceBefore=14, spaceAfter=8,
)
style_part_intro = ParagraphStyle(
    'PartIntro', parent=_styles['Normal'],
    fontName='Helvetica-Oblique', fontSize=10, leading=15,
    textColor=COLOR_MUTED, alignment=TA_JUSTIFY, spaceAfter=14,
)
style_section = ParagraphStyle(
    'SectionTitle', parent=_styles['Heading2'],
    fontName='Helvetica-Bold', fontSize=11.5, leading=15,
    textColor=COLOR_TITLE, alignment=TA_LEFT,
    spaceBefore=12, spaceAfter=4, keepWithNext=True,
)
style_body = ParagraphStyle(
    'SectionBody', parent=_styles['Normal'],
    fontName='Helvetica', fontSize=10, leading=15,
    textColor=COLOR_BODY, alignment=TA_JUSTIFY, spaceAfter=6,
)
style_bullet = ParagraphStyle(
    'Bullet', parent=style_body,
    leftIndent=18, firstLineIndent=-12,
    spaceAfter=3,
)
style_address = ParagraphStyle(
    'Address', parent=style_body,
    fontSize=10, leading=15, spaceAfter=4,
)


# ----------------------------------------------------------------------
# Header / Footer
# ----------------------------------------------------------------------
def _draw_header_footer(canvas, doc):
    canvas.saveState()

    # Header: brand izquierda, doc title derecha, regla horizontal
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(COLOR_BRAND)
    canvas.drawString(2.5 * cm, A4[1] - 1.5 * cm, 'SharemeChat®')

    canvas.setFont('Helvetica', 8.5)
    canvas.setFillColor(COLOR_MUTED)
    canvas.drawRightString(
        A4[0] - 2.5 * cm, A4[1] - 1.5 * cm,
        getattr(doc, 'docHeaderTitle', '')
    )

    canvas.setStrokeColor(COLOR_RULE)
    canvas.setLineWidth(0.4)
    canvas.line(
        2.5 * cm, A4[1] - 1.7 * cm,
        A4[0] - 2.5 * cm, A4[1] - 1.7 * cm,
    )

    # Footer: info corporativa centrada + página derecha + regla horizontal
    canvas.setStrokeColor(COLOR_RULE)
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
        'contact@sharemechat.com',
    )
    canvas.drawRightString(
        A4[0] - 2.5 * cm, 0.75 * cm,
        'Page %d' % doc.page,
    )
    canvas.restoreState()


def render_pdf(filepath, doc_title, doc_intro, sections, parts=None):
    """
    sections: lista de dicts {title, paras}
        paras: lista de dicts; tipos soportados:
            {'type': 'p', 'text': '...'}
            {'type': 'ul', 'items': ['...', ...]}
            {'type': 'addr', 'text': '...'}  # mismo estilo, sin justify
    parts: si se pasa, ignora `sections` y rinde dos partes con título.
           Estructura: [{'title': 'Part I — ...', 'intro': '...',
                         'sections': [...]}, ...]
    """
    doc = SimpleDocTemplate(
        filepath, pagesize=A4,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
        topMargin=2.5 * cm, bottomMargin=2.5 * cm,
        title='SharemeChat - %s' % doc_title,
        author='Shareme Technologies OÜ',
        subject=doc_title,
        creator='SharemeChat legal export',
    )
    doc.docHeaderTitle = doc_title

    story = [Paragraph(doc_title, style_title)]
    if doc_intro:
        story.append(Paragraph(doc_intro, style_intro))

    def _render_sections(sections_list):
        for sec in sections_list:
            story.append(Paragraph(sec['title'], style_section))
            for p in sec['paras']:
                t = p['type']
                if t == 'p':
                    story.append(Paragraph(p['text'], style_body))
                elif t == 'addr':
                    story.append(Paragraph(p['text'], style_address))
                elif t == 'ul':
                    # Renderizamos cada item como Paragraph con bullet
                    # inline (hanging indent). Mas predecible que
                    # ListFlowable y rinde el carácter • directamente
                    # como texto, sin artefactos en la extracción.
                    for li in p['items']:
                        story.append(
                            Paragraph('•&nbsp;&nbsp;' + li, style_bullet)
                        )
                    story.append(Spacer(1, 4))

    if parts:
        for i, part in enumerate(parts):
            if i > 0:
                story.append(PageBreak())
            story.append(Paragraph(part['title'], style_part_title))
            if part.get('intro'):
                story.append(Paragraph(part['intro'], style_part_intro))
            _render_sections(part['sections'])
    else:
        _render_sections(sections)

    doc.build(story, onFirstPage=_draw_header_footer,
              onLaterPages=_draw_header_footer)


# ----------------------------------------------------------------------
# Contenido literal de los 8 documentos
# (transcrito de frontend/src/footer/Legal.jsx, Safety.jsx, Rules.jsx)
# ----------------------------------------------------------------------

# 1) Terms and Conditions
TERMS_INTRO = (
    'These Terms of Service govern your access to and use of SharemeChat, '
    'including the website, the mobile web experience, and related services. '
    'By creating an account, accessing, or using the service, you agree to '
    'these terms.'
)
TERMS_SECTIONS = [
    {'title': '1. Operator and Scope', 'paras': [
        {'type': 'p', 'text': (
            'SharemeChat is operated by Shareme Technologies OÜ. These '
            'terms apply to the SharemeChat website, mobile web experience, '
            'user accounts, premium features, live sessions, messaging '
            'features, and related support or safety processes made '
            'available through the platform.'
        )},
    ]},
    {'title': '2. Eligibility and Age Verification', 'paras': [
        {'type': 'p', 'text': (
            'SharemeChat is intended exclusively for adults aged 18 or '
            'older. Access or use by minors is strictly prohibited. Before '
            'accessing adult-themed features, both parties to a session '
            'must complete identity verification through the platform\'s '
            'third-party verification provider: clients undergo age '
            'verification (facial age estimation with a document-based '
            'check as a fallback), and models undergo full identity '
            'verification (document, selfie, liveness, face match). '
            'Sessions cannot start unless both participants have completed '
            'the verification flow applicable to their role.'
        )},
    ]},
    {'title': '3. Accounts and Access', 'paras': [
        {'type': 'p', 'text': (
            'You must provide accurate information and keep your account '
            'credentials secure. You may not create accounts in bulk, use '
            'bots, impersonate others, share accounts, or attempt to bypass '
            'access controls, platform safeguards, or eligibility '
            'restrictions.'
        )},
    ]},
    {'title': '4. Nature of the Service', 'paras': [
        {'type': 'p', 'text': (
            'SharemeChat is a premium 1-to-1 adult dating platform for '
            'identity-verified adults. The service connects consenting '
            'adult users in private one-to-one video sessions and direct '
            'messaging. SharemeChat is not a broadcast or public streaming '
            'service: sessions are private between the two matched '
            'participants and are not recorded, rebroadcast, or made '
            'available to third parties. Features, pricing models, session '
            'availability, and user experience may vary depending on the '
            'device, browser, region, or operational state of the service.'
        )},
        {'type': 'p', 'text': (
            'Public areas of the platform (landing pages, blog, marketing '
            'surfaces) contain only descriptive information about the '
            'service and do not display adult-themed material. '
            'Adult-themed interaction takes place exclusively within '
            'private sessions between two age-verified, identity-verified '
            'adults who have consented to participate.'
        )},
    ]},
    {'title': '5. User Conduct and Prohibited Conduct', 'paras': [
        {'type': 'p', 'text': (
            'Your use of the service must comply with the platform rules, '
            'community standards, and applicable law. Adult-themed '
            'interaction, including nudity, between consenting '
            'age-verified and identity-verified adults in private 1-to-1 '
            'sessions is permitted within the limits set by these terms '
            'and applicable law. The following behaviors are strictly '
            'prohibited at all times, including in private sessions, and '
            'will result in immediate enforcement action:'
        )},
        {'type': 'ul', 'items': [
            ('Any content involving, depicting, soliciting, promoting, or '
             'normalizing minors in any context. Real or implied child '
             'sexual abuse material (CSAM) is reported to competent '
             'authorities and to specialised hotlines.'),
            ('Non-consensual content, including recordings, reproductions, '
             'or distribution of any person without that person\'s clear '
             'and informed consent.'),
            ('Human trafficking, coercion, exploitation, direct '
             'solicitation of prostitution, or any commercial sexual '
             'service that falls outside the scope of the platform\'s '
             'consenting adult dating context.'),
            ('Bestiality, necrophilia, or any sexual content involving '
             'non-consenting subjects.'),
            ('Violence, gore, self-harm, suicide promotion, weapons used '
             'in a threatening manner, or content glorifying serious '
             'harm.'),
            ('Hate speech, harassment, threats, extortion, or content '
             'promoting discrimination based on protected characteristics. '
             'Hate symbols and supremacist material.'),
            ('Illegal drugs, illegal gambling, fraud, impersonation, '
             'phishing, scams, or abuse of promotions.'),
            ('Recording, capturing, or rebroadcasting a private session '
             'or another user\'s likeness without authorization.'),
            ('Attempts to bypass moderation, identity verification, '
             'payment controls, or security systems.'),
            ('Use of the service in a misleading, abusive, or '
             'commercially unauthorized way, including running the '
             'platform as an outlet for external commercial activity not '
             'provided for in these terms.'),
        ]},
    ]},
    {'title': '6. Live Camera and Session Rules', 'paras': [
        {'type': 'p', 'text': (
            'During live sessions, users must keep their face clearly '
            'visible on initial connection and must be the only person '
            'appearing on camera. No other person, and in particular no '
            'minor, may appear on camera at any time. Sessions are '
            'private and exclusive between the two matched, age-verified '
            'participants. Users must not display content that violates '
            'Section 5 of these terms or applicable law.'
        )},
        {'type': 'p', 'text': (
            'We may interrupt or terminate a session where camera use, '
            'behavior, displayed material, or session conduct creates a '
            'safety, compliance, moderation, or technical concern, '
            'including but not limited to suspected presence of a minor, '
            'suspected non-consenting third party, or any content listed '
            'as prohibited in Section 5.'
        )},
    ]},
    {'title': '7. Moderation, Enforcement, and Content Removal', 'paras': [
        {'type': 'p', 'text': (
            'SharemeChat operates real-time automated moderation on live '
            'sessions, combined with human review for cases that require '
            'context, and a complaints channel for users and third '
            'parties. Automated systems sample session frames during '
            'private sessions and screen them for prohibited content '
            'listed in Section 5. When the automated system identifies '
            'content that falls within the platform\'s zero-tolerance '
            'categories (in particular suspected involvement of minors '
            'or extreme violence/gore), the session is terminated '
            'automatically and the matter is escalated to internal '
            'review and, where applicable, to competent authorities.'
        )},
        {'type': 'p', 'text': (
            'For categories that require human judgement (borderline '
            'content, reports from other users, appeals), a human '
            'reviewer assesses the matter and decides on the appropriate '
            'enforcement measure. Measures may include warnings, session '
            'termination, feature restrictions, account suspension, '
            'content removal, identity re-verification, or permanent '
            'removal from the service. We retain technical records of '
            'moderation decisions for audit and compliance purposes, '
            'including periodic reporting to the payment processor as '
            'required by card-network rules.'
        )},
    ]},
    {'title': '8. Reports, Safety, and Review', 'paras': [
        {'type': 'p', 'text': (
            'Users may report abuse, misconduct, or safety concerns through '
            'in-platform tools or available support channels. Reports may '
            'be reviewed using technical records and internal moderation '
            'processes. Depending on the circumstances, outcomes may '
            'include warnings, session termination, feature restrictions, '
            'account suspension, or permanent removal from the service.'
        )},
        {'type': 'p', 'text': (
            'A user who believes that a moderation or account restriction '
            'decision was made in error may contact support to request '
            "review. Any such review remains at SharemeChat's discretion "
            'and does not create an obligation to reverse or modify the '
            'measure.'
        )},
    ]},
    {'title': '9. Payments, Prepaid Balance, and Premium Features', 'paras': [
        {'type': 'p', 'text': (
            'Certain premium features may require prepaid balance, credits, '
            'or similar stored value within your account. Account balance '
            'is credited after the applicable payment has been successfully '
            'confirmed by the relevant payment provider or payment flow '
            'used by the platform. Prices, packages, and feature '
            'availability may change over time.'
        )},
        {'type': 'p', 'text': (
            'Premium usage, including live sessions and certain premium '
            'events, may consume prepaid balance. Consumption in live '
            'sessions may be calculated according to the applicable '
            'duration of the session and the technical records of the '
            'service. Sessions that do not become properly established or '
            'confirmed may end without charge. We may prevent the start or '
            'continuation of premium features where the available balance '
            'is insufficient.'
        )},
        {'type': 'p', 'text': (
            'The sending of virtual gifts consumes balance immediately '
            'according to the stated value of the selected gift.'
        )},
    ]},
    {'title': '10. Refunds', 'paras': [
        {'type': 'p', 'text': (
            'Refunds are not automatic and are reviewed on a case-by-case '
            'basis. We may grant refunds or account adjustments in cases '
            'involving technical errors, incorrect charges, or other '
            'verifiable incidents affecting premium usage. Where '
            'appropriate, a refund may be provided as an account balance '
            'adjustment, credit, or other internal correction applied to '
            'the service account.'
        )},
    ]},
    {'title': '11. Payment Disputes, Fraud, and Chargebacks', 'paras': [
        {'type': 'p', 'text': (
            'We may investigate misuse, fraud, payment irregularities, '
            'payment disputes, or chargebacks relating to the service. '
            'During review, we may suspend or restrict accounts, limit '
            'access to premium features, delay account changes, or adjust '
            'balances, credits, or access to premium features that were '
            'improperly credited, obtained, or retained in connection with '
            'the relevant activity.'
        )},
    ]},
    {'title': '12. Logs, Technical Records, and Internal Evidence', 'paras': [
        {'type': 'p', 'text': (
            'SharemeChat may retain and use technical records, internal '
            'records, moderation records, payment-related records, audit '
            'trails, and other operational records relating to sessions, '
            'account activity, reports, restrictions, and transactions to '
            'operate the service, protect users, investigate incidents, '
            'review disputes, detect fraud, enforce rules, and support '
            'compliance, accounting integrity, and other legitimate '
            'operational purposes.'
        )},
    ]},
    {'title': '13. No Recording or Reuse of Private Sessions', 'paras': [
        {'type': 'p', 'text': (
            'Users may not record, capture, reproduce, distribute, '
            'broadcast, or otherwise reuse private live sessions or private '
            'interactions without authorization. Violations may result in '
            'moderation or enforcement action, including feature '
            'restrictions, suspension, or removal from the service.'
        )},
    ]},
    {'title': '14. User Content', 'paras': [
        {'type': 'p', 'text': (
            'If you upload or send content, you retain ownership of your '
            'content, but you grant SharemeChat a limited license to host, '
            'store, display, reproduce, and process it only as necessary '
            'to operate, secure, and improve the service.'
        )},
    ]},
    {'title': '15. Intellectual Property', 'paras': [
        {'type': 'p', 'text': (
            'The platform, including its software, branding, design, and '
            'related assets, belongs to SharemeChat and its licensors. '
            'Users receive a limited, revocable, non-transferable license '
            'to use the service for lawful personal purposes.'
        )},
    ]},
    {'title': '16. Privacy and Cookies', 'paras': [
        {'type': 'p', 'text': (
            'The way we collect and process personal data is described in '
            'our Privacy Policy and our Cookie Policy.'
        )},
    ]},
    {'title': '17. Unused or Remaining Balance', 'paras': [
        {'type': 'p', 'text': (
            'Access to the service may be restricted, suspended, or '
            'terminated even if unused balance remains on the account. '
            'Unused balance does not guarantee an automatic refund, and '
            'any remaining balance may be reviewed case by case, including '
            'where fraud, payment disputes, technical issues, voluntary '
            'account closure, or account restrictions are involved.'
        )},
    ]},
    {'title': '18. Technical Factors and Availability', 'paras': [
        {'type': 'p', 'text': (
            'Session quality depends on network conditions, devices, '
            'browsers, local connectivity, and third-party infrastructure. '
            'We do not guarantee uninterrupted or error-free availability '
            'of the service at all times, and some features may be '
            'unavailable, delayed, or limited in certain circumstances.'
        )},
    ]},
    {'title': '19. Disclaimer of Warranties', 'paras': [
        {'type': 'p', 'text': (
            'The service is provided on an "as is" and "as available" '
            'basis, without warranties of any kind, to the maximum extent '
            'permitted by law.'
        )},
    ]},
    {'title': '20. Limitation of Liability', 'paras': [
        {'type': 'p', 'text': (
            'To the maximum extent permitted by law, SharemeChat is not '
            'liable for indirect, incidental, special, consequential, or '
            'punitive damages arising out of or related to the use of the '
            'service.'
        )},
    ]},
    {'title': '21. Suspension and Termination', 'paras': [
        {'type': 'p', 'text': (
            'We may suspend or terminate accounts immediately in cases '
            'involving rule violations, suspected fraud, abuse, security '
            'concerns, or compliance risks. After termination, your right '
            'to access the service ends.'
        )},
    ]},
    {'title': '22. Governing Law', 'paras': [
        {'type': 'p', 'text': (
            'These terms are governed by the laws of Estonia. Any dispute '
            'related to the service will be subject to the jurisdiction of '
            'the competent courts located in Tallinn, Estonia.'
        )},
    ]},
    {'title': '23. Contact, Safety, and Security', 'paras': [
        {'type': 'p', 'text': (
            'For legal or support questions, you may contact SharemeChat '
            'at contact@sharemechat.com. Safety or security concerns '
            'should be reported through available in-platform tools or '
            'the appropriate support contact.'
        )},
    ]},
]

# 2) Privacy Policy
PRIVACY_INTRO = (
    'This Privacy Policy explains how personal data is collected, used, '
    'stored, and protected when you use SharemeChat.'
)
PRIVACY_SECTIONS = [
    {'title': '1. Data Controller', 'paras': [
        {'type': 'addr', 'text': (
            'Shareme Technologies OÜ<br/>'
            'Registry code: 17444422<br/>'
            'Lõõtsa tn 5, 11415 Tallinn, Harju maakond, Estonia<br/>'
            'contact@sharemechat.com'
        )},
    ]},
    {'title': '2. Information We Collect', 'paras': [
        {'type': 'p', 'text': (
            'We may collect account data, profile details, verification '
            'data for models, technical information such as IP address, '
            'session and cookie identifiers, access logs, platform usage '
            'events, messaging data, and payment-related records '
            'processed through authorized providers.'
        )},
    ]},
    {'title': '3. Why We Process Data', 'paras': [
        {'type': 'p', 'text': (
            'Personal data is processed to provide the service, '
            'authenticate users, operate matching and video chat features, '
            'prevent abuse and fraud, comply with legal obligations, '
            'support users, and improve the service through internal '
            'analytics and operational metrics.'
        )},
    ]},
    {'title': '4. Service Providers', 'paras': [
        {'type': 'p', 'text': (
            'We may share data with service providers acting on our behalf, '
            'including infrastructure providers, payment processors, '
            'corporate email services, and identity verification providers '
            'when applicable.'
        )},
    ]},
    {'title': '5. International Transfers', 'paras': [
        {'type': 'p', 'text': (
            'If any provider processes personal data outside the European '
            'Economic Area, such transfers will be carried out under '
            'appropriate safeguards, including standard contractual '
            'clauses or equivalent protective measures where required.'
        )},
    ]},
    {'title': '6. Retention Periods', 'paras': [
        {'type': 'p', 'text': (
            'Data is kept only for as long as necessary to operate the '
            'service, meet legal obligations, respond to disputes or '
            'claims, maintain security, and comply with accounting or '
            'compliance requirements.'
        )},
    ]},
    {'title': '7. Your Rights', 'paras': [
        {'type': 'p', 'text': (
            'You may request access, rectification, deletion, restriction, '
            'objection, or portability of your personal data, subject to '
            'applicable law. Requests may be sent to '
            'contact@sharemechat.com.'
        )},
    ]},
    {'title': '8. Security Measures', 'paras': [
        {'type': 'p', 'text': (
            'We use measures such as encrypted connections, secure '
            'cookie-based authentication where applicable, anti-abuse '
            'systems, activity logs, fraud detection, and data '
            'minimization practices appropriate for the nature of the '
            'service.'
        )},
    ]},
    {'title': '9. Minors', 'paras': [
        {'type': 'p', 'text': (
            'SharemeChat is strictly intended for adults aged 18 or older. '
            'If we detect that a minor has provided personal data, we may '
            'remove that data and block access to the platform.'
        )},
    ]},
    {'title': '10. Policy Updates', 'paras': [
        {'type': 'p', 'text': (
            'We may update this Privacy Policy from time to time to '
            'reflect changes in the service, legal requirements, or '
            'operational needs. The current version published on the '
            'website will always apply.'
        )},
    ]},
]

# 3) Refund Policy
REFUND_INTRO = (
    'This Refund Policy explains how refund requests are handled for '
    'SharemeChat. Refunds are not automatic and are reviewed on a '
    'case-by-case basis.'
)
REFUND_SECTIONS = [
    {'title': '1. When Refunds May Be Considered', 'paras': [
        {'type': 'p', 'text': (
            'We may consider a refund or account adjustment in cases such '
            'as verified technical errors, duplicate charges, incorrect '
            'billing, or other verifiable incidents that materially '
            'affected premium usage.'
        )},
    ]},
    {'title': '2. How to Request a Refund', 'paras': [
        {'type': 'p', 'text': (
            'To request a review, please email us at '
            '<b>contact@sharemechat.com</b> and include: the email on your '
            'account, the date/time of the issue, the amount, and any '
            'relevant details or screenshots. If available, include the '
            'transaction reference shown in your payment confirmation.'
        )},
    ]},
    {'title': '3. Review Timeline', 'paras': [
        {'type': 'p', 'text': (
            'We aim to review and respond within <b>5 business days</b>. '
            'Additional time may be required in complex cases or where '
            'payment disputes or chargebacks are involved.'
        )},
    ]},
    {'title': '4. Outcomes', 'paras': [
        {'type': 'p', 'text': (
            'Outcomes may include a refund, an account balance adjustment, '
            'a credit, or a denial where the request cannot be '
            'substantiated or where premium usage was delivered as '
            'intended.'
        )},
    ]},
]

# 4) Cookies Policy
COOKIES_INTRO = (
    'This Cookie Policy explains how cookies and similar technologies are '
    'used on sharemechat.com and how users can manage them.'
)
COOKIES_SECTIONS = [
    {'title': '1. What Cookies Are', 'paras': [
        {'type': 'p', 'text': (
            'Cookies are small files stored on your device when you browse '
            'a website. They help the platform function properly, '
            'remember certain settings, support security, and improve the '
            'overall service.'
        )},
    ]},
    {'title': '2. Types of Cookies We May Use', 'paras': [
        {'type': 'p', 'text': (
            'We may use strictly necessary cookies, preference cookies, '
            'security cookies, and optional analytics cookies when an '
            'appropriate legal basis exists.'
        )},
    ]},
    {'title': '3. Essential Session Cookies', 'paras': [
        {'type': 'p', 'text': (
            'Authentication-related cookies may be used to maintain '
            'logged-in sessions, refresh secure tokens, and support '
            'account access. These cookies are necessary for core '
            'platform functionality.'
        )},
    ]},
    {'title': '4. Managing Cookie Settings', 'paras': [
        {'type': 'p', 'text': (
            'You can manage or delete cookies through your browser '
            'settings. Disabling strictly necessary cookies may prevent '
            'parts of the service from functioning correctly, including '
            'account login and session continuity.'
        )},
    ]},
    {'title': '5. Third-Party Cookies', 'paras': [
        {'type': 'p', 'text': (
            'If we integrate third-party services such as analytics, '
            'embedded tools, or payment providers, those services may set '
            'their own cookies in accordance with their own policies.'
        )},
    ]},
    {'title': '6. Controller Information', 'paras': [
        {'type': 'addr', 'text': (
            'Shareme Technologies OÜ<br/>'
            'Registry code: 17444422<br/>'
            'Lõõtsa tn 5, 11415 Tallinn, Harju maakond, Estonia<br/>'
            'contact@sharemechat.com'
        )},
    ]},
    {'title': '7. Changes to This Policy', 'paras': [
        {'type': 'p', 'text': (
            'We may update this Cookie Policy to reflect changes in '
            'platform functionality, third-party integrations, or legal '
            'requirements. The current version published on the site will '
            'always be the applicable one.'
        )},
    ]},
]

# 5) Complaints Policy
COMPLAINTS_INTRO = (
    'This Complaints Policy explains how users can submit complaints and '
    'how SharemeChat reviews and resolves them.'
)
COMPLAINTS_SECTIONS = [
    {'title': '1. How to Submit a Complaint', 'paras': [
        {'type': 'p', 'text': (
            'Complaints can be submitted by email to '
            '<b>contact@sharemechat.com</b>. Please include your account '
            'email, a description of the issue, relevant dates, and any '
            'supporting evidence such as screenshots or transaction '
            'details.'
        )},
    ]},
    {'title': '2. Review Process', 'paras': [
        {'type': 'p', 'text': (
            'Each complaint is reviewed using available technical records, '
            'account activity, moderation logs, and any information '
            'provided by the user. Additional information may be requested '
            'if necessary to complete the review.'
        )},
    ]},
    {'title': '3. Response Time', 'paras': [
        {'type': 'p', 'text': (
            'We aim to acknowledge and respond to complaints within '
            '<b>5 business days</b>. More complex cases may require '
            'additional time.'
        )},
    ]},
    {'title': '4. Possible Outcomes', 'paras': [
        {'type': 'p', 'text': (
            'Depending on the case, outcomes may include clarification of '
            'the situation, account adjustments, refund review, '
            'moderation review, or no action if the complaint cannot be '
            'substantiated.'
        )},
    ]},
    {'title': '5. Escalation', 'paras': [
        {'type': 'p', 'text': (
            'If you are not satisfied with the outcome, you may request a '
            'further review by replying to the same email thread. '
            'SharemeChat will perform an additional internal review where '
            'appropriate.'
        )},
    ]},
]

# 6) Appeals & Takedown Policy
APPEALS_INTRO = (
    'This policy explains how users or affected parties can request a '
    'review of moderation decisions or request the removal of content or '
    'material that may violate rights, platform rules, or applicable law.'
)
APPEALS_SECTIONS = [
    {'title': '1. Appeals', 'paras': [
        {'type': 'p', 'text': (
            'If you believe that a moderation action, restriction, '
            'suspension, or account-related decision was made in error, '
            'you may request a review by emailing '
            '<b>contact@sharemechat.com</b>. Please include your account '
            'email, a description of the decision being challenged, the '
            'approximate date and time, and any supporting context.'
        )},
    ]},
    {'title': '2. Takedown Requests', 'paras': [
        {'type': 'p', 'text': (
            'If you believe that content, material, or activity on '
            'SharemeChat infringes your rights, violates platform rules, '
            'or should otherwise be reviewed for removal, you may submit '
            'a takedown request to <b>contact@sharemechat.com</b>. Please '
            'provide sufficient detail to identify the content or '
            'activity, explain the basis of the request, and include any '
            'relevant supporting information.'
        )},
    ]},
    {'title': '3. Review Criteria', 'paras': [
        {'type': 'p', 'text': (
            'SharemeChat may review appeals and takedown requests using '
            'available technical records, account information, moderation '
            'records, internal logs, and the materials submitted with the '
            'request. We may request additional information where '
            'necessary.'
        )},
    ]},
    {'title': '4. Response Time', 'paras': [
        {'type': 'p', 'text': (
            'We aim to review and respond within <b>5 business days</b>, '
            'although some matters may require additional time depending '
            'on complexity, evidence, or legal considerations.'
        )},
    ]},
    {'title': '5. Possible Outcomes', 'paras': [
        {'type': 'p', 'text': (
            'Outcomes may include confirmation of the original decision, '
            'reversal or modification of a moderation measure, '
            'restriction or removal of the relevant content or activity, '
            'a request for more information, or no action where the '
            'request cannot be substantiated.'
        )},
    ]},
    {'title': '6. Further Review', 'paras': [
        {'type': 'p', 'text': (
            'If you are not satisfied with the outcome, you may reply to '
            'the same email thread and request a further internal review. '
            'SharemeChat may carry out an additional review where '
            'appropriate.'
        )},
    ]},
]

# 7) Safety + Community Guidelines (combinado)
SAFETY_COMBINED_INTRO = (
    'This document is the SharemeChat Content Management Policy. It '
    'brings together the platform safeguards, the community guidelines '
    'that all users must follow during live sessions, and the procedures '
    'that govern how the platform verifies the identity and the adult '
    'age of every content provider and how written agreements with '
    'those providers are concluded and preserved. Part I covers '
    'safeguards, moderation, privacy and protection of minors. Part II '
    'defines the operational rules that users must follow during live '
    'sessions and other interactions on the platform. Part III '
    'documents the verification and contractual procedures applied to '
    'content providers.'
)
PROVIDER_PART_INTRO = (
    'This part documents the procedures applied to every content '
    'provider (model) before onboarding and the contractual framework '
    'that governs the relationship between SharemeChat and each '
    'provider. These procedures support compliance with Card Brand '
    'rules (including Mastercard Announcement AN 5196 and Visa Rule ID '
    '0003356) and with the records-keeping expectations of the adult '
    'streaming industry.'
)
PROVIDER_SECTIONS = [
    {'title': 'Age and Identity Verification of Content Providers', 'paras': [
        {'type': 'p', 'text': (
            'Every content provider is required to complete identity '
            'and age verification through Didit, a third-party '
            'identity verification processor, before onboarding and '
            'before initiating any live session. No content provider '
            'is permitted to start live sessions without a successful '
            'verification outcome.'
        )},
        {'type': 'p', 'text': (
            'The verification procedure includes:'
        )},
        {'type': 'ul', 'items': [
            'Government-issued identification document verification.',
            'Selfie capture with liveness detection.',
            'Face match between the selfie and the identification document.',
            'Device and IP analysis at the time of verification.',
        ]},
        {'type': 'p', 'text': (
            'Verification records are retained for a minimum of seven '
            '(7) years after the last activity of the content provider '
            'on the platform.'
        )},
    ]},
    {'title': 'Written Agreements with Content Providers', 'paras': [
        {'type': 'p', 'text': (
            'Every content provider electronically signs the Model '
            'Collaboration Agreement before the first onboarding step '
            'is completed. The currently active version is '
            'model_contract_v4_2026-03-23. A SHA-256 hash of the '
            'signed version is recorded and the acceptance trail '
            '(timestamp, originating IP address, user agent) is '
            'preserved in the model_contract_acceptances table.'
        )},
        {'type': 'p', 'text': (
            'The Model Collaboration Agreement prohibits the following '
            'conduct on the platform:'
        )},
        {'type': 'ul', 'items': [
            'Any illegal activity under the laws applicable to the provider, the platform, or the viewer.',
            'Any conduct that violates Card Brand standards or payment processor rules.',
            'Non-consensual content of any kind.',
            'Any content involving minors.',
            'Any content produced under coercion, threat, or human trafficking.',
        ]},
        {'type': 'p', 'text': (
            'A sample copy of the Model Collaboration Agreement is '
            'available upon formal written request addressed to the '
            'Custodian of Records identified in the 18 U.S.C. § 2257 '
            'Records-Keeping Statement.'
        )},
    ]},
]
SAFETY_PART_INTRO = (
    'The safety of our users is extremely important to us. SharemeChat '
    'uses technical safeguards, moderation systems and security policies '
    'designed to protect both users and models while using the platform.'
)
SAFETY_SECTIONS = [
    {'title': 'User Protection', 'paras': [
        {'type': 'p', 'text': (
            'SharemeChat implements monitoring systems and moderation '
            'tools to detect abusive behaviour, fraud attempts and '
            'violations of the platform rules. Sessions may be terminated '
            'and accounts suspended if suspicious activity is detected.'
        )},
    ]},
    {'title': 'Privacy', 'paras': [
        {'type': 'p', 'text': (
            'We take privacy seriously. Personal data and technical '
            'information are handled according to our Privacy Policy and '
            'applicable data protection laws. Users should avoid sharing '
            'personal contact information with people they meet online.'
        )},
    ]},
    {'title': 'Moderation', 'paras': [
        {'type': 'p', 'text': (
            'The platform may use automated tools as well as human '
            'moderation to maintain a safe environment. Reports submitted '
            'by users are reviewed and may lead to warnings, session '
            'termination, temporary suspension or permanent bans.'
        )},
    ]},
    {'title': 'Reporting Abuse', 'paras': [
        {'type': 'p', 'text': (
            'If you encounter inappropriate behaviour you should end the '
            'session and report the user through the platform tools '
            'whenever possible. Reports help improve the safety of the '
            'community.'
        )},
    ]},
    {'title': 'Protection of Minors', 'paras': [
        {'type': 'p', 'text': (
            'SharemeChat is strictly intended for adults aged 18 and '
            'older. Accounts suspected of belonging to minors may be '
            'suspended and age verification may be requested when '
            'necessary.'
        )},
    ]},
    {'title': 'Tips for Safe Use', 'paras': [
        {'type': 'p', 'text': (
            'For a safe experience we recommend that users avoid sharing '
            'personal contact information, financial details or private '
            'data during conversations. If something makes you '
            'uncomfortable you should immediately end the session.'
        )},
    ]},
]
COMMUNITY_PART_INTRO = (
    'This part forms part of the SharemeChat Terms of Service. These '
    'Community Guidelines define the basic rules for using the platform '
    'and participating in live video sessions. By using SharemeChat, you '
    'agree to comply with these rules. Violations may result in '
    'warnings, session termination, temporary suspension, or permanent '
    'bans. Effective date: March 2026.'
)
COMMUNITY_SECTIONS = [
    {'title': 'Mandatory Rules', 'paras': [
        {'type': 'p', 'text': (
            'The rules below apply to all users of SharemeChat and are '
            'intended to protect the platform, users, and the integrity '
            'of live sessions.'
        )},
    ]},
    {'title': '1. Adults Only', 'paras': [
        {'type': 'p', 'text': (
            'SharemeChat is strictly intended for users aged 18 or older. '
            'If we reasonably suspect that a user is under the age of 18, '
            'we may request proof of age. Failure to provide verification '
            'may result in immediate account termination.'
        )},
    ]},
    {'title': '2. Respect Your Chat Partner', 'paras': [
        {'type': 'p', 'text': (
            'Users must treat others with respect. Offensive language, '
            'harassment, threats, hate speech, intimidation, or abusive '
            'behavior are not allowed on the platform.'
        )},
    ]},
    {'title': '3. Face Visibility Requirement', 'paras': [
        {'type': 'p', 'text': (
            'During live sessions, your face should remain clearly '
            'visible. Users may not point the camera away from '
            'themselves, use freeze-frames, broadcast pre-recorded '
            'content, or simulate a live presence in any misleading way.'
        )},
    ]},
    {'title': '4. Public Area Conduct', 'paras': [
        {'type': 'p', 'text': (
            'In public or non-age-gated areas of the platform, users must '
            'remain appropriately presented and comply with all platform '
            'safety requirements. Any behavior that is unsafe, deceptive, '
            'or clearly inappropriate for a general-access area may lead '
            'to enforcement.'
        )},
    ]},
    {'title': '5. Prohibited Behaviour', 'paras': [
        {'type': 'p', 'text': (
            'The following behavior is strictly prohibited:'
        )},
        {'type': 'ul', 'items': [
            'Harassment, abusive language, or threats.',
            'Impersonation, scams, or fraudulent conduct.',
            'Illegal activity or attempts to involve minors.',
            'Attempts to deceive other users or moderators.',
            'Attempts to bypass platform safeguards or moderation.',
        ]},
    ]},
    {'title': '6. Reports and Moderation', 'paras': [
        {'type': 'p', 'text': (
            'SharemeChat may use reports, technical signals, and '
            'moderation processes to investigate suspected violations. '
            'Users are encouraged to report inappropriate conduct through '
            'the platform whenever necessary.'
        )},
    ]},
    {'title': '7. Enforcement', 'paras': [
        {'type': 'p', 'text': (
            'SharemeChat reserves the right to terminate sessions, '
            'suspend accounts, or permanently ban users who violate these '
            'Community Guidelines. The severity and duration of '
            'enforcement measures will depend on the nature and '
            'seriousness of the violation.'
        )},
    ]},
]

# 8) Contact Information
CONTACT_INTRO = (
    'If you need help, have a complaint, or want to request a review of '
    'a moderation decision, you can contact us using the details below.'
)
CONTACT_SECTIONS = [
    {'title': 'Corporate Information', 'paras': [
        {'type': 'addr', 'text': (
            'Shareme Technologies OÜ<br/>'
            'Registry code: 17444422<br/>'
            'Lõõtsa tn 5, 11415 Tallinn, Harju maakond, Estonia'
        )},
    ]},
    {'title': 'Support and General Inquiries', 'paras': [
        {'type': 'p', 'text': (
            'Email: <b>contact@sharemechat.com</b>'
        )},
    ]},
    {'title': 'Complaints and Policy Requests', 'paras': [
        {'type': 'p', 'text': (
            'If you wish to submit a complaint or request content '
            'review/takedown, please email '
            '<b>contact@sharemechat.com</b> with as much detail as '
            'possible (account email, date/time, screenshots, and any '
            'relevant context).'
        )},
    ]},
]


# 9) 18 U.S.C. § 2257 Records-Keeping Statement
RECORDS_2257_INTRO = (
    'This statement describes the position of SharemeChat (operated by '
    'Shareme Technologies OÜ) with respect to the records-keeping '
    'requirements of 18 U.S.C. § 2257 and identifies the records that '
    'SharemeChat maintains in good faith and pursuant to Card Brand '
    'rules.'
)
RECORDS_2257_SECTIONS = [
    {'title': '1. Nature of the Service', 'paras': [
        {'type': 'p', 'text': (
            'SharemeChat operates a private one-to-one live video '
            'service between two verified consenting adults. Sessions '
            'are not recorded, not broadcast publicly, not archived, '
            'and not made available for later viewing. As stated in '
            'our Terms of Service §13 ("No Recording or Reuse of '
            'Private Sessions"), capturing, reproducing, distributing, '
            'or otherwise reusing private sessions is prohibited. '
            'Communications between the two adults are ephemeral and '
            'exist only for the duration of the live session.'
        )},
    ]},
    {'title': '2. Regulatory Position with Respect to 18 U.S.C. § 2257', 'paras': [
        {'type': 'p', 'text': (
            'Section 2257 of Title 18 of the United States Code '
            'applies to producers of visual depictions of actual '
            'sexually explicit conduct that are recorded, stored, or '
            'distributed. SharemeChat is not a producer of such matter '
            'within the strict meaning of Section 2257: SharemeChat '
            'does not record, store, archive, or distribute the visual '
            'content exchanged in private one-to-one sessions. The '
            'platform provides ephemeral, real-time point-to-point '
            'video communication only.'
        )},
        {'type': 'p', 'text': (
            'Notwithstanding the above, and in good faith and in '
            'alignment with Card Brand rules (including Mastercard '
            'Announcement AN 5196 and Visa Rule ID 0003356), '
            'SharemeChat maintains records that verify the identity '
            'and the adult age of every content provider before any '
            'session may occur.'
        )},
    ]},
    {'title': '3. Records Maintained', 'paras': [
        {'type': 'p', 'text': (
            'Prior to onboarding and the initiation of any live '
            'session, each content provider is required to complete '
            'identity and age verification through Didit, a '
            'third-party identity verification processor. The '
            'following records are maintained:'
        )},
        {'type': 'ul', 'items': [
            'Government-issued identification document verification.',
            'Selfie capture with liveness detection.',
            'Face match between the selfie and the identification document.',
            'Device and IP analysis at the time of verification.',
            'Acceptance trail of the Model Collaboration Agreement, including timestamp, originating IP address, user agent, and SHA-256 hash of the executed agreement version.',
        ]},
        {'type': 'p', 'text': (
            'Verification records are retained for a minimum of seven '
            '(7) years following the last activity of the content '
            'provider on the platform.'
        )},
    ]},
    {'title': '4. Custodian of Records', 'paras': [
        {'type': 'p', 'text': (
            'The Custodian of Records for the verification material '
            'described above is:'
        )},
        {'type': 'addr', 'text': (
            'Alain Garmendia<br/>'
            'Director / Founder<br/>'
            'Shareme Technologies OÜ<br/>'
            'Estonian Business Registry No. 17444422<br/>'
            'Lõõtsa tn 5, 11415 Tallinn, Estonia<br/>'
            'contact@sharemechat.com'
        )},
    ]},
    {'title': '5. Lawful Requests for Records', 'paras': [
        {'type': 'p', 'text': (
            'In the event of a valid subpoena or lawful request '
            'originating from competent authorities of the United '
            'States, verification records are made available through a '
            'formal request addressed in writing to the Custodian of '
            'Records identified in Section 4. SharemeChat reviews each '
            'request for legal validity, scope, and applicable '
            'confidentiality obligations before responding.'
        )},
    ]},
    {'title': '6. Updates', 'paras': [
        {'type': 'p', 'text': (
            'This statement may be updated to reflect changes in '
            'applicable rules, in the verification provider, in the '
            'records retention schedule, or in the contact details of '
            'the Custodian of Records. The most recent version is the '
            'one published on the platform.'
        )},
    ]},
]

# ----------------------------------------------------------------------
# Generación
# ----------------------------------------------------------------------
OUTDIR = r'C:\Users\alain\Downloads\sharemechat_legal_pdfs_segpay'

def main():
    os.makedirs(OUTDIR, exist_ok=True)

    jobs = [
        ('SharemeChat_Terms_and_Conditions.pdf',
         'Terms and Conditions', TERMS_INTRO, TERMS_SECTIONS, None),
        ('SharemeChat_Privacy_Policy.pdf',
         'Privacy Policy', PRIVACY_INTRO, PRIVACY_SECTIONS, None),
        ('SharemeChat_Refund_Policy.pdf',
         'Refund Policy', REFUND_INTRO, REFUND_SECTIONS, None),
        ('SharemeChat_Cookies_Policy.pdf',
         'Cookies Policy', COOKIES_INTRO, COOKIES_SECTIONS, None),
        ('SharemeChat_Complaints_Policy.pdf',
         'Complaints Policy', COMPLAINTS_INTRO, COMPLAINTS_SECTIONS, None),
        ('SharemeChat_Appeals_Policy.pdf',
         'Appeals and Takedown Policy', APPEALS_INTRO, APPEALS_SECTIONS,
         None),
        ('SharemeChat_Content_Management_Policy.pdf',
         'Content Management Policy', SAFETY_COMBINED_INTRO, None,
         [
             {'title': 'Part I — Safety & Security',
              'intro': SAFETY_PART_INTRO,
              'sections': SAFETY_SECTIONS},
             {'title': 'Part II — Community Guidelines',
              'intro': COMMUNITY_PART_INTRO,
              'sections': COMMUNITY_SECTIONS},
             {'title': 'Part III — Content Provider Verification and Agreements',
              'intro': PROVIDER_PART_INTRO,
              'sections': PROVIDER_SECTIONS},
         ]),
        ('SharemeChat_2257_Statement.pdf',
         '18 U.S.C. § 2257 — Records-Keeping Statement',
         RECORDS_2257_INTRO, RECORDS_2257_SECTIONS, None),
        ('SharemeChat_Contact_Information.pdf',
         'Contact Information', CONTACT_INTRO, CONTACT_SECTIONS, None),
    ]

    for filename, title, intro, sections, parts in jobs:
        path = os.path.join(OUTDIR, filename)
        render_pdf(path, title, intro, sections, parts=parts)
        size_kb = os.path.getsize(path) / 1024.0
        print('OK  %s  (%.1f KB)' % (filename, size_kb))


if __name__ == '__main__':
    main()
