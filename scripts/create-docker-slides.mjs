import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const slides = [
  {
    type: 'cover',
    section: 'Introdução',
    title: 'Containers e Docker',
    subtitle: 'Criação, gerenciamento e deploy de aplicações',
    lines: [
      'Objetivo: padronizar ambientes e reduzir variação operacional',
      'Resultado: deploy previsível, auditável e reversível'
    ],
    quote: 'Docker não é só uma ferramenta; é um padrão de entrega.'
  },
  {
    type: 'agenda',
    section: 'Roteiro',
    title: 'Agenda',
    items: [
      'O que é container',
      'Imagem e container na prática',
      'Fluxo de criação e execução',
      'Instalação no Windows e Linux',
      'Comandos de rotina',
      'Estratégia de deploy em produção'
    ]
  },
  {
    type: 'feature',
    section: 'Conceito',
    title: '1) O que é um container?',
    items: [
      'É uma aplicação empacotada com runtime e dependências.',
      'A execução fica isolada do host e de outros serviços.',
      'Evita o clássico problema “na minha máquina funciona”.',
      'Mantém comportamento consistente entre homologação e produção.'
    ],
    notes: ['Padronização', 'Consistência', 'Reprodução exata']
  },
  {
    type: 'feature',
    section: 'Conceito',
    title: '2) Imagem x Container',
    items: [
      'Imagem é o artefato: pacote imutável e versionado.',
      'Container é a instância em execução da imagem.',
      'A cada build, nasce uma imagem nova com camadas novas.',
      'Rollback é retorno rápido para uma tag anterior estável.'
    ],
    notes: ['Imutabilidade', 'Governança de versão', 'Recuperação rápida']
  },
  {
    type: 'workflow',
    section: 'Execução',
    title: '3) Como funciona o fluxo',
    items: [
      'Criar Dockerfile com contexto e entrypoint.',
      'Construir imagem: docker build.',
      'Executar em teste local com portas e variáveis.',
      'Publicar em registry com tag imutável.',
      'Implantar por ambiente com controle de mudança.'
    ],
    notes: ['Build > Test > Tag > Release', 'Reprodutibilidade no ciclo']
  },
  {
    type: 'commands',
    section: 'Operação',
    title: '4) Comandos essenciais',
    items: [
      'docker build -t projeto:1.0.0 .',
      'docker images',
      'docker run -d --name projeto -p 3000:3000 projeto:1.0.0',
      'docker ps',
      'docker stop projeto',
      'docker logs projeto',
      'docker exec -it projeto /bin/sh'
    ],
    notes: ['Essenciais para implantação diária', 'Use `docker ps` e `logs` no monitoramento']
  },
  {
    type: 'install',
    section: 'Instalação',
    title: '5) Instalação no Windows',
    items: [
      'Instalar Docker Desktop.',
      'Habilitar WSL 2.',
      'Validar com `docker --version`.',
      'Executar `docker run hello-world`.',
      'Ajustar CPU e memória conforme necessidade do cenário.'
    ],
    command: 'docker --version',
    notes: ['Validação curta e objetiva', 'Configuração inicial segura']
  },
  {
    type: 'install',
    section: 'Instalação',
    title: '6) Instalação no Linux',
    items: [
      'Atualizar pacotes e instalar docker-ce.',
      'Ativar serviço do Docker com `systemctl enable --now docker`.',
      'Adicionar usuário ao grupo docker.',
      'Reautenticar sessão e validar com hello-world.',
      'Configurar limites de recursos por host.'
    ],
    command: 'systemctl enable --now docker',
    notes: ['Padrão server-friendly', 'Base sólida para automação']
  },
  {
    type: 'feature',
    section: 'Deploy',
    title: '7) Estrutura de deploy',
    items: [
      'Tags semânticas para produção (sem usar latest).',
      'Secrets e variáveis fora da imagem.',
      'Health checks e política de restart.',
      'Observabilidade por logs, CPU e memória.',
      'Plano de rollback documentado por versão.'
    ],
    notes: ['Confiabilidade', 'Segurança operacional', 'Recuperação garantida']
  },
  {
    type: 'closing',
    section: 'Conclusão',
    title: 'Encerramento',
    items: [
      'Contêineres tornam o ambiente previsível e repetível.',
      'O deploy ganha controle por imagem e por versão.',
      'Com isso, equipes liberam mais rápido com menos risco.'
    ],
    notes: [],
    quote: ''
  }
];

const W = 1366;
const H = 768;

const theme = {
  bg: rgb(0.985, 0.985, 0.982),
  paper: rgb(1, 1, 1),
  ink: rgb(0.115, 0.145, 0.175),
  muted: rgb(0.455, 0.49, 0.56),
  accent: rgb(0.09, 0.39, 0.82),
  border: rgb(0.89, 0.9, 0.92),
  noteBg: rgb(0.96, 0.98, 0.995),
  noteText: rgb(0.12, 0.36, 0.78),
  sideTone: [
    rgb(0.11, 0.17, 0.34),
    rgb(0.18, 0.28, 0.20),
    rgb(0.26, 0.15, 0.21),
    rgb(0.29, 0.19, 0.08)
  ]
};

function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word);
      current = '';
    }
  }

  if (current) lines.push(current);
  return lines;
}

function drawPageBase(page, accentIndex = 0, showGrid = false) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: theme.bg });
  page.drawRectangle({ x: 28, y: 22, width: W - 56, height: H - 44, color: theme.paper, borderColor: theme.border, borderWidth: 1 });

  page.drawLine({
    start: { x: 56, y: H - 86 },
    end: { x: W - 56, y: H - 86 },
    color: theme.border,
    thickness: 1
  });

  page.drawRectangle({
    x: 56,
    y: H - 74,
    width: 5,
    height: 2,
    color: theme.accent
  });

  page.drawLine({
    start: { x: 56, y: 44 },
    end: { x: W - 56, y: 44 },
    color: theme.border,
    thickness: 1
  });

  page.drawRectangle({
    x: 30,
    y: 50,
    width: 6,
    height: H - 108,
    color: theme.sideTone[Math.abs(accentIndex) % theme.sideTone.length]
  });

  if (showGrid) {
    for (let i = 0; i < 9; i++) {
      const y = 110 + i * 64;
      page.drawLine({
        start: { x: 56, y },
        end: { x: W - 56, y },
        color: rgb(0.95, 0.95, 0.95),
        thickness: 0.3
      });
    }
  }
}

function drawHeader(page, section, fontSerif, fontSans, index, total) {
  page.drawText(section || '', {
    x: 76,
    y: H - 66,
    size: 10,
    font: fontSans,
    color: theme.accent
  });

  page.drawText(`${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, {
    x: W - 82,
    y: 58,
    size: 10,
    font: fontSans,
    color: theme.muted
  });
}

function drawFooterTag(page, text, fontSans) {
  page.drawRectangle({
    x: W - 312,
    y: 54,
    width: 250,
    height: 20,
    color: theme.noteBg,
    borderColor: theme.border,
    borderWidth: 1
  });

  page.drawText(text, {
    x: W - 306,
    y: 62,
    size: 9,
    font: fontSans,
    color: theme.muted
  });
}

function drawTitle(page, title, fontSerif, y, size = 42) {
  page.drawText(title, {
    x: 76,
    y,
    size,
    font: fontSerif,
    color: theme.ink
  });
}

function drawBulletList(page, items, x, y, maxWidth, font, size, lineHeight, color) {
  let cursorY = y;
  const bulletOffset = size + 2;

  for (let i = 0; i < items.length; i++) {
    const lines = wrapText(`- ${items[i]}`, font, size, maxWidth);

    if (cursorY < 90) {
      break;
    }

    for (const line of lines) {
      page.drawText(line, {
        x,
        y: cursorY,
        size,
        font,
        color
      });
      cursorY -= lineHeight;
      if (cursorY < 90) break;
    }
    cursorY -= 4;
  }

  return cursorY;
}

function drawNotePanel(page, notes, x, y, w, h, fontSans, fontSerif) {
  page.drawRectangle({ x, y, width: w, height: h, color: theme.noteBg, borderColor: theme.border, borderWidth: 1 });
  page.drawText('Notas', {
    x: x + 14,
    y: y + h - 30,
    size: 10,
    font: fontSans,
    color: theme.noteText
  });

  drawBulletList(
    page,
    notes,
    x + 14,
    y + h - 52,
    w - 28,
    fontSans,
    11,
    20,
    theme.ink
  );

  page.drawLine({
    start: { x, y: y + 8 },
    end: { x: x + w, y: y + 8 },
    color: theme.border,
    thickness: 1
  });
}

function drawCover(page, slide, idx, total, fonts) {
  drawPageBase(page, 0, true);

  page.drawText('Presentation deck', {
    x: 76,
    y: H - 66,
    size: 10,
    font: fonts.sans,
    color: theme.muted
  });

  drawTitle(page, slide.title, fonts.serifBold, 600, 64);
  page.drawText(slide.subtitle, {
    x: 78,
    y: 550,
    size: 30,
    font: fonts.sans,
    color: theme.ink
  });

  page.drawLine({
    start: { x: 78, y: 530 },
    end: { x: 940, y: 530 },
    color: theme.accent,
    thickness: 2
  });

  drawBulletList(
    page,
    slide.lines,
    78,
    492,
    W - 250,
    fonts.sans,
    17,
    30,
    theme.ink
  );

  page.drawRectangle({
    x: 78,
    y: 156,
    width: W - 156,
    height: 60,
    color: theme.noteBg,
    borderColor: theme.border,
    borderWidth: 1
  });

  page.drawText(slide.quote || '', {
    x: 98,
    y: 190,
    size: 15,
    font: fonts.serif,
    color: theme.accent
  });

  drawHeader(page, slide.section || 'Introdução', fonts.serifBold, fonts.sans, idx, total);
  drawFooterTag(page, 'Containers, ambientes e release controlado', fonts.sans);
}

function drawAgenda(page, slide, idx, total, fonts) {
  drawPageBase(page, 1);

  drawHeader(page, slide.section || 'Roteiro', fonts.serifBold, fonts.sans, idx, total);
  drawTitle(page, slide.title, fonts.serifBold, 610, 52);

  const panel = { x: 78, y: 150, w: W - 156, h: 420 };
  page.drawRectangle({ x: panel.x, y: panel.y, width: panel.w, height: panel.h, color: theme.paper, borderColor: theme.border, borderWidth: 1 });
  page.drawRectangle({ x: panel.x, y: panel.y + panel.h - 8, width: panel.w, height: 8, color: theme.accent });

  const right = { x: panel.x + panel.w - 268, y: panel.y + 38, w: 230, h: panel.h - 76 };
  page.drawRectangle({ x: right.x, y: right.y, width: right.w, height: right.h, color: theme.noteBg, borderColor: theme.border, borderWidth: 1 });

  drawBulletList(
    page,
    slide.items,
    panel.x + 24,
    panel.y + panel.h - 44,
    panel.w - 330,
    fonts.sans,
    20,
    40,
    theme.ink
  );

  const order = ['1', '2', '3', '4', '5', '6'];
  for (let i = 0; i < Math.min(order.length, slide.items.length); i++) {
    page.drawText(order[i], {
      x: right.x + 22,
      y: right.y + right.h - 40 - i * 53,
      size: 11,
      font: fonts.sans,
      color: theme.accent
    });
    page.drawText('Etapa', {
      x: right.x + 22,
      y: right.y + right.h - 56 - i * 53,
      size: 11,
      font: fonts.sans,
      color: theme.noteText
    });
  }
}

function drawFeature(page, slide, idx, total, fonts, layoutStyle) {
  drawPageBase(page, layoutStyle === 'left' ? 2 : 3);
  drawHeader(page, slide.section || 'Conceito', fonts.serifBold, fonts.sans, idx, total);

  const titleY = layoutStyle === 'left' ? 610 : 620;
  drawTitle(page, slide.title, fonts.serifBold, titleY, layoutStyle === 'left' ? 46 : 42);

  const left = { x: 78, y: 150, w: 840, h: 430 };
  const right = { x: 940, y: 150, w: 288, h: 430 };

  page.drawRectangle({ x: left.x, y: left.y, width: left.w, height: left.h, color: theme.paper, borderColor: theme.border, borderWidth: 1 });
  page.drawRectangle({ x: left.x, y: left.y + left.h - 8, width: left.w, height: 8, color: theme.accent });

  page.drawRectangle({ x: right.x, y: right.y, width: right.w, height: right.h, color: theme.paper, borderColor: theme.border, borderWidth: 1 });

  if (layoutStyle === 'left') {
    page.drawText('Resumo', {
      x: right.x + 14,
      y: right.y + right.h - 36,
      size: 10,
      font: fonts.sans,
      color: theme.noteText
    });

    drawBulletList(
      page,
      slide.notes || [],
      right.x + 14,
      right.y + right.h - 60,
      right.w - 28,
      fonts.sans,
      11,
      20,
      theme.ink
    );
  } else {
    page.drawText('Resultado', {
      x: right.x + 14,
      y: right.y + right.h - 36,
      size: 10,
      font: fonts.sans,
      color: theme.noteText
    });

    const points = slide.notes || [];
    let noteY = right.y + right.h - 62;
    for (const p of points) {
      page.drawText(`- ${p}`, {
        x: right.x + 14,
        y: noteY,
        size: 11,
        font: fonts.sans,
        color: theme.ink
      });
      noteY -= 24;
    }

    page.drawLine({
      start: { x: right.x + 16, y: right.y + right.h - 120 },
      end: { x: right.x + right.w - 16, y: right.y + right.h - 120 },
      color: theme.border,
      thickness: 1
    });

    page.drawText('Checklist', {
      x: right.x + 14,
      y: right.y + right.h - 138,
      size: 10,
      font: fonts.sans,
      color: theme.noteText
    });

    drawBulletList(
      page,
      slide.items.slice(-2),
      right.x + 14,
      right.y + right.h - 162,
      right.w - 28,
      fonts.sans,
      11,
      20,
      theme.muted
    );
  }

  drawBulletList(
    page,
    slide.items,
    left.x + 24,
    left.y + left.h - 44,
    left.w - 48,
    fonts.sans,
    20,
    39,
    theme.ink
  );

}

function drawCommands(page, slide, idx, total, fonts) {
  drawPageBase(page, 0);
  drawHeader(page, slide.section || 'Operação', fonts.serifBold, fonts.sans, idx, total);
  drawTitle(page, slide.title, fonts.serifBold, 612, 42);

  const panel = { x: 78, y: 168, w: W - 156, h: 400 };
  page.drawRectangle({ x: panel.x, y: panel.y, width: panel.w, height: panel.h, color: theme.paper, borderColor: theme.border, borderWidth: 1 });
  page.drawRectangle({ x: panel.x, y: panel.y + panel.h - 8, width: panel.w, height: 8, color: theme.accent });

  const colLeft = panel.x + 22;
  const colY = panel.y + panel.h - 48;
  const linesWidth = panel.w - 40;

  for (let i = 0; i < slide.items.length; i++) {
    const lineY = colY - i * 52;
    if (lineY < panel.y + 36) {
      break;
    }

    page.drawRectangle({
      x: colLeft,
      y: lineY - 18,
      width: linesWidth,
      height: 34,
      color: rgb(0.97, 0.975, 0.99),
      borderColor: theme.border,
      borderWidth: 0.8
    });

    const indexText = `${String(i + 1).padStart(2, '0')}.`;
    page.drawText(indexText, {
      x: colLeft + 10,
      y: lineY,
      size: 10,
      font: fonts.sans,
      color: theme.accent
    });

    page.drawText(slide.items[i], {
      x: colLeft + 42,
      y: lineY,
      size: 13,
      font: fonts.mono,
      color: theme.ink
    });
  }

  page.drawText('Observação de operação', {
    x: panel.x + 22,
    y: panel.y + 26,
    size: 11,
    font: fonts.sans,
    color: theme.noteText
  });

  if (slide.notes) {
    drawNotePanel(page, slide.notes, panel.x + panel.w - 334, panel.y + 60, 300, 110, fonts.sans, fonts.serifBold);
  }
}

function drawInstall(page, slide, idx, total, fonts) {
  drawPageBase(page, 1);
  drawHeader(page, slide.section || 'Instalação', fonts.serifBold, fonts.sans, idx, total);
  drawTitle(page, slide.title, fonts.serifBold, 612, 40);

  const left = { x: 78, y: 160, w: 650, h: 420 };
  const right = { x: 746, y: 160, w: 532, h: 420 };

  page.drawRectangle({ x: left.x, y: left.y, width: left.w, height: left.h, color: theme.paper, borderColor: theme.border, borderWidth: 1 });
  page.drawRectangle({ x: left.x, y: left.y + left.h - 8, width: left.w, height: 8, color: theme.accent });

  page.drawRectangle({ x: right.x, y: right.y, width: right.w, height: right.h, color: theme.paper, borderColor: theme.border, borderWidth: 1 });
  page.drawRectangle({ x: right.x, y: right.y + right.h - 8, width: right.w, height: 8, color: theme.accent });

  drawBulletList(
    page,
    slide.items,
    left.x + 22,
    left.y + left.h - 44,
    left.w - 44,
    fonts.sans,
    18,
    38,
    theme.ink
  );

  page.drawText('Comando de validação', {
    x: right.x + 18,
    y: right.y + right.h - 44,
    size: 11,
    font: fonts.sans,
    color: theme.noteText
  });

  if (slide.command) {
    page.drawRectangle({
      x: right.x + 18,
      y: right.y + right.h - 84,
      width: right.w - 36,
      height: 40,
      color: theme.noteBg,
      borderColor: theme.border,
      borderWidth: 1
    });

    page.drawText(slide.command, {
      x: right.x + 28,
      y: right.y + right.h - 68,
      size: 15,
      font: fonts.mono,
      color: theme.ink
    });
  }

  if (slide.notes) {
    drawNotePanel(page, slide.notes, right.x + 18, right.y + 72, right.w - 36, 120, fonts.sans, fonts.serifBold);
  }
}

function drawClosing(page, slide, idx, total, fonts) {
  drawPageBase(page, 2);
  drawHeader(page, slide.section || 'Conclusão', fonts.serifBold, fonts.sans, idx, total);
  drawTitle(page, slide.title, fonts.serifBold, 615, 56);

  const panel = { x: 78, y: 220, w: W - 156, h: 320 };
  page.drawRectangle({ x: panel.x, y: panel.y, width: panel.w, height: panel.h, color: theme.paper, borderColor: theme.border, borderWidth: 1 });
  page.drawRectangle({ x: panel.x, y: panel.y + panel.h - 8, width: panel.w, height: 8, color: theme.accent });

  drawBulletList(
    page,
    slide.items,
    panel.x + 26,
    panel.y + panel.h - 56,
    panel.w - 52,
    fonts.sans,
    22,
    44,
    theme.ink
  );

  if (slide.quote) {
    const quotePanel = { x: panel.x + 26, y: 255, w: panel.w - 52, h: 72 };
    page.drawRectangle({ x: quotePanel.x, y: quotePanel.y, width: quotePanel.w, height: quotePanel.h, color: theme.noteBg, borderColor: theme.border, borderWidth: 1 });
    page.drawText(slide.quote, {
      x: quotePanel.x + 14,
      y: quotePanel.y + 34,
      size: 16,
      font: fonts.serif,
      color: theme.noteText
    });
  }

  if (slide.notes && slide.notes.length) {
    page.drawText(slide.notes[0], {
      x: panel.x + 26,
      y: 238,
      size: 12,
      font: fonts.sans,
      color: theme.accent
    });
  }
}

async function main() {
  const doc = await PDFDocument.create();
  const fonts = {
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    mono: await doc.embedFont(StandardFonts.Courier)
  };

  const total = slides.length;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const page = doc.addPage([W, H]);

    if (slide.type === 'cover') {
      drawCover(page, slide, i, total, fonts);
      continue;
    }

    if (slide.type === 'agenda') {
      drawAgenda(page, slide, i, total, fonts);
      continue;
    }

    if (slide.type === 'commands') {
      drawCommands(page, slide, i, total, fonts);
      continue;
    }

    if (slide.type === 'install') {
      drawInstall(page, slide, i, total, fonts);
      continue;
    }

    if (slide.type === 'closing') {
      drawClosing(page, slide, i, total, fonts);
      continue;
    }

    // feature-like slides with alternating layout
    const layoutStyle = i % 2 === 0 ? 'left' : 'right';
    drawFeature(page, slide, i, total, fonts, layoutStyle);
  }

  const outPath = path.resolve('outputs', 'containers-docker-apresentacao.pdf');
  await fs.writeFile(outPath, await doc.save());
  console.log(`Gerado: ${outPath}`);
}

await main();


