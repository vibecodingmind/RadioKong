#!/usr/bin/env python3
"""
RadioKong - Product Requirements & Planning Document
Body PDF (ReportLab) - merged with cover via pypdf
"""

import os, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, CondPageBreak, Image
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ─── Font Registration ───
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSans', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSans-Bold', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
registerFontFamily('LiberationSerif', normal='LiberationSerif', bold='LiberationSerif-Bold')
registerFontFamily('LiberationSans', normal='LiberationSans', bold='LiberationSans-Bold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans-Bold')

# ─── Cascade Palette ───
PAGE_BG       = colors.HexColor('#f3f3f1')
SECTION_BG    = colors.HexColor('#f0efee')
CARD_BG       = colors.HexColor('#edecea')
TABLE_STRIPE  = colors.HexColor('#ecebe9')
HEADER_FILL   = colors.HexColor('#796e4d')
COVER_BLOCK   = colors.HexColor('#645b43')
BORDER        = colors.HexColor('#cfcbbe')
ICON          = colors.HexColor('#998956')
ACCENT        = colors.HexColor('#5939b8')
ACCENT_2      = colors.HexColor('#44b07a')
TEXT_PRIMARY   = colors.HexColor('#21201e')
TEXT_MUTED     = colors.HexColor('#8b8982')
SEM_SUCCESS   = colors.HexColor('#3b8855')
SEM_WARNING   = colors.HexColor('#9d824c')
SEM_ERROR     = colors.HexColor('#8c4e48')
SEM_INFO      = colors.HexColor('#53779c')

# ─── Page Setup ───
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 1.0 * inch
RIGHT_MARGIN = 1.0 * inch
TOP_MARGIN = 0.8 * inch
BOTTOM_MARGIN = 0.8 * inch
CONTENT_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

# ─── Styles ───
styles = getSampleStyleSheet()

h1_style = ParagraphStyle(
    'H1', fontName='LiberationSerif', fontSize=20, leading=28,
    spaceBefore=18, spaceAfter=10, textColor=ACCENT, alignment=TA_LEFT
)
h2_style = ParagraphStyle(
    'H2', fontName='LiberationSerif', fontSize=15, leading=22,
    spaceBefore=14, spaceAfter=8, textColor=HEADER_FILL, alignment=TA_LEFT
)
h3_style = ParagraphStyle(
    'H3', fontName='LiberationSerif', fontSize=12, leading=18,
    spaceBefore=10, spaceAfter=6, textColor=TEXT_PRIMARY, alignment=TA_LEFT
)
body_style = ParagraphStyle(
    'Body', fontName='LiberationSerif', fontSize=10.5, leading=17,
    spaceBefore=2, spaceAfter=6, textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY
)
body_left = ParagraphStyle(
    'BodyLeft', fontName='LiberationSerif', fontSize=10.5, leading=17,
    spaceBefore=2, spaceAfter=6, textColor=TEXT_PRIMARY, alignment=TA_LEFT
)
bullet_style = ParagraphStyle(
    'Bullet', fontName='LiberationSerif', fontSize=10.5, leading=17,
    spaceBefore=1, spaceAfter=3, textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    leftIndent=24, bulletIndent=12
)
caption_style = ParagraphStyle(
    'Caption', fontName='LiberationSerif', fontSize=9, leading=13,
    spaceBefore=3, spaceAfter=6, textColor=TEXT_MUTED, alignment=TA_CENTER
)
callout_style = ParagraphStyle(
    'Callout', fontName='LiberationSerif', fontSize=11, leading=17,
    spaceBefore=6, spaceAfter=6, textColor=ACCENT, alignment=TA_LEFT,
    leftIndent=12, borderPadding=8
)
th_style = ParagraphStyle(
    'TH', fontName='LiberationSans', fontSize=10, leading=14,
    textColor=colors.white, alignment=TA_CENTER
)
td_style = ParagraphStyle(
    'TD', fontName='LiberationSans', fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, wordWrap='CJK'
)
td_center = ParagraphStyle(
    'TDCenter', fontName='LiberationSans', fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER
)

# ─── TOC Template ───
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def add_heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/>%s' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

H1_ORPHAN_THRESHOLD = (PAGE_H - TOP_MARGIN - BOTTOM_MARGIN) * 0.15

def add_major_section(text):
    return [
        CondPageBreak(H1_ORPHAN_THRESHOLD),
        add_heading(text, h1_style, level=0),
    ]

def make_table(data, col_widths=None, has_header=True):
    """Create a styled table with standard formatting."""
    available = CONTENT_W
    if col_widths is None:
        n = len(data[0]) if data else 1
        col_widths = [available / n] * n
    else:
        total = sum(col_widths)
        if total < available * 0.85:
            scale = (available * 0.92) / total
            col_widths = [w * scale for w in col_widths]

    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ]
    if has_header:
        style_cmds.extend([
            ('BACKGROUND', (0, 0), (-1, 0), ACCENT),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ])
        for i in range(1, len(data)):
            bg = colors.white if i % 2 == 1 else TABLE_STRIPE
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

# ─── Build Document ───
OUTPUT_PATH = '/home/z/my-project/download/radiokong_body.pdf'

doc = TocDocTemplate(
    OUTPUT_PATH, pagesize=A4,
    leftMargin=LEFT_MARGIN, rightMargin=RIGHT_MARGIN,
    topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
    title='RadioKong - Product Requirements Document',
    author='Z.ai', creator='Z.ai'
)

story = []

# ─── Table of Contents ───
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle('TOC1', fontName='LiberationSerif', fontSize=13, leftIndent=20, spaceBefore=6, spaceAfter=3, textColor=TEXT_PRIMARY),
    ParagraphStyle('TOC2', fontName='LiberationSerif', fontSize=11, leftIndent=40, spaceBefore=2, spaceAfter=2, textColor=TEXT_MUTED),
]
story.append(Paragraph('<b>Table of Contents</b>', ParagraphStyle(
    'TOCTitle', fontName='LiberationSerif', fontSize=22, leading=30,
    spaceBefore=20, spaceAfter=16, textColor=ACCENT, alignment=TA_LEFT
)))
story.append(toc)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 1: Executive Summary
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('1. Executive Summary'))
story.append(Paragraph(
    'RadioKong is a next-generation internet radio streaming application designed to revolutionize how broadcasters connect with their audiences. The global internet radio market, valued at approximately $3.22 billion in 2025, is projected to reach $6.47 billion by 2031, representing a compound annual growth rate of over 10%. Despite this explosive growth, the tools available to broadcasters remain stuck in the past, plagued by outdated interfaces, fragmented feature sets, and confusing technical barriers that prevent talented individuals from going live with confidence and ease.',
    body_style
))
story.append(Paragraph(
    'Current market leaders such as BUTT (Broadcast Using This Tool), WinAMP with the SHOUTcast DSP plugin, SAM Broadcaster, and Rocket Broadcaster each serve a slice of the market, but none deliver a truly modern, intuitive, cross-platform experience. BUTT, while free and multi-platform, suffers from a dated UI, frequent stability issues during long broadcasts, and limited codec support. WinAMP relies on a plugin architecture from the late 1990s and is Windows-only. SAM Broadcaster, at $299 for a one-time license, offers powerful automation features but is complex, Windows-restricted, and poorly suited to the modern subscription economy. Rocket Broadcaster provides excellent encoding quality but lacks the built-in audio processing tools that most broadcasters need.',
    body_style
))
story.append(Paragraph(
    'RadioKong fills this gap by combining the simplicity of BUTT, the power of SAM Broadcaster, and the encoding quality of Rocket Broadcaster into a single, modern, cross-platform application with a commercial subscription model. The platform will support Windows, macOS, and Linux from day one, offer built-in audio processing (equalizer, compressor, limiter, noise gate) alongside full external hardware mixer support, stream to Icecast, SHOUTcast, and modern WebRTC endpoints, and provide real-time monitoring dashboards that give broadcasters instant visual feedback on their audio quality and stream health.',
    body_style
))
story.append(Paragraph(
    'The name "RadioKong" evokes strength, community, and an unmistakable presence, positioning the product as the king of internet radio broadcasting tools. The subscription pricing model ensures sustainable revenue while keeping the entry barrier low, with a free tier for hobbyists and paid tiers starting at $9.99 per month for professional features.',
    body_style
))

# ═══════════════════════════════════════════════════════════
# SECTION 2: Market Analysis
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('2. Market Analysis & Competitive Landscape'))

story.append(add_heading('2.1 Market Overview', h2_style, level=1))
story.append(Paragraph(
    'The internet radio market has experienced significant transformation over the past decade. The shift from traditional FM/AM broadcasting to online streaming has democratized radio, enabling anyone with a computer and an internet connection to reach a global audience. The COVID-19 pandemic accelerated this trend dramatically, as lockdowns forced traditional radio personalities, podcasters, and musicians to find new ways to connect with their audiences remotely. This created a surge in demand for reliable, easy-to-use broadcasting tools, a demand that existing software has struggled to meet adequately.',
    body_style
))
story.append(Paragraph(
    'The market can be segmented into three primary user categories: hobbyist broadcasters who stream casually for small audiences, semi-professional broadcasters such as community radio stations, podcasters, and independent DJs who need reliable daily streaming, and professional broadcasters including established internet radio stations, network affiliates, and commercial operations that require enterprise-grade reliability and advanced features. Each segment has distinct needs, but all share a common frustration: the current tool landscape forces them to choose between simplicity and power, between free-but-limited and expensive-but-comprehensive.',
    body_style
))

story.append(add_heading('2.2 Competitive Analysis', h2_style, level=1))
story.append(Paragraph(
    'The following table provides a detailed comparison of the major competitors currently serving the internet radio broadcasting market. Each product has been evaluated across critical dimensions including platform support, codec availability, audio processing capabilities, pricing model, and overall user experience quality.',
    body_style
))

comp_data = [
    [Paragraph('<b>Feature</b>', th_style),
     Paragraph('<b>BUTT</b>', th_style),
     Paragraph('<b>WinAMP/DSP</b>', th_style),
     Paragraph('<b>SAM Broadcaster</b>', th_style),
     Paragraph('<b>Rocket Broadcaster</b>', th_style),
     Paragraph('<b>Mixxx</b>', th_style)],
    [Paragraph('Platform', td_style),
     Paragraph('Win/Mac/Linux', td_center),
     Paragraph('Windows Only', td_center),
     Paragraph('Windows Only', td_center),
     Paragraph('Windows Only', td_center),
     Paragraph('Win/Mac/Linux', td_center)],
    [Paragraph('Price', td_style),
     Paragraph('Free', td_center),
     Paragraph('Free', td_center),
     Paragraph('$299 one-time', td_center),
     Paragraph('Free / $49 Pro', td_center),
     Paragraph('Free (Open Source)', td_center)],
    [Paragraph('Codecs', td_style),
     Paragraph('MP3, OGG, FLAC, AAC', td_center),
     Paragraph('MP3, AAC (limited)', td_center),
     Paragraph('MP3, OGG, AAC, WMA', td_center),
     Paragraph('MP3, OGG, AAC, FLAC, Opus', td_center),
     Paragraph('MP3, OGG, FLAC', td_center)],
    [Paragraph('Built-in DSP', td_style),
     Paragraph('None', td_center),
     Paragraph('None', td_center),
     Paragraph('EQ, AGC, Compressor, Expander', td_center),
     Paragraph('Basic gain only', td_center),
     Paragraph('EQ, Compressor (DJ-focused)', td_center)],
    [Paragraph('Server Protocol', td_style),
     Paragraph('Icecast, SHOUTcast', td_center),
     Paragraph('SHOUTcast only', td_center),
     Paragraph('Icecast, SHOUTcast', td_center),
     Paragraph('Icecast, SHOUTcast, RSAS', td_center),
     Paragraph('Icecast, SHOUTcast', td_center)],
    [Paragraph('UI Quality', td_style),
     Paragraph('Outdated, minimal', td_center),
     Paragraph('Very dated (1990s)', td_center),
     Paragraph('Complex, cluttered', td_center),
     Paragraph('Clean, modern', td_center),
     Paragraph('Modern, DJ-oriented', td_center)],
    [Paragraph('Stream Monitoring', td_style),
     Paragraph('Basic VU meter', td_center),
     Paragraph('None', td_center),
     Paragraph('Full monitoring', td_center),
     Paragraph('Real-time VU + status', td_center),
     Paragraph('DJ waveform display', td_center)],
    [Paragraph('Auto-Reconnect', td_style),
     Paragraph('Yes', td_center),
     Paragraph('No', td_center),
     Paragraph('Yes', td_center),
     Paragraph('Yes', td_center),
     Paragraph('Yes', td_center)],
    [Paragraph('Metadata Support', td_style),
     Paragraph('Manual only', td_center),
     Paragraph('Basic', td_center),
     Paragraph('Advanced automation', td_center),
     Paragraph('Real-time, from file tags', td_center),
     Paragraph('From track metadata', td_center)],
]
story.append(Spacer(1, 12))
story.append(make_table(comp_data, [75, 75, 75, 80, 80, 75]))
story.append(Paragraph('<b>Table 1:</b> Competitive Feature Matrix', caption_style))
story.append(Spacer(1, 12))

story.append(add_heading('2.3 Key Pain Points in Existing Solutions', h2_style, level=1))
story.append(Paragraph(
    'Through extensive research including user forums, social media groups, product reviews, and community discussions, the following recurring pain points have been identified across all major competing products. These pain points represent the primary opportunities for RadioKong to differentiate itself and capture market share by solving problems that users have been complaining about for years without resolution.',
    body_style
))

pain_points = [
    ('Outdated User Interfaces', 'BUTT and WinAMP both suffer from interfaces that look like they belong in the early 2000s. Users report that the visual design makes them feel unprofessional and is confusing for new broadcasters. The learning curve is steep not because the functionality is complex, but because the interface obscures rather than reveals the available options. Forum posts consistently mention that first-time users need to watch multiple YouTube tutorials just to configure a basic connection to their streaming server.'),
    ('Platform Fragmentation', 'The most powerful tools, SAM Broadcaster and Rocket Broadcaster, are Windows-only. Mac and Linux users are forced to use BUTT, which lacks advanced features, or run Windows in a virtual machine, which introduces audio latency and stability problems. This fragmentation is particularly problematic because many creative professionals in the broadcasting space prefer macOS, and many server-side operations run on Linux.'),
    ('Stability and Reliability Issues', 'BUTT users frequently report crashes during long broadcasts, with Facebook groups and SourceForge forums filled with complaints about the software hanging mid-stream. Memory leaks appear to accumulate over time, making BUTT unreliable for 24/7 broadcasting scenarios. WinAMP has known compatibility issues with modern Windows versions, and the SHOUTcast DSP plugin has not been meaningfully updated in years.'),
    ('Lack of Built-in Audio Processing', 'Most free tools provide no audio processing whatsoever, forcing broadcasters to purchase and configure external hardware processors or use separate software like OBS with VST plugins to achieve professional sound quality. This adds complexity, cost, and potential points of failure to the broadcast chain. SAM Broadcaster includes processing, but its complexity and Windows-only restriction limit its accessibility.'),
    ('No Unified Monitoring', 'Broadcasters currently need to check multiple tools and dashboards to verify that their stream is healthy. They need to monitor audio levels in one place, check connection status in another, verify metadata is updating correctly in a third, and monitor listener counts on their server admin panel. There is no single, unified view that shows all critical broadcast metrics in real time.'),
]
for title, desc in pain_points:
    story.append(Paragraph('<b>%s:</b> %s' % (title, desc), body_left))
    story.append(Spacer(1, 4))

# ═══════════════════════════════════════════════════════════
# SECTION 3: Built-in Mixer Analysis
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('3. Built-in Mixer vs. Hardware Mixer Analysis'))

story.append(add_heading('3.1 The Critical Question', h2_style, level=1))
story.append(Paragraph(
    'One of the most important architectural decisions for RadioKong is whether to include a built-in software audio mixer or rely exclusively on external hardware mixers for audio routing and mixing. This decision impacts development complexity, target audience scope, user experience, and ultimately the commercial viability of the product. After thorough analysis of the market, user workflows, and competitive landscape, the recommendation is clear: RadioKong should include a built-in software mixer, but design it as a complementary feature that works seamlessly alongside external hardware rather than attempting to replace it.',
    body_style
))

story.append(add_heading('3.2 Why a Built-in Mixer is Essential', h2_style, level=1))

story.append(Paragraph('<b>Lowering the Barrier to Entry.</b> The single most compelling reason for including a built-in mixer is accessibility. A significant portion of potential RadioKong users are hobbyists, community radio volunteers, podcasters, and independent creators who do not own hardware mixers. Requiring a hardware mixer to use RadioKong would immediately exclude this entire market segment, which also happens to be the segment most likely to convert from free to paid subscriptions as they grow. If a podcaster can download RadioKong, plug in a single USB microphone, adjust levels with a software fader, and go live within five minutes, the product achieves the "instant gratification" moment that drives adoption and word-of-mouth growth. Without a built-in mixer, that same user would need to research, purchase, and learn to operate a hardware mixer before ever going live, creating a barrier that most casual broadcasters will not overcome.',
    body_style
))
story.append(Paragraph('<b>Voice-Over and Mic Mixing.</b> Even broadcasters who own hardware mixers frequently need software-level mixing capabilities. The most common scenario is the voice-over, where a broadcaster needs to lower the volume of background music while speaking into a microphone. This is trivially easy with a software mixer that provides faders for each audio source, but requires careful gain staging and auxiliary send configuration on a hardware mixer. Many small internet radio stations operate with a single operator who needs to manage music playback and microphone input simultaneously, and a software mixer with a simple "duck" or "talk-over" function is far more intuitive than configuring hardware mixer routing for the same effect.',
    body_style
))
story.append(Paragraph('<b>Audio Processing Chain Integration.</b> RadioKong plans to include built-in audio processing features such as equalization, compression, limiting, and noise gating. These processors need to be inserted at specific points in the audio signal chain, typically after mixing but before encoding. If RadioKong only supported external hardware mixers, the processing chain would need to either accept a pre-mixed signal from the hardware mixer (losing the ability to process individual sources independently) or require complex routing that defeats the simplicity goal. A built-in mixer provides natural integration points for these processors, allowing per-channel EQ before the mix bus and bus-level compression after mixing, which is exactly how professional broadcast processors work.',
    body_style
))
story.append(Paragraph('<b>Competitive Parity and Beyond.</b> SAM Broadcaster, the market leader for professional internet radio, includes a built-in mixer with faders, EQ, and processing. Mixxx includes a full DJ mixer with crossfader, EQ, and effects. Even BUTT provides basic gain control. RadioKong cannot enter the market with fewer features than the free competition and expect to win paid subscribers. However, RadioKong can differentiate by making its mixer dramatically easier to use than SAM Broadcaster while offering more broadcast-specific features than Mixxx, which is DJ-focused rather than radio-focused.',
    body_style
))

story.append(add_heading('3.3 Why Hardware Mixer Support Remains Critical', h2_style, level=1))
story.append(Paragraph(
    'While the built-in mixer is essential, it must coexist with and defer to hardware mixers when present. Professional broadcasters almost universally use external hardware mixers from brands like Behringer, Yamaha, Mackie, and Allen and Heath for several important reasons that software cannot fully replicate.',
    body_style
))
story.append(Paragraph('<b>Tactile Control.</b> Physical faders, knobs, and buttons provide immediate, eyes-off control that no software interface can match. During a live broadcast, an experienced operator can adjust multiple levels simultaneously by touch without looking away from their notes or guests. This tactile responsiveness is essential for professional live broadcasting and is the primary reason that even studios with advanced DAW software still use hardware mixing consoles.',
    body_style
))
story.append(Paragraph('<b>Superior Analog-to-Digital Conversion.</b> Professional audio interfaces and mixers from companies like Focusrite, RME, and PreSonus provide analog-to-digital conversion quality that far exceeds consumer sound cards. For broadcasters using high-quality condenser microphones, the difference is audible. RadioKong must support these interfaces natively, including low-latency ASIO drivers on Windows and CoreAudio on macOS, to satisfy professional users who demand pristine audio quality.',
    body_style
))
story.append(Paragraph('<b>Redundancy and Reliability.</b> Hardware mixers do not crash, do not suffer from operating system updates breaking audio drivers, and continue to pass audio even if the connected computer freezes. For 24/7 radio stations, this reliability is non-negotiable. RadioKong should never position its software mixer as a replacement for hardware in mission-critical broadcasting scenarios; instead, it should serve as the intelligent bridge between hardware inputs and the streaming server.',
    body_style
))

story.append(add_heading('3.4 Recommended Architecture: Hybrid Approach', h2_style, level=1))
story.append(Paragraph(
    'Based on this analysis, RadioKong should implement a hybrid audio architecture that provides a built-in software mixer for users who need it while seamlessly integrating with external hardware mixers for users who prefer them. The following table summarizes the recommended feature allocation for each approach.',
    body_style
))

mixer_data = [
    [Paragraph('<b>Capability</b>', th_style),
     Paragraph('<b>Software Mixer (Built-in)</b>', th_style),
     Paragraph('<b>Hardware Mixer (External)</b>', th_style)],
    [Paragraph('Channel Faders', td_style),
     Paragraph('Up to 4 software channels with visual faders and mute/solo', td_style),
     Paragraph('Unlimited hardware channels, mapped to software input', td_style)],
    [Paragraph('EQ per Channel', td_style),
     Paragraph('3-band parametric EQ with presets (Radio, Voice, Music)', td_style),
     Paragraph('Hardware EQ on mixer; software bypass available', td_style)],
    [Paragraph('Compressor/Limiter', td_style),
     Paragraph('Built-in broadcast compressor with preset and custom settings', td_style),
     Paragraph('Accepts pre-processed signal; optional software limiter as safety net', td_style)],
    [Paragraph('Noise Gate', td_style),
     Paragraph('Per-channel gate with threshold and release controls', td_style),
     Paragraph('Hardware gate preferred; software gate as backup', td_style)],
    [Paragraph('Mic Talk-Over / Duck', td_style),
     Paragraph('One-click duck button with configurable depth and release', td_style),
     Paragraph('Hardware duck if available; software duck as alternative', td_style)],
    [Paragraph('Audio Interface Support', td_style),
     Paragraph('Auto-detect USB/Firewire/Thunderbolt interfaces', td_style),
     Paragraph('ASIO/WASAPI/CoreAudio/JACK low-latency drivers', td_style)],
    [Paragraph('VST/AU Plugin Support', td_style),
     Paragraph('Load third-party VST/AU plugins per channel or on master bus', td_style),
     Paragraph('Not applicable (hardware domain)', td_style)],
]
story.append(Spacer(1, 12))
story.append(make_table(mixer_data, [90, 185, 185]))
story.append(Paragraph('<b>Table 2:</b> Hybrid Mixer Architecture Feature Allocation', caption_style))
story.append(Spacer(1, 12))

story.append(Paragraph(
    'The hybrid approach ensures that RadioKong works brilliantly for a solo podcaster with a USB microphone while also serving as a professional streaming frontend for a fully equipped broadcast studio. This dual-mode design is the key to capturing both the hobbyist market, which drives initial adoption and subscription growth, and the professional market, which provides stable, higher-value recurring revenue.',
    body_style
))

# ═══════════════════════════════════════════════════════════
# SECTION 4: Product Vision & Positioning
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('4. Product Vision & Positioning'))

story.append(add_heading('4.1 Vision Statement', h2_style, level=1))
story.append(Paragraph(
    'RadioKong exists to make internet radio broadcasting accessible to everyone, from the bedroom podcaster to the professional station engineer. We believe that the technical complexity of current tools is the single greatest barrier preventing talented people from sharing their voice with the world. By combining professional-grade audio quality with consumer-grade simplicity, RadioKong will become the default choice for anyone who wants to go live on internet radio.',
    body_style
))

story.append(add_heading('4.2 Positioning Statement', h2_style, level=1))
story.append(Paragraph(
    'For internet radio broadcasters who need a reliable, professional streaming tool, RadioKong is the cross-platform broadcasting application that provides studio-quality audio processing and streaming in a beautifully simple interface. Unlike BUTT, which is free but outdated and feature-limited, or SAM Broadcaster, which is powerful but expensive and Windows-only, RadioKong delivers the best of both worlds: professional features with consumer-friendly design, on every major operating system, at an affordable monthly price.',
    body_style
))

story.append(add_heading('4.3 Target User Personas', h2_style, level=1))

persona_data = [
    [Paragraph('<b>Persona</b>', th_style),
     Paragraph('<b>Description</b>', th_style),
     Paragraph('<b>Primary Need</b>', th_style),
     Paragraph('<b>Tier</b>', th_style)],
    [Paragraph('Casual Caster', td_style),
     Paragraph('Hobbyist, community volunteer, first-time broadcaster. Streams occasionally from a laptop with built-in or USB mic.', td_style),
     Paragraph('Get live quickly with zero configuration hassle', td_style),
     Paragraph('Free', td_center)],
    [Paragraph('Indie Broadcaster', td_style),
     Paragraph('Podcaster, independent DJ, small online station. Streams daily, needs reliability and decent audio quality.', td_style),
     Paragraph('Professional sound with built-in processing, schedule reliability', td_style),
     Paragraph('Pro ($9.99/mo)', td_center)],
    [Paragraph('Studio Professional', td_style),
     Paragraph('Community radio station, network affiliate, production studio. Uses hardware mixers and multiple audio sources.', td_style),
     Paragraph('Hardware integration, multi-channel routing, advanced DSP, monitoring', td_style),
     Paragraph('Studio ($24.99/mo)', td_center)],
    [Paragraph('Enterprise Station', td_style),
     Paragraph('Large internet radio network, 24/7 operation, multiple DJs and scheduled programs.', td_style),
     Paragraph('Multi-station management, API access, priority support, redundancy', td_style),
     Paragraph('Enterprise (Custom)', td_center)],
]
story.append(Spacer(1, 12))
story.append(make_table(persona_data, [80, 155, 140, 80]))
story.append(Paragraph('<b>Table 3:</b> Target User Personas', caption_style))
story.append(Spacer(1, 12))

# ═══════════════════════════════════════════════════════════
# SECTION 5: Feature Specifications
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('5. Feature Specifications'))

story.append(add_heading('5.1 Core Streaming Engine', h2_style, level=1))
story.append(Paragraph(
    'The streaming engine is the heart of RadioKong, responsible for capturing audio from hardware inputs, encoding it into the selected format and bitrate, and transmitting it to the configured streaming server. The engine must be rock-solid, capable of running continuously for days or weeks without memory leaks, buffer underruns, or connection drops. The following specifications define the minimum requirements for the V1.0 release.',
    body_style
))

engine_features = [
    ('Protocol Support', 'Icecast 2 (HTTP-based, the industry standard for open-source streaming), SHOUTcast v1 and v2 (the legacy protocol still used by many hosting providers), and WebRTC (for ultra-low-latency browser-based listening). This three-protocol approach ensures that RadioKong can connect to virtually any internet radio hosting service on the market.'),
    ('Codec Support', 'MP3 (via LAME encoder, the universal compatibility codec), OGG Vorbis (open-source, excellent quality at lower bitrates), OGG Opus (the modern codec with superior quality at very low bitrates, ideal for mobile listeners), AAC-LC and HE-AAC v2 (the codec of choice for commercial broadcasters and Apple ecosystem compatibility), and FLAC (lossless streaming for audiophile and archival purposes). Bitrates from 16 kbps to 320 kbps will be supported across all lossy codecs.'),
    ('Auto-Reconnect', 'Automatic reconnection with exponential backoff when the connection to the streaming server is interrupted. The engine will attempt to reconnect every 2 seconds initially, increasing to a maximum of 30 seconds between attempts. During reconnection, audio continues to be captured and buffered locally, with a configurable buffer size of up to 60 seconds. When the connection is restored, the buffered audio is transmitted, minimizing gaps in the broadcast.'),
    ('Multi-Server Streaming', 'Simultaneous streaming to multiple servers at different bitrates and in different codecs. This feature is essential for broadcasters who serve both desktop listeners (who can handle high-bitrate streams) and mobile listeners (who need lower bitrates to conserve data). Each server connection operates independently, so a failure of one server does not affect the others.'),
    ('Stream Health Monitoring', 'Real-time monitoring of upstream bandwidth utilization, buffer fill level, frame drop count, connection uptime, and encoder CPU usage. When any metric exceeds a configurable threshold, the UI displays a non-intrusive warning. If the stream health degrades to a critical level, the engine can automatically reduce the encoding bitrate to prevent buffer underruns, switching back to the configured bitrate when conditions improve.'),
]
for title, desc in engine_features:
    story.append(Paragraph('<b>%s:</b> %s' % (title, desc), body_left))
    story.append(Spacer(1, 4))

story.append(add_heading('5.2 Audio Processing Pipeline', h2_style, level=1))
story.append(Paragraph(
    'The audio processing pipeline transforms raw audio from input sources into broadcast-ready sound. This pipeline is inspired by professional broadcast audio processors like those from Orban and Omnia, but simplified for the RadioKong user interface. The pipeline operates in a fixed order: Input Capture, Per-Channel Processing (EQ, Gate), Channel Mixing, Bus Processing (Compressor, Limiter, Stereo Enhancer), and finally Encoder Output. Each stage can be individually bypassed, allowing advanced users to use external processing tools while keeping the safety limiter engaged.',
    body_style
))

dsp_data = [
    [Paragraph('<b>Processor</b>', th_style),
     Paragraph('<b>Parameters</b>', th_style),
     Paragraph('<b>Presets</b>', th_style),
     Paragraph('<b>Tier</b>', th_style)],
    [Paragraph('3-Band Parametric EQ', td_style),
     Paragraph('Frequency, Gain, Q per band (Low, Mid, High)', td_style),
     Paragraph('Flat, Radio Warm, Voice Clarity, Bass Boost, Bright', td_style),
     Paragraph('Free', td_center)],
    [Paragraph('Noise Gate', td_style),
     Paragraph('Threshold, Attack, Hold, Release, Range', td_style),
     Paragraph('Gentle, Tight, Broadcast', td_style),
     Paragraph('Pro+', td_center)],
    [Paragraph('Compressor', td_style),
     Paragraph('Threshold, Ratio, Attack, Release, Knee, Makeup Gain', td_style),
     Paragraph('Subtle, Radio Standard, Heavy, Voice, Music', td_style),
     Paragraph('Pro+', td_center)],
    [Paragraph('Peak Limiter', td_style),
     Paragraph('Ceiling, Release, Lookahead', td_style),
     Paragraph('Broadcast Safe (-1dB), Streaming (-0.5dB)', td_style),
     Paragraph('Pro+', td_center)],
    [Paragraph('Stereo Enhancer', td_style),
     Paragraph('Width, Mix, Center Level', td_style),
     Paragraph('Subtle, Wide, Mono Compatible', td_style),
     Paragraph('Studio+', td_center)],
    [Paragraph('De-Esser', td_style),
     Paragraph('Frequency, Threshold, Reduction', td_style),
     Paragraph('Male Voice, Female Voice, Auto', td_style),
     Paragraph('Studio+', td_center)],
]
story.append(Spacer(1, 12))
story.append(make_table(dsp_data, [95, 150, 120, 55]))
story.append(Paragraph('<b>Table 4:</b> Audio Processing Pipeline Specifications', caption_style))
story.append(Spacer(1, 12))

story.append(add_heading('5.3 User Interface Design', h2_style, level=1))
story.append(Paragraph(
    'The RadioKong UI will follow a "progressive disclosure" design philosophy, where the default view presents only the essential controls needed to go live, while advanced features are accessible through clearly labeled expandable panels. This approach ensures that new users are not overwhelmed while power users have quick access to every parameter they need. The interface will be built with modern web technologies (React or Vue) rendered via Electron or Tauri, enabling rapid iteration and consistent cross-platform appearance.',
    body_style
))
story.append(Paragraph(
    'The main screen is organized into three primary zones. The top zone displays the connection status, stream health indicators, and a large, unmissable "GO LIVE" button that transitions to a pulsing red "ON AIR" indicator when streaming. The middle zone contains the audio mixer with faders for each configured input source, VU meters showing real-time levels, and quick-access buttons for mute, solo, and talk-over functions. The bottom zone houses expandable panels for audio processing, metadata editing, server configuration, and stream history. Each panel can be collapsed, expanded, or detached into a floating window for multi-monitor setups.',
    body_style
))
story.append(Paragraph(
    'Dark mode is the default theme, as most broadcasters work in dimly lit studios where a bright interface causes eye strain during long sessions. A light theme will also be available. The color scheme uses the RadioKong brand purple as an accent color, with high-contrast text and clear visual hierarchy. All interactive elements meet WCAG 2.1 AA accessibility standards, and keyboard shortcuts are provided for every critical function, enabling experienced broadcasters to operate the software entirely without a mouse.',
    body_style
))

story.append(add_heading('5.4 Metadata Management', h2_style, level=1))
story.append(Paragraph(
    'Metadata, specifically the "now playing" title and artist information displayed on player apps and directory listings, is a critical but often overlooked feature. RadioKong will support multiple metadata sources with a configurable priority chain. The primary source is manual entry, where the broadcaster types the current track title and artist into a persistent input field. The secondary source is file-tag reading, where RadioKong monitors a designated media folder and automatically extracts ID3 tags (MP3), Vorbis comments (OGG), or iTunes tags (AAC/M4A) from the currently playing file. The tertiary source is URL polling, where RadioKong periodically fetches track information from a configurable HTTP endpoint, enabling integration with station automation systems like RadioDJ, ZaraRadio, and Rivendell. Finally, for advanced use cases, a WebSocket interface allows real-time metadata push from any external system.',
    body_style
))

story.append(add_heading('5.5 Recording', h2_style, level=1))
story.append(Paragraph(
    'Local recording of broadcasts is a frequently requested feature that no major streaming-only tool currently provides well. RadioKong will include built-in recording that captures the master output mix in WAV (uncompressed) or FLAC (lossless compression) format, independently of the streaming codec and bitrate. This means that even if the stream is encoded at 128 kbps MP3, the local recording captures full CD-quality audio. Recording can be started and stopped independently of streaming, allowing broadcasters to record rehearsals or pre-produce segments without going live. An auto-record option starts recording whenever the stream goes live and stops when the stream ends, with configurable pre-roll and post-roll padding to capture the complete broadcast.',
    body_style
))

# ═══════════════════════════════════════════════════════════
# SECTION 6: Technical Architecture
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('6. Technical Architecture'))

story.append(add_heading('6.1 Technology Stack Recommendation', h2_style, level=1))
story.append(Paragraph(
    'The recommended technology stack for RadioKong balances development velocity, runtime performance, cross-platform compatibility, and long-term maintainability. After evaluating several options including pure native development (separate apps per OS), Electron with Node.js, and Tauri with Rust, the following hybrid approach is recommended for the V1.0 release with a migration path to Tauri for V2.0.',
    body_style
))

tech_data = [
    [Paragraph('<b>Layer</b>', th_style),
     Paragraph('<b>Technology</b>', th_style),
     Paragraph('<b>Rationale</b>', th_style)],
    [Paragraph('UI Framework', td_style),
     Paragraph('React 19 + TypeScript', td_style),
     Paragraph('Largest ecosystem, fastest hiring, rich component libraries', td_style)],
    [Paragraph('Desktop Runtime', td_style),
     Paragraph('Electron 33+ (V1) / Tauri 2.0 (V2)', td_style),
     Paragraph('Electron for speed-to-market; Tauri for smaller binary and better performance later', td_style)],
    [Paragraph('Audio Engine', td_style),
     Paragraph('Rust + CPAL + Rubato', td_style),
     Paragraph('Zero-cost abstractions, memory safety, real-time audio guarantee, cross-platform audio I/O', td_style)],
    [Paragraph('Encoders', td_style),
     Paragraph('LAME (MP3), libvorbis (OGG), libopus (Opus), fdk-aac (AAC), libflac (FLAC)', td_style),
     Paragraph('Industry-standard encoders, proven in production across millions of streams', td_style)],
    [Paragraph('Audio Processing', td_style),
     Paragraph('Rust + custom DSP + VST3 SDK bindings', td_style),
     Paragraph('Low-latency processing, plugin hosting for third-party effects', td_style)],
    [Paragraph('Streaming Protocol', td_style),
     Paragraph('Custom HTTP/ICY client in Rust', td_style),
     Paragraph('Direct control over connection management, reconnect logic, and multi-server support', td_style)],
    [Paragraph('State Management', td_style),
     Paragraph('Zustand + IndexedDB', td_style),
     Paragraph('Lightweight state management with persistent local storage for configurations', td_style)],
    [Paragraph('Auto-Update', td_style),
     Paragraph('electron-updater / Tauri updater', td_style),
     Paragraph('Seamless background updates with delta patching', td_style)],
]
story.append(Spacer(1, 12))
story.append(make_table(tech_data, [85, 150, 230]))
story.append(Paragraph('<b>Table 5:</b> Recommended Technology Stack', caption_style))
story.append(Spacer(1, 12))

story.append(add_heading('6.2 Audio Pipeline Architecture', h2_style, level=1))
story.append(Paragraph(
    'The audio pipeline follows a strict unidirectional flow from input capture to encoder output. This design ensures deterministic latency and eliminates feedback loops. The Rust-based audio engine runs on a dedicated real-time thread with priority scheduling, completely isolated from the UI thread. Communication between the audio thread and UI thread uses a lock-free ring buffer, ensuring that UI operations (such as fader movements and button clicks) never block audio processing, and audio processing never blocks UI rendering.',
    body_style
))
story.append(Paragraph(
    'The pipeline stages are: (1) Input Capture, which reads audio from the configured hardware input via CPAL, supporting ALSA/PipeWire on Linux, WASAPI/ASIO on Windows, and CoreAudio on macOS. Multiple input devices can be captured simultaneously on separate channels. (2) Per-Channel Processing, where each channel passes through its configured EQ, noise gate, and gain stage independently. (3) Channel Mixing, which combines all active channels according to their fader positions and pan settings into a single stereo bus. (4) Bus Processing, where the mixed signal passes through the master compressor, limiter, stereo enhancer, and de-esser in series. (5) Recording Tap, which captures the post-bus-processing signal for local recording in lossless format. (6) Encoder Output, which encodes the processed signal into the selected codec and bitrate, then transmits it to the configured streaming server. Each stage can be individually bypassed, and the entire pipeline can be configured through a visual patch editor in the UI.',
    body_style
))

story.append(add_heading('6.3 Platform-Specific Audio Drivers', h2_style, level=1))
driver_data = [
    [Paragraph('<b>Platform</b>', th_style),
     Paragraph('<b>Primary API</b>', th_style),
     Paragraph('<b>Professional API</b>', th_style),
     Paragraph('<b>Latency Target</b>', th_style)],
    [Paragraph('Windows', td_style),
     Paragraph('WASAPI (Shared/Exclusive)', td_style),
     Paragraph('ASIO 2.3 (Steinberg)', td_style),
     Paragraph('< 10ms (ASIO), < 30ms (WASAPI)', td_style)],
    [Paragraph('macOS', td_style),
     Paragraph('CoreAudio / AUHAL', td_style),
     Paragraph('CoreAudio with AudioUnits', td_style),
     Paragraph('< 10ms', td_style)],
    [Paragraph('Linux', td_style),
     Paragraph('PipeWire (modern default)', td_style),
     Paragraph('JACK2 (professional audio)', td_style),
     Paragraph('< 5ms (JACK), < 20ms (PipeWire/ALSA)', td_style)],
]
story.append(Spacer(1, 12))
story.append(make_table(driver_data, [70, 120, 120, 130]))
story.append(Paragraph('<b>Table 6:</b> Platform-Specific Audio Driver Support', caption_style))
story.append(Spacer(1, 12))

# ═══════════════════════════════════════════════════════════
# SECTION 7: Commercial & Pricing Strategy
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('7. Commercial & Pricing Strategy'))

story.append(add_heading('7.1 Subscription Model Rationale', h2_style, level=1))
story.append(Paragraph(
    'The software industry has decisively moved toward subscription-based pricing, and for good reason. A one-time purchase model like SAM Broadcaster\'s $299 license creates a misalignment between vendor and customer incentives: after the initial sale, the vendor has little financial motivation to improve the product, and customers who paid a large upfront fee feel entitled to perpetual updates. This leads to stagnant products and frustrated users, which is exactly the situation in the internet radio software market today. Subscription pricing aligns incentives by creating a continuous revenue stream that funds ongoing development, while the low monthly cost makes it easy for new users to try the product without a significant financial commitment.',
    body_style
))
story.append(Paragraph(
    'The SaaS model also enables a freemium approach, which is critical for market penetration. A generous free tier creates a large user base that generates word-of-mouth marketing, community contributions (presets, tutorials, templates), and a pool of potential upgraders. Industry data consistently shows that freemium products achieve 5 to 10 times the user base of paid-only alternatives, with typical free-to-paid conversion rates of 2 to 5 percent. Given the size of the internet radio market and the lack of strong subscription-based competitors, RadioKong is well-positioned to capture a significant share of this growing market.',
    body_style
))

story.append(add_heading('7.2 Pricing Tiers', h2_style, level=1))

pricing_data = [
    [Paragraph('<b>Feature</b>', th_style),
     Paragraph('<b>Free</b>', th_style),
     Paragraph('<b>Pro ($9.99/mo)</b>', th_style),
     Paragraph('<b>Studio ($24.99/mo)</b>', th_style),
     Paragraph('<b>Enterprise (Custom)</b>', th_style)],
    [Paragraph('Streaming', td_style),
     Paragraph('1 server, 1 codec (MP3)', td_style),
     Paragraph('3 servers, all codecs', td_style),
     Paragraph('10 servers, all codecs', td_style),
     Paragraph('Unlimited', td_style)],
    [Paragraph('Audio Processing', td_style),
     Paragraph('EQ only', td_style),
     Paragraph('Full DSP chain', td_style),
     Paragraph('Full DSP + VST/AU plugins', td_style),
     Paragraph('Full DSP + custom plugins', td_style)],
    [Paragraph('Software Mixer Channels', td_style),
     Paragraph('2 channels', td_style),
     Paragraph('4 channels', td_style),
     Paragraph('8 channels', td_style),
     Paragraph('Unlimited', td_style)],
    [Paragraph('Local Recording', td_style),
     Paragraph('MP3 only', td_style),
     Paragraph('WAV + FLAC', td_style),
     Paragraph('WAV + FLAC + multi-track', td_style),
     Paragraph('All formats', td_style)],
    [Paragraph('Metadata Sources', td_style),
     Paragraph('Manual only', td_style),
     Paragraph('Manual + file tags', td_style),
     Paragraph('All sources + WebSocket', td_style),
     Paragraph('All sources + API', td_style)],
    [Paragraph('VU Meters / Monitoring', td_style),
     Paragraph('Basic VU', td_style),
     Paragraph('Real-time + history', td_style),
     Paragraph('Full dashboard + alerts', td_style),
     Paragraph('Full + SNMP/API export', td_style)],
    [Paragraph('Schedule/Automation', td_style),
     Paragraph('None', td_style),
     Paragraph('Basic auto-connect', td_style),
     Paragraph('Advanced scheduling', td_style),
     Paragraph('Full automation suite', td_style)],
    [Paragraph('Support', td_style),
     Paragraph('Community forum', td_style),
     Paragraph('Email (48hr response)', td_style),
     Paragraph('Priority email (12hr)', td_style),
     Paragraph('Dedicated account manager', td_style)],
    [Paragraph('Annual Discount', td_style),
     Paragraph('-', td_style),
     Paragraph('2 months free (annual)', td_style),
     Paragraph('2 months free (annual)', td_style),
     Paragraph('Negotiable', td_style)],
]
story.append(Spacer(1, 12))
story.append(make_table(pricing_data, [85, 80, 90, 100, 95]))
story.append(Paragraph('<b>Table 7:</b> Subscription Pricing Tiers', caption_style))
story.append(Spacer(1, 12))

story.append(add_heading('7.3 Revenue Projections', h2_style, level=1))
story.append(Paragraph(
    'Based on market size analysis, competitive positioning, and typical SaaS conversion rates, conservative revenue projections estimate that RadioKong can achieve 50,000 free users within the first 12 months of launch through organic growth, content marketing, and community engagement. Assuming a 3% free-to-paid conversion rate with an average revenue per paid user of $15 per month (blended across Pro and Studio tiers), this translates to 1,500 paying subscribers generating approximately $22,500 in monthly recurring revenue by the end of year one. By year three, with continued product improvement and market expansion, projections estimate 200,000 free users, 8,000 paying subscribers, and $120,000 in monthly recurring revenue. These projections assume no external marketing spend beyond content creation and community management; paid acquisition would accelerate growth significantly.',
    body_style
))

# ═══════════════════════════════════════════════════════════
# SECTION 8: Development Roadmap
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('8. Development Roadmap'))

story.append(add_heading('8.1 Phase 1: Foundation (Months 1-4)', h2_style, level=1))
story.append(Paragraph(
    'The first phase focuses on building the core audio engine and establishing the minimum viable product. The primary deliverable is a functional streaming application that can capture audio from a single input device, encode it as MP3, and stream it to an Icecast or SHOUTcast server. This phase includes setting up the cross-platform build pipeline, implementing the Rust audio engine with CPAL integration, building the basic Electron shell with React UI, and creating the auto-update infrastructure. The milestone for this phase is a closed alpha release to a select group of 50 beta testers recruited from internet radio forums and communities.',
    body_style
))
phase1_items = [
    'Rust audio engine: CPAL integration, WASAPI/CoreAudio/PipeWire drivers',
    'LAME MP3 encoder integration with configurable bitrate (64-320 kbps)',
    'Icecast and SHOUTcast v2 streaming protocol implementation',
    'Basic Electron + React UI: connection settings, VU meters, GO LIVE button',
    'Auto-detect audio input devices with hot-plug support',
    'Auto-reconnect with exponential backoff',
    'Manual metadata entry (title/artist)',
    'Cross-platform build pipeline: Windows (NSIS installer), macOS (DMG), Linux (AppImage)',
]
for item in phase1_items:
    story.append(Paragraph(item, bullet_style, bulletText='\u2022'))

story.append(add_heading('8.2 Phase 2: Professional Features (Months 5-8)', h2_style, level=1))
story.append(Paragraph(
    'The second phase adds the professional audio processing features and multi-server streaming that differentiate RadioKong from free alternatives and justify the Pro subscription tier. This is the most technically challenging phase, as it requires implementing a real-time DSP pipeline that operates with deterministic latency alongside the existing streaming engine. The milestone is a public beta release with full Pro tier features available for a discounted early-adopter price.',
    body_style
))
phase2_items = [
    'Per-channel 3-band parametric EQ with broadcast presets',
    'Broadcast compressor with RMS detection, lookahead, and makeup gain',
    'Peak limiter with -1dBFS ceiling for broadcast-safe output',
    'Noise gate with configurable threshold and release',
    'Software mixer: up to 4 channels with visual faders, mute, solo, pan',
    'Mic talk-over / duck function with one-click activation',
    'Multi-codec support: OGG Vorbis, OGG Opus, AAC-LC, HE-AAC v2, FLAC',
    'Simultaneous multi-server streaming at different bitrates/codecs',
    'Local recording in WAV and FLAC formats',
    'Automatic metadata extraction from ID3v2/Vorbis/MP4 tags',
    'Subscription management system with Stripe integration',
]
for item in phase2_items:
    story.append(Paragraph(item, bullet_style, bulletText='\u2022'))

story.append(add_heading('8.3 Phase 3: Studio Features (Months 9-12)', h2_style, level=1))
story.append(Paragraph(
    'The third phase targets professional broadcasters and studio environments with advanced features that justify the Studio subscription tier. This phase also includes the Tauri migration research spike, which evaluates whether moving from Electron to Tauri for the desktop runtime would deliver meaningful improvements in binary size, memory usage, and startup time without disrupting the user experience. The milestone is the V1.0 general availability release.',
    body_style
))
phase3_items = [
    'VST3 and AudioUnit plugin hosting on per-channel and master bus',
    'ASIO driver support on Windows for low-latency professional audio interfaces',
    'JACK audio connection kit support on Linux',
    '8-channel software mixer with sub-mix groups',
    'Stereo enhancer and de-esser modules',
    'Multi-track recording (each channel recorded to a separate file)',
    'Metadata URL polling for integration with station automation systems',
    'WebSocket metadata push interface',
    'Advanced stream health dashboard with bandwidth graph and buffer visualization',
    'Configurable alerts for stream interruptions, audio clipping, and CPU overload',
    'Schedule-based auto-connect and auto-disconnect',
    'Dark and light themes with customizable accent colors',
    'Full keyboard shortcut system with configurable keybindings',
    'Floating/detachable panels for multi-monitor setups',
]
for item in phase3_items:
    story.append(Paragraph(item, bullet_style, bulletText='\u2022'))

story.append(add_heading('8.4 Phase 4: Enterprise & Growth (Months 13-18)', h2_style, level=1))
story.append(Paragraph(
    'The fourth phase focuses on enterprise features, API access, and the platform expansion that enables RadioKong to serve large broadcasting organizations and internet radio networks. This phase also includes mobile companion apps for remote monitoring and control, and the Tauri 2.0 migration if the research spike from Phase 3 confirms its viability.',
    body_style
))
phase4_items = [
    'REST API for remote stream management and monitoring',
    'SNMP integration for enterprise NOC monitoring systems',
    'Multi-station management from a single RadioKong instance',
    'Redundant streaming with automatic failover between servers',
    'WebRTC streaming support for browser-based ultra-low-latency listening',
    'Mobile companion app (iOS/Android) for remote monitoring and basic controls',
    'Tauri 2.0 migration: smaller binary, lower memory, faster startup',
    'Cloud sync for configurations, presets, and schedules across devices',
    'Community marketplace for sharing presets, skin themes, and workflow templates',
    'Integration partnerships with hosting providers (Radio.co, AzuraCast, RadioKing)',
]
for item in phase4_items:
    story.append(Paragraph(item, bullet_style, bulletText='\u2022'))

# ═══════════════════════════════════════════════════════════
# SECTION 9: Risk Analysis
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('9. Risk Analysis & Mitigation'))

risk_data = [
    [Paragraph('<b>Risk</b>', th_style),
     Paragraph('<b>Impact</b>', th_style),
     Paragraph('<b>Probability</b>', th_style),
     Paragraph('<b>Mitigation</b>', th_style)],
    [Paragraph('MP3/AAC patent/licensing fees', td_style),
     Paragraph('High', td_center),
     Paragraph('Medium', td_center),
     Paragraph('Use royalty-free codecs (Opus, OGG) as defaults; MP3/AAC as paid-tier features; monitor patent expiration status', td_style)],
    [Paragraph('Audio latency issues on specific hardware', td_style),
     Paragraph('High', td_center),
     Paragraph('Medium', td_center),
     Paragraph('Extensive hardware compatibility testing; ASIO/CoreAudio professional drivers; configurable buffer sizes with safety minimums', td_style)],
    [Paragraph('Electron performance criticism', td_style),
     Paragraph('Medium', td_center),
     Paragraph('High', td_center),
     Paragraph('Heavy audio processing in Rust (not JS); plan Tauri migration for V2; benchmark against competitors', td_style)],
    [Paragraph('Free users not converting to paid', td_style),
     Paragraph('High', td_center),
     Paragraph('Medium', td_center),
     Paragraph('Generous but limited free tier; clear value-add in Pro/Studio; annual discounts; feature-gate premium DSP and multi-server', td_style)],
    [Paragraph('Major OS updates breaking audio drivers', td_style),
     Paragraph('Medium', td_center),
     Paragraph('Medium', td_center),
     Paragraph('Rust audio engine abstraction layer; OS beta testing program; fast hotfix release pipeline', td_style)],
    [Paragraph('Open-source competitor emerging', td_style),
     Paragraph('Medium', td_center),
     Paragraph('Low', td_center),
     Paragraph('Focus on UX polish and commercial features; open-source core audio engine to build community trust; fast iteration cycle', td_style)],
]
story.append(Spacer(1, 12))
story.append(make_table(risk_data, [100, 50, 60, 235]))
story.append(Paragraph('<b>Table 8:</b> Risk Analysis Matrix', caption_style))
story.append(Spacer(1, 12))

# ═══════════════════════════════════════════════════════════
# SECTION 10: Differentiation Summary
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('10. What Makes RadioKong Stand Out'))

story.append(add_heading('10.1 The Seven Pillars of Differentiation', h2_style, level=1))

story.append(Paragraph(
    'RadioKong is not merely another streaming tool with a fresh coat of paint. It represents a fundamentally different approach to internet radio broadcasting software, built on seven core principles that collectively address every major pain point identified in the competitive analysis. Each pillar was derived directly from user complaints, feature requests, and workflow observations across existing platforms.',
    body_style
))

diff_items = [
    ('Cross-Platform from Day One', 'While every major competitor is Windows-only or treats Mac/Linux as an afterthought, RadioKong will ship with first-class support for Windows, macOS, and Linux simultaneously. The Rust-based audio engine ensures consistent behavior across all platforms, and the Electron/Tauri UI framework guarantees identical appearance and functionality. Users should never have to choose their operating system based on which broadcasting software is available.'),
    ('Consumer-Grade Simplicity with Professional Power', 'The progressive disclosure UI ensures that a first-time user can go live in under five minutes, while a professional broadcaster can access every parameter they need without navigating through multiple menus and dialogs. The "GO LIVE" button is always visible, always one click away. Advanced features expand on demand, never cluttering the default view.'),
    ('Built-in Audio Processing That Actually Sounds Good', 'Most free tools offer no processing, and SAM Broadcaster\'s processing is functional but not intuitive. RadioKong will ship with professionally designed broadcast presets that make any input source sound like a real radio station with a single click. The presets will be created by professional broadcast engineers and refined through community feedback, ensuring they work in real-world conditions rather than just sounding good in a lab.'),
    ('Real-Time Stream Health Dashboard', 'No other streaming tool provides the level of real-time monitoring that RadioKong will offer. The dashboard will display audio levels, bandwidth utilization, buffer health, connection status, metadata updates, and listener counts (via server API integration) in a single, visually coherent view. Alert thresholds are configurable, and the dashboard can push notifications to mobile devices via the companion app.'),
    ('Hybrid Mixer Architecture', 'The combination of a built-in software mixer with seamless hardware mixer integration is unique in the market. BUTT has no mixer, SAM Broadcaster has a software-only mixer, and no tool provides intelligent handoff between software and hardware mixing. RadioKong\'s hybrid approach means the software adapts to the user\'s setup, not the other way around.'),
    ('Modern Subscription Pricing', 'The freemium subscription model is novel in this market segment, where the prevailing models are either free-with-no-support (BUTT, Mixxx) or expensive-one-time-purchase (SAM Broadcaster). The subscription model ensures sustainable development, while the free tier ensures maximum adoption. Users who cannot afford a subscription still get a functional tool, and users who need professional features pay a reasonable monthly cost that is far less intimidating than a $299 upfront commitment.'),
    ('Community and Ecosystem', 'RadioKong will not be just a standalone application. The planned community marketplace for presets, themes, and workflow templates, the integration partnerships with hosting providers, and the open REST API for third-party integrations create an ecosystem that grows more valuable as more people use it. This network effect creates a competitive moat that is very difficult for individual tools to replicate.'),
]
for i, (title, desc) in enumerate(diff_items, 1):
    story.append(Paragraph('<b>%d. %s.</b> %s' % (i, title, desc), body_left))
    story.append(Spacer(1, 4))

# ═══════════════════════════════════════════════════════════
# Build
# ═══════════════════════════════════════════════════════════
doc.multiBuild(story)
print('Body PDF generated:', OUTPUT_PATH)
