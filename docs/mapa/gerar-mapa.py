# Mapa mental e fluxogramas dos módulos do TechPoint (PowerPoint com formas editáveis, para importar no Canva).
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
import sys

OUT = sys.argv[1]
prs = Presentation()
prs.slide_width, prs.slide_height = Inches(26.667), Inches(15)
BLANK = prs.slide_layouts[6]

NAVY = RGBColor(0x1C, 0x15, 0x4B); LIME = RGBColor(0xC6, 0xF4, 0x32); WHITE = RGBColor(255, 255, 255)
INK = RGBColor(0x1F, 0x29, 0x37); MUTED = RGBColor(0x6B, 0x72, 0x80); BG = RGBColor(0xF6, 0xF7, 0xF4)
C = {  # cor do ramo: (forte, claro)
    'base': (RGBColor(0x0E, 0x7C, 0x86), RGBColor(0xDF, 0xF3, 0xF4)),
    'inv': (RGBColor(0x14, 0x53, 0x2D), RGBColor(0xE3, 0xF1, 0xE7)),
    'rt': (RGBColor(0xB4, 0x53, 0x09), RGBColor(0xFD, 0xEF, 0xDC)),
    'canal': (RGBColor(0x4C, 0x3D, 0xA8), RGBColor(0xEC, 0xE9, 0xFB)),
    'breve': (RGBColor(0x6B, 0x72, 0x80), RGBColor(0xF0, 0xF1, 0xF3)),
}

def bg(slide, color=BG):
    f = slide.background.fill; f.solid(); f.fore_color.rgb = color

def box(slide, x, y, w, h, text, fill, color=INK, size=14, bold=False, shape=MSO_SHAPE.ROUNDED_RECTANGLE, line=None, align=PP_ALIGN.CENTER, sub=None):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid(); s.fill.fore_color.rgb = fill
    if line is None: s.line.fill.background()
    else: s.line.color.rgb = line; s.line.width = Pt(1.5)
    s.shadow.inherit = False
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE: s.adjustments[0] = 0.18
    tf = s.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = Inches(0.12); tf.margin_top = tf.margin_bottom = Inches(0.06)
    p = tf.paragraphs[0]; p.alignment = align
    r = p.add_run(); r.text = text; r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = color; r.font.name = 'Inter'
    if sub:
        for line_ in sub:
            q = tf.add_paragraph(); q.alignment = align
            rr = q.add_run(); rr.text = line_; rr.font.size = Pt(size - 3); rr.font.color.rgb = color; rr.font.name = 'Inter'
    return s

def link(slide, a, b, color, width=2.5, arrow=False, mode='auto'):
    ax, ay = a.left + a.width // 2, a.top + a.height // 2
    bx, by = b.left + b.width // 2, b.top + b.height // 2
    # liga pelas bordas mais próximas (esquerda/direita ou cima/baixo)
    if mode == 'h' or (mode == 'auto' and abs(bx - ax) > abs(by - ay)):
        x1 = a.left + a.width if bx > ax else a.left; x2 = b.left if bx > ax else b.left + b.width
        y1, y2 = ay, by
    else:
        y1 = a.top + a.height if by > ay else a.top; y2 = b.top if by > ay else b.top + b.height
        x1, x2 = ax, bx
    c = slide.shapes.add_connector(MSO_CONNECTOR.CURVE if not arrow else MSO_CONNECTOR.STRAIGHT, Emu(x1), Emu(y1), Emu(x2), Emu(y2))
    c.line.color.rgb = color; c.line.width = Pt(width)
    if arrow:
        ln = c.line._get_or_add_ln()
        tail = ln.makeelement(qn('a:tailEnd'), {'type': 'triangle', 'w': 'med', 'len': 'med'}); ln.append(tail)
    return c

def title(slide, t, s):
    box(slide, 0.6, 0.35, 18, 0.8, t, BG, NAVY, 30, True, align=PP_ALIGN.LEFT)
    box(slide, 0.6, 1.1, 22, 0.5, s, BG, MUTED, 15, align=PP_ALIGN.LEFT)

# =============================================================================================
# 1. Mapa mental geral
# =============================================================================================
s = prs.slides.add_slide(BLANK); bg(s)
title(s, 'TechPoint · mapa dos módulos', 'Do módulo de entrada (Plano Base) aos módulos pagos. Versão 0.15.0 · 16/11/2026 · edite à vontade')
root = box(s, 10.9, 6.6, 4.9, 1.6, 'TechPoint', NAVY, LIME, 34, True, sub=['o hub do clube'])

def branch(key, x, y, w, h, label, kids, kx, kw, side, kh=0.62, gap=0.14, ky0=None):
    strong, light = C[key]
    b = box(s, x, y, w, h, label, strong, WHITE, 18, True)
    link(s, root, b, strong, 4)
    ky = ky0 if ky0 is not None else y + h / 2 - (len(kids) * (kh + gap) - gap) / 2
    for k in kids:
        t, sub = (k, None) if isinstance(k, str) else k
        kb = box(s, kx, ky, kw, kh if not sub else kh + 0.36 * len(sub), t, light, INK, 16, True, sub=sub)
        link(s, b, kb, strong, 1.75, mode='h')
        ky += (kh if not sub else kh + 0.36 * len(sub)) + gap
    return b

base = branch('base', 6.2, 6.6, 3.9, 0.9, '1. PLANO BASE (entrada)', [
    ('Acesso', ['e-mail ou Google · link do clube (/dfvolei)', 'login neutro · menu da conta']),
    ('Papéis', ['atleta · responsável · treinador', 'gestor · administrador · gestor master']),
    ('Entidade', ['dados e CNPJ · logo e cores (white label)', 'equipes · locais com raio · pessoas']),
    ('Atleta e família', ['cadastro · responsáveis · consentimento LGPD', 'documentos em pastas · foto · perfil']),
    ('Treinos e presença', ['check-in com GPS, selfie e hora do servidor', 'check-out · offline · justificativa de falta']),
    ('Eventos', ['competição · reunião · palestra', 'ciência do atleta · realizados → currículo']),
    ('Relatórios', ['frequência (pizza/barras) · WhatsApp', 'PDF e planilha']),
    ('Currículo esportivo', ['PDF · link · importação grátis']),
], 0.4, 5.2, 'left', ky0=1.75, gap=0.1)

inv = branch('inv', 16.9, 2.6, 4.0, 0.9, '2. GESTÃO DE INVESTIMENTOS (pago)', [
    ('Projetos incentivados', ['metas automáticas pelo check-in', 'beneficiários · plano · patrocinadores', 'relatórios numerados com selo']),
], 21.5, 4.7, 'right', ky0=1.85)

rt_strong, rt_light = C['rt']
rt = box(s, 16.9, 5.3, 4.0, 0.9, 'Revelar Talentos (Min. do Esporte)', rt_strong, WHITE, 16, True)
link(s, inv, rt, C['inv'][0], 3)
fa = box(s, 21.5, 4.15, 4.7, 1.55, 'A · Clube apto', rt_light, INK, 16, True, sub=['checklist 34 itens · certidões com validade', 'dirigentes protegidos · 15 declarações Word'])
fb = box(s, 21.5, 5.85, 4.7, 1.55, 'B · Projeto Técnico', rt_light, INK, 16, True, sub=['eixo e faixas · metas · público-alvo', 'orçamento 3 cotações · cronogramas · Word'])
fc = box(s, 21.5, 7.55, 4.7, 1.85, 'C · Execução e RCO', rt_light, INK, 16, True, sub=['aprovação → projeto · repasses · despesas', 'ponto dos profissionais · cursos do COB', 'mídia · RCO em Word · pacote ZIP'])
for f_ in (fa, fb, fc): link(s, rt, f_, rt_strong, 1.75, mode='h')

res = branch('breve', 17.4, 10.2, 3.5, 0.8, '3. RESERVAS (pago, futuro)', ['Quadras e espaços'], 21.5, 4.7, 'right')
canal = branch('canal', 11.1, 10.4, 4.5, 0.8, '4. ONDE FUNCIONA', [], 0, 0, 'down')
for i, t in enumerate(['App Android (APK)', 'Site techpoint.expo.app', 'Hotsite techpoint.app.br + manuais']):
    k = box(s, 7.6 + i * 4.0, 11.75, 3.7, 0.75, t, C['canal'][1], INK, 13, True); link(s, canal, k, C['canal'][0], 1.75)
breve = box(s, 7.6, 13.0, 11.7, 0.95, 'EM BREVE: comunicados · resultados dos times · relatório de desempenho · menu lateral recolhível · foto de perfil estilo Google · editar/apagar evento',
            C['breve'][1], INK, 13, True, line=C['breve'][0])

# =============================================================================================
# 2. Fluxo do módulo de entrada (Plano Base)
# =============================================================================================
s2 = prs.slides.add_slide(BLANK); bg(s2)
s = s2
title(s, 'Fluxo de entrada · Plano Base', 'Como cada pessoa entra e o que encontra depois do login')
B, L = C['base']
a1 = box(s, 0.6, 2.4, 3.6, 1.2, 'Abre o app ou o site', NAVY, WHITE, 16, True, sub=['ou o link do clube /dfvolei'])
a2 = box(s, 5.0, 2.4, 3.8, 1.2, 'Login neutro', L, INK, 16, True, sub=['Google ou e-mail e senha'])
a3 = box(s, 9.6, 2.4, 3.8, 1.2, 'Entra no clube da conta', L, INK, 16, True, sub=['logo e cores do clube (white label)'])
a4 = box(s, 14.2, 2.2, 3.8, 1.6, 'Papel define o Início', B, WHITE, 16, True, shape=MSO_SHAPE.DIAMOND)
for x, y in ((a1, a2), (a2, a3), (a3, a4)): link(s, x, y, NAVY, 2.5, arrow=True)
nov = box(s, 5.0, 3.95, 3.8, 1.1, 'Conta sem clube', C['breve'][1], INK, 14, True, sub=['convite pelo WhatsApp liga ao clube'])
link(s, a2, nov, MUTED, 1.75, arrow=True, mode='v')

roles = [
    ('ATLETA', ['Início: próximo treino e check-in', 'Eventos (Próximos / Realizados)', 'Check-in · Currículo · Perfil', 'Documentos · justificar falta']),
    ('RESPONSÁVEL', ['Meus atletas', 'Autorizações e consentimento LGPD', 'Documentos · justificar falta', 'Aviso de chegada e saída']),
    ('TREINADOR', ['Treinos (hoje · próximos · anteriores)', 'Atletas · Relatórios', 'Convites e pedidos · Pendências', 'Bater ponto (entrada e saída)']),
    ('GESTOR / ADMIN', ['Tudo do treinador', 'Gestão do clube: equipes, locais, pessoas, dados', 'Projetos e Revelar Talentos (módulo pago)', 'Marca do clube']),
    ('GESTOR MASTER', ['Todas as entidades', 'Entrar como visitante (auditado)', 'Ligar módulos pagos', 'Uso do armazenamento']),
]
for i, (t, sub) in enumerate(roles):
    r = box(s, 0.6 + i * 5.2, 6.4, 4.9, 2.9, t, L if i < 4 else C['canal'][1], INK, 16, True, sub=sub)
    link(s, a4, r, B, 1.75, arrow=True, mode='v')
ck = box(s, 0.6, 10.3, 25.5, 1.6, 'Prova de presença (o coração do produto)', NAVY, LIME, 18, True,
         sub=['check-in só pela câmera, com localização no instante e hora do servidor · raio do local · fora do raio vai para aprovação com justificativa',
              'offline guarda e envia depois · antifraude (localização simulada, foto repetida, aparelho compartilhado) · relatório de frequência com fotos'])
box(s, 0.6, 12.4, 25.5, 1.0, 'Dados pessoais e de menores: consentimento do responsável (LGPD) · fotos apagadas no prazo de guarda · pedido de exclusão de conta · histórico (auditoria) de cada mudança',
    C['breve'][1], INK, 13, False, line=C['breve'][0])

# =============================================================================================
# 3. Fluxo do módulo de incentivo (Revelar Talentos)
# =============================================================================================
s3 = prs.slides.add_slide(BLANK); bg(s3)
s = s3
title(s, 'Fluxo do incentivo · Revelar Talentos (Termo de Fomento)', 'Da habilitação do clube à prestação de contas no Transferegov.br')
S_, L_ = C['rt']
cols = [
    ('A · CLUBE APTO', ['Checklist do Ministério (34 itens)', 'CNPJ com 3 anos (busca na Receita)', 'Certidões com validade e aviso 15 dias antes', 'Dirigentes com dados protegidos', '15 declarações prontas em Word']),
    ('B · PROJETO TÉCNICO', ['Eixo e faixa de valor (R$ 400 mil a 1 mi no núcleo)', 'Textos das 21 seções do modelo', 'Público-alvo por fase, sexo e idade (até 21)', 'Metas medidas pelo check-in', 'Orçamento Meta → Ação → Etapa, 3 cotações', 'Cronogramas · indicadores · Word e planilha']),
    ('APROVAÇÃO', ['Nº do Termo de Fomento e data', 'Vira projeto de execução automaticamente', 'Orçamento vira o valor combinado (travado)', 'Atletas viram beneficiários previstos']),
    ('C · EXECUÇÃO', ['Repasses recebidos', 'Despesas com comprovantes por tipo', 'Combinado × gasto · saldo · estouros', 'Ponto dos profissionais pelo app', 'Cursos do COB · plano de mídia']),
    ('PRESTAÇÃO DE CONTAS', ['RCO em Word quase pronto', 'Metas medidas · real × previsto', 'Folha de ponto em Word', 'Pacote ZIP por etapa', '→ Transferegov.br']),
]
prev = None
for i, (t, sub) in enumerate(cols):
    fill = NAVY if t == 'APROVAÇÃO' else L_
    col = WHITE if t == 'APROVAÇÃO' else INK
    b = box(s, 0.6 + i * 5.2, 2.6, 4.8, 5.4, t, fill, col, 17, True, sub=sub)
    if prev: link(s, prev, b, S_, 3, arrow=True)
    prev = b
box(s, 0.6, 8.6, 25.4, 1.3, 'O que liga tudo: o check-in', NAVY, LIME, 18, True,
    sub=['frequência e atletas atendidos medem as metas sozinhos, do Projeto Técnico ao RCO · a mesma prova (foto, localização, hora do servidor) vale para atletas e profissionais'])
box(s, 0.6, 10.3, 12.4, 2.5, 'Documentos do Ministério usados', L_, INK, 15, True,
    sub=['Modelo de Projeto Técnico (abril/2026)', 'Checklists: Termo de Fomento, Convênio e TED', 'Modelo de RCO (SEI 71000.042304/2020-44)', 'Apresentação da SNE (faixas por eixo, orçamento 20YA)'])
box(s, 13.6, 10.3, 12.4, 2.5, 'Próximos passos do módulo', C['breve'][1], INK, 15, True, line=C['breve'][0],
    sub=['Convênio (prefeituras) e TED (universidades)', 'Modelo oficial do Anexo XV (nepotismo)', 'Contador conferir os encargos de CLT', 'Advogado revisar as regras automáticas'])

prs.save(OUT)
print('ok', OUT)
