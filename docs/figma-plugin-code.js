/* =====================================================================
   Man Physicsi — Design System builder
   ---------------------------------------------------------------------
   Creates, in the current Figma file:
     · Color styles      (semantic names, slash notation)
     · Text styles       (Vazirmatn, Persian-friendly line heights)
     · Design system page documentation frames
     · Three base components: Top bar, Orb, List row
     · Three screen frames wired up with instances
   Safe to re-run: existing styles with the same name are reused.
   ===================================================================== */

/* ---------- tokens ---------- */

var COLORS = [
  ['Primary/Default',      '#4F46E5'],
  ['Primary/Subtle',       '#EEF2FF'],
  ['Text/Title',           '#111827'],
  ['Text/Body',            '#374151'],
  ['Text/Muted',           '#6B7280'],
  ['Text/OnPrimary',       '#FFFFFF'],
  ['Surface/Background',   '#F9FAFB'],
  ['Surface/Card',         '#FFFFFF'],
  ['Surface/Board',        '#0B1026'],
  ['Surface/Bubble-user',  '#4F46E5'],
  ['Surface/Bubble-ai',    '#F3F4F6'],
  ['Border/Default',       '#E5E7EB'],
  ['Accent/Warning',       '#F2B155']
];

// name, size, weight, line-height %
var TYPE = [
  ['H1',         24, 'SemiBold', 150],
  ['H2',         18, 'SemiBold', 150],
  ['Body',       16, 'Regular',  180],
  ['Body/Small', 14, 'Regular',  170],
  ['Label',      12, 'Regular',  150]
];

var SPACING = [4, 8, 12, 16, 24, 32];

var FAMILY = 'Vazirmatn';
var FALLBACK = 'Inter';

/* ---------- small helpers ---------- */

function hexToRgb(hex) {
  var h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255
  };
}

function solid(hex) {
  return [{ type: 'SOLID', color: hexToRgb(hex) }];
}

/* The style/document setters became async in dynamic-page mode.
   These wrappers use the async form when present, else the legacy one,
   so the plugin runs on both old and new Figma builds. */

async function localPaintStyles() {
  return figma.getLocalPaintStylesAsync
    ? await figma.getLocalPaintStylesAsync()
    : figma.getLocalPaintStyles();
}

async function localTextStyles() {
  return figma.getLocalTextStylesAsync
    ? await figma.getLocalTextStylesAsync()
    : figma.getLocalTextStyles();
}

async function setFillStyle(node, style) {
  if (node.setFillStyleIdAsync) await node.setFillStyleIdAsync(style.id);
  else node.fillStyleId = style.id;
}

async function setStrokeStyle(node, style) {
  if (node.setStrokeStyleIdAsync) await node.setStrokeStyleIdAsync(style.id);
  else node.strokeStyleId = style.id;
}

async function setTextStyle(node, style) {
  if (node.setTextStyleIdAsync) await node.setTextStyleIdAsync(style.id);
  else node.textStyleId = style.id;
}

/* ---------- font loading ---------- */

var FONT = FAMILY;

async function loadFonts() {
  var weights = ['Regular', 'Medium', 'SemiBold', 'Bold'];
  try {
    for (var i = 0; i < weights.length; i++) {
      await figma.loadFontAsync({ family: FAMILY, style: weights[i] });
    }
    return FAMILY;
  } catch (e) {
    figma.notify('Vazirmatn پیدا نشد — موقتاً از ' + FALLBACK + ' استفاده شد.', { timeout: 5000 });
    for (var j = 0; j < weights.length; j++) {
      try { await figma.loadFontAsync({ family: FALLBACK, style: weights[j] }); } catch (e2) {}
    }
    return FALLBACK;
  }
}

/* ---------- pages ---------- */

async function ensurePage(name) {
  if (figma.loadAllPagesAsync) await figma.loadAllPagesAsync();
  var pages = figma.root.children;
  for (var i = 0; i < pages.length; i++) {
    if (pages[i].name === name) return pages[i];
  }
  var p = figma.createPage();
  p.name = name;
  return p;
}

/* ---------- styles ---------- */

var paint = {};   // name -> PaintStyle
var text = {};    // name -> TextStyle

async function buildColorStyles() {
  var existing = await localPaintStyles();
  var byName = {};
  existing.forEach(function (s) { byName[s.name] = s; });

  for (var i = 0; i < COLORS.length; i++) {
    var name = COLORS[i][0], hex = COLORS[i][1];
    var st = byName[name];
    if (!st) {
      st = figma.createPaintStyle();
      st.name = name;
    }
    st.paints = solid(hex);
    paint[name] = st;
  }
}

async function buildTextStyles(family) {
  var existing = await localTextStyles();
  var byName = {};
  existing.forEach(function (s) { byName[s.name] = s; });

  for (var i = 0; i < TYPE.length; i++) {
    var name = TYPE[i][0], size = TYPE[i][1], weight = TYPE[i][2], lh = TYPE[i][3];
    var st = byName[name];
    if (!st) {
      st = figma.createTextStyle();
      st.name = name;
    }
    var styleName = (family === FALLBACK && weight === 'SemiBold') ? 'Semi Bold' : weight;
    try {
      st.fontName = { family: family, style: styleName };
    } catch (e) {
      st.fontName = { family: family, style: 'Regular' };
    }
    st.fontSize = size;
    st.lineHeight = { unit: 'PERCENT', value: lh };
    st.letterSpacing = { unit: 'PIXELS', value: 0 };
    text[name] = st;
  }
}

/* ---------- node factories ---------- */

function frame(name, w, h) {
  var f = figma.createFrame();
  f.name = name;
  f.resizeWithoutConstraints(w, h);
  f.fills = solid('#FFFFFF');
  f.clipsContent = true;
  return f;
}

function autoFrame(name, dir, gap, pad) {
  var f = figma.createFrame();
  f.name = name;
  f.layoutMode = dir;
  f.itemSpacing = gap;
  f.paddingTop = pad[0];
  f.paddingRight = pad[1];
  f.paddingBottom = pad[2];
  f.paddingLeft = pad[3];
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.fills = [];
  return f;
}

async function label(content, styleName, colorName) {
  var t = figma.createText();
  t.fontName = { family: FONT, style: 'Regular' };
  t.characters = content;
  t.textAlignHorizontal = 'RIGHT';
  t.textAutoResize = 'WIDTH_AND_HEIGHT';
  if (text[styleName]) await setTextStyle(t, text[styleName]);
  if (colorName && paint[colorName]) await setFillStyle(t, paint[colorName]);
  return t;
}

/* ---------- documentation frames ---------- */

async function buildColorDocs(page, x, y) {
  var f = frame('01 Colors', 800, 420);
  f.x = x; f.y = y;
  await setFillStyle(f, paint['Surface/Card']);
  page.appendChild(f);

  var title = await label('رنگ‌ها', 'H2', 'Text/Title');
  title.x = 640; title.y = 28;
  f.appendChild(title);

  var perRow = 5, cell = 140, top = 84;
  for (var i = 0; i < COLORS.length; i++) {
    var name = COLORS[i][0], hex = COLORS[i][1];
    var col = i % perRow, row = Math.floor(i / perRow);

    var sw = figma.createRectangle();
    sw.resizeWithoutConstraints(96, 72);
    sw.cornerRadius = 12;
    sw.x = 660 - col * cell;
    sw.y = top + row * 112;
    sw.fills = solid(hex);
    sw.strokes = solid('#E5E7EB');
    sw.strokeWeight = 1;
    f.appendChild(sw);

    var nm = await label(name, 'Label', 'Text/Title');
    nm.x = 660 - col * cell + 96 - nm.width;
    nm.y = top + row * 112 + 78;
    f.appendChild(nm);

    var hx = await label(hex, 'Label', 'Text/Muted');
    hx.x = 660 - col * cell + 96 - hx.width;
    hx.y = top + row * 112 + 96;
    f.appendChild(hx);
  }
  return f;
}

async function buildTypeDocs(page, x, y) {
  var f = frame('02 Typography', 800, 560);
  f.x = x; f.y = y;
  await setFillStyle(f, paint['Surface/Card']);
  page.appendChild(f);

  var title = await label('تایپوگرافی', 'H2', 'Text/Title');
  title.x = 640; title.y = 28;
  f.appendChild(title);

  var samples = [
    ['H1', 'بار الکتریکی'],
    ['H2', 'قانون کولن و میدان'],
    ['Body', 'نیروی میان دو بار نقطه‌ای با مربع فاصله نسبت وارون دارد.'],
    ['Body/Small', 'فیزیک یازدهم · فصل ۱ · بند ۱ · حدود شش دقیقه'],
    ['Label', '۱۸ پرسش چهارگزینه‌ای']
  ];

  var yy = 96;
  for (var i = 0; i < samples.length; i++) {
    var key = samples[i][0];

    var meta = await label(key + ' · ' + TYPE[i][1] + '/' + TYPE[i][3] + '٪', 'Label', 'Text/Muted');
    meta.x = 660 - meta.width;
    meta.y = yy;
    f.appendChild(meta);

    var sample = await label(samples[i][1], key, 'Text/Title');
    sample.x = 660 - sample.width;
    if (sample.width > 600) {
      sample.textAutoResize = 'HEIGHT';
      sample.resizeWithoutConstraints(600, sample.height);
      sample.x = 60;
    }
    sample.y = yy + 22;
    f.appendChild(sample);

    yy += 22 + sample.height + 34;
  }
  return f;
}

async function buildSpacingDocs(page, x, y) {
  var f = frame('03 Spacing', 800, 260);
  f.x = x; f.y = y;
  await setFillStyle(f, paint['Surface/Card']);
  page.appendChild(f);

  var title = await label('شبکهٔ ۴ واحدی', 'H2', 'Text/Title');
  title.x = 640; title.y = 28;
  f.appendChild(title);

  var note = await label('هیچ عدد دیگری مجاز نیست — نه ۱۰، نه ۱۵، نه ۱۸.', 'Label', 'Text/Muted');
  note.x = 660 - note.width; note.y = 66;
  f.appendChild(note);

  var cursorX = 660;
  for (var i = 0; i < SPACING.length; i++) {
    var v = SPACING[i];
    var bar = figma.createRectangle();
    bar.resizeWithoutConstraints(v, 64);
    bar.cornerRadius = 3;
    bar.x = cursorX - v;
    bar.y = 116;
    await setFillStyle(bar, paint['Primary/Default']);
    f.appendChild(bar);

    var cap = await label(String(v), 'Label', 'Text/Muted');
    cap.x = cursorX - v / 2 - cap.width / 2;
    cap.y = 190;
    f.appendChild(cap);

    cursorX -= (v + 56);
  }
  return f;
}

/* ---------- components ---------- */

async function buildTopBar() {
  var bar = autoFrame('Top bar', 'HORIZONTAL', 12, [0, 16, 0, 16]);
  bar.primaryAxisSizingMode = 'FIXED';
  bar.counterAxisSizingMode = 'FIXED';
  bar.resizeWithoutConstraints(360, 56);
  bar.counterAxisAlignItems = 'CENTER';
  await setFillStyle(bar, paint['Surface/Card']);
  bar.strokes = solid('#E5E7EB');
  bar.strokeWeight = 1;
  bar.strokeAlign = 'INSIDE';
  bar.strokeTopWeight = 0;
  bar.strokeLeftWeight = 0;
  bar.strokeRightWeight = 0;

  // RTL: back button first in the layer order = right-most on screen
  var back = figma.createFrame();
  back.name = 'Back';
  back.resizeWithoutConstraints(36, 36);
  back.cornerRadius = 11;
  await setFillStyle(back, paint['Primary/Subtle']);
  bar.appendChild(back);

  var title = await label('عنوان صفحه', 'H2', 'Text/Title');
  title.name = 'Title';
  title.textAutoResize = 'HEIGHT';
  bar.appendChild(title);
  title.layoutGrow = 1;

  var ai = figma.createFrame();
  ai.name = 'AI';
  ai.resizeWithoutConstraints(36, 36);
  ai.cornerRadius = 11;
  await setFillStyle(ai, paint['Primary/Default']);
  bar.appendChild(ai);

  var comp = figma.createComponentFromNode(bar);
  comp.name = 'Top bar';
  return comp;
}

async function buildOrb() {
  var wrap = autoFrame('Orb', 'VERTICAL', 12, [0, 0, 0, 0]);
  wrap.counterAxisAlignItems = 'CENTER';

  var disc = figma.createEllipse();
  disc.name = 'Disc';
  disc.resizeWithoutConstraints(104, 104);
  disc.fills = [{ type: 'SOLID', color: hexToRgb('#FFFFFF'), opacity: 0.12 }];
  disc.strokes = [{ type: 'SOLID', color: hexToRgb('#E8ECF7'), opacity: 0.22 }];
  disc.strokeWeight = 1;
  wrap.appendChild(disc);

  var cap = await label('عنوان', 'Body/Small', 'Text/Title');
  cap.name = 'Caption';
  cap.textAlignHorizontal = 'CENTER';
  wrap.appendChild(cap);

  var comp = figma.createComponentFromNode(wrap);
  comp.name = 'Orb';
  return comp;
}

async function buildListRow() {
  var row = autoFrame('List row', 'HORIZONTAL', 13, [13, 16, 13, 16]);
  row.primaryAxisSizingMode = 'FIXED';
  row.counterAxisSizingMode = 'AUTO';
  row.resizeWithoutConstraints(360, 72);
  row.counterAxisAlignItems = 'CENTER';
  await setFillStyle(row, paint['Surface/Card']);
  row.strokes = solid('#E5E7EB');
  row.strokeWeight = 1;
  row.strokeAlign = 'INSIDE';
  row.strokeTopWeight = 0;
  row.strokeLeftWeight = 0;
  row.strokeRightWeight = 0;

  var thumb = figma.createEllipse();
  thumb.name = 'Thumb';
  thumb.resizeWithoutConstraints(46, 46);
  await setFillStyle(thumb, paint['Primary/Subtle']);
  row.appendChild(thumb);

  var col = autoFrame('Text', 'VERTICAL', 2, [0, 0, 0, 0]);
  col.counterAxisAlignItems = 'MAX';
  var t1 = await label('عنوان فصل', 'Body/Small', 'Text/Title');
  var t2 = await label('۴ بند · ۳۲ پرسش', 'Label', 'Text/Muted');
  col.appendChild(t1);
  col.appendChild(t2);
  row.appendChild(col);
  col.layoutGrow = 1;
  col.primaryAxisSizingMode = 'AUTO';

  var chev = figma.createPolygon();
  chev.name = 'Chevron';
  chev.resizeWithoutConstraints(10, 12);
  chev.rotation = 90;
  await setFillStyle(chev, paint['Border/Default']);
  row.appendChild(chev);

  var comp = figma.createComponentFromNode(row);
  comp.name = 'List row';
  return comp;
}

/* ---------- screens ---------- */

async function buildHome(page, x, y, orbComp) {
  var f = frame('01 Home', 360, 800);
  f.x = x; f.y = y;
  await setFillStyle(f, paint['Surface/Board']);
  page.appendChild(f);

  var hint = await label('جای تصویر پس‌زمینهٔ سایت', 'Label', 'Text/OnPrimary');
  hint.opacity = 0.4;
  hint.x = 360 - hint.width - 16;
  hint.y = 20;
  f.appendChild(hint);

  var captions = ['فیزیک دبیرستان', 'فیزیک دانشگاه', 'ویکی فیزیک', 'هوش مصنوعی'];
  for (var i = 0; i < 4; i++) {
    var inst = orbComp.createInstance();
    var col = i % 2, row = Math.floor(i / 2);
    inst.x = 202 - col * 154;
    inst.y = 268 + row * 176;
    f.appendChild(inst);

    var capNode = inst.findOne(function (n) { return n.type === 'TEXT'; });
    if (capNode) {
      await figma.loadFontAsync(capNode.fontName);
      capNode.characters = captions[i];
      await setFillStyle(capNode, paint['Text/OnPrimary']);
    }
  }
  return f;
}

async function buildChapters(page, x, y, barComp, rowComp) {
  var f = frame('02 Chapters', 360, 800);
  f.x = x; f.y = y;
  await setFillStyle(f, paint['Surface/Background']);
  page.appendChild(f);

  var bar = barComp.createInstance();
  bar.x = 0; bar.y = 0;
  f.appendChild(bar);
  var barTitle = bar.findOne(function (n) { return n.type === 'TEXT'; });
  if (barTitle) {
    await figma.loadFontAsync(barTitle.fontName);
    barTitle.characters = 'فصل‌ها';
  }

  var rows = [
    ['الکتریسیتهٔ ساکن', '۴ بند · ۳۲ پرسش'],
    ['جریان الکتریکی', '۵ بند · ۴۱ پرسش'],
    ['مغناطیس', '۳ بند · ۲۸ پرسش'],
    ['القای الکترومغناطیسی', '۴ بند · ۳۶ پرسش']
  ];

  for (var i = 0; i < rows.length; i++) {
    var inst = rowComp.createInstance();
    inst.x = 0;
    inst.y = 56 + i * 72;
    f.appendChild(inst);

    var texts = inst.findAll(function (n) { return n.type === 'TEXT'; });
    for (var j = 0; j < texts.length && j < 2; j++) {
      await figma.loadFontAsync(texts[j].fontName);
      texts[j].characters = rows[i][j];
    }
  }
  return f;
}

async function buildReader(page, x, y, barComp) {
  var f = frame('03 Reader', 360, 800);
  f.x = x; f.y = y;
  await setFillStyle(f, paint['Surface/Card']);
  page.appendChild(f);

  var bar = barComp.createInstance();
  bar.x = 0; bar.y = 0;
  f.appendChild(bar);
  var barTitle = bar.findOne(function (n) { return n.type === 'TEXT'; });
  if (barTitle) {
    await figma.loadFontAsync(barTitle.fontName);
    barTitle.characters = 'بار الکتریکی';
  }

  var h = await label('بار الکتریکی', 'H1', 'Text/Title');
  h.textAutoResize = 'HEIGHT';
  h.resizeWithoutConstraints(328, h.height);
  h.x = 16; h.y = 80;
  f.appendChild(h);

  var meta = await label('فیزیک یازدهم · فصل ۱ · بند ۱ · حدود ۶ دقیقه', 'Label', 'Text/Muted');
  meta.textAutoResize = 'HEIGHT';
  meta.resizeWithoutConstraints(328, meta.height);
  meta.x = 16; meta.y = 80 + h.height + 6;
  f.appendChild(meta);

  var paras = [
    'اگر میله‌ای پلاستیکی را با پارچه‌ای پشمی بمالیم، میله می‌تواند تکه‌های ریز کاغذ را به خود جذب کند. این اثر ساده نخستین نشانه از وجود کمیتی به نام بار الکتریکی است.',
    'بار الکتریکی دو نوع دارد که آن‌ها را مثبت و منفی می‌نامیم. بارهای هم‌نام یکدیگر را می‌رانند و بارهای ناهم‌نام یکدیگر را می‌ربایند.',
    'نیروی میان دو بار نقطه‌ای با حاصل‌ضرب اندازهٔ بارها نسبت مستقیم و با مربع فاصلهٔ میان آن‌ها نسبت وارون دارد.'
  ];

  var yy = 80 + h.height + 6 + meta.height + 20;
  for (var i = 0; i < paras.length; i++) {
    var p = await label(paras[i], 'Body', 'Text/Body');
    p.textAutoResize = 'HEIGHT';
    p.resizeWithoutConstraints(292, 10);
    p.x = 46; p.y = yy;
    f.appendChild(p);

    // the "؟" affordance in the empty left margin
    var ask = figma.createFrame();
    ask.name = 'Ask';
    ask.resizeWithoutConstraints(24, 24);
    ask.cornerRadius = 8;
    await setFillStyle(ask, paint['Surface/Background']);
    ask.strokes = solid('#E5E7EB');
    ask.strokeWeight = 1;
    ask.x = 16; ask.y = yy + 2;
    f.appendChild(ask);

    yy += p.height + 16;
  }
  return f;
}

/* ---------- main ---------- */

async function main() {
  FONT = await loadFonts();

  await buildColorStyles();
  await buildTextStyles(FONT);

  var ds = await ensurePage('Design system');
  var screens = await ensurePage('Screens');

  if (figma.setCurrentPageAsync) await figma.setCurrentPageAsync(ds);
  else figma.currentPage = ds;

  var y = 0;
  var f1 = await buildColorDocs(ds, 0, y);    y += f1.height + 120;
  var f2 = await buildTypeDocs(ds, 0, y);     y += f2.height + 120;
  var f3 = await buildSpacingDocs(ds, 0, y);  y += f3.height + 120;

  var heading = await label('کامپوننت‌ها', 'H2', 'Text/Title');
  heading.x = 660 - heading.width;
  heading.y = y;
  ds.appendChild(heading);

  var topBar = await buildTopBar();
  var orb = await buildOrb();
  var listRow = await buildListRow();

  ds.appendChild(topBar);  topBar.x = 300;  topBar.y = y + 56;
  ds.appendChild(orb);     orb.x = 520;     orb.y = y + 156;
  ds.appendChild(listRow); listRow.x = 300; listRow.y = y + 340;

  await buildHome(screens, 0, 0, orb);
  await buildChapters(screens, 460, 0, topBar, listRow);
  await buildReader(screens, 920, 0, topBar);

  figma.notify('ساخته شد: ' + COLORS.length + ' رنگ، ' + TYPE.length + ' استایل متن، ۳ کامپوننت، ۳ صفحه.', { timeout: 6000 });
  figma.closePlugin();
}

main().catch(function (err) {
  figma.notify('خطا: ' + err.message, { error: true, timeout: 8000 });
  figma.closePlugin();
});
