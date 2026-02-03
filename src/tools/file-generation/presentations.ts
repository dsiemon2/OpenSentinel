import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { isPathAllowed } from "../../utils/paths";

export interface PresentationOptions {
  title?: string;
  author?: string;
  subject?: string;
  company?: string;
  layout?: "LAYOUT_16x9" | "LAYOUT_4x3" | "LAYOUT_WIDE";
  theme?: PresentationTheme;
}

export interface PresentationTheme {
  backgroundColor?: string;
  titleColor?: string;
  textColor?: string;
  accentColor?: string;
  titleFont?: string;
  bodyFont?: string;
}

export interface PresentationResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export type SlideLayout =
  | "title"
  | "title-content"
  | "title-two-columns"
  | "section"
  | "comparison"
  | "blank"
  | "title-only"
  | "content-only";

export interface SlideElement {
  type: "text" | "bullet-list" | "numbered-list" | "image" | "shape" | "table" | "chart";
  x?: number; // Percentage from left (0-100)
  y?: number; // Percentage from top (0-100)
  width?: number; // Percentage of slide width
  height?: number; // Percentage of slide height
}

export interface TextElement extends SlideElement {
  type: "text";
  text: string;
  fontSize?: number;
  fontFace?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
}

export interface BulletListElement extends SlideElement {
  type: "bullet-list";
  items: string[];
  fontSize?: number;
  color?: string;
  bulletColor?: string;
}

export interface NumberedListElement extends SlideElement {
  type: "numbered-list";
  items: string[];
  fontSize?: number;
  color?: string;
  startNumber?: number;
}

export interface ImageElement extends SlideElement {
  type: "image";
  path: string;
  sizing?: "contain" | "cover" | "stretch";
}

export interface ShapeElement extends SlideElement {
  type: "shape";
  shapeType: "rectangle" | "ellipse" | "triangle" | "arrow" | "line";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  textColor?: string;
}

export interface TableElement extends SlideElement {
  type: "table";
  headers?: string[];
  rows: string[][];
  headerColor?: string;
  headerTextColor?: string;
  borderColor?: string;
  alternateRowColor?: string;
}

export interface ChartElement extends SlideElement {
  type: "chart";
  chartType: "bar" | "line" | "pie" | "doughnut" | "area";
  title?: string;
  labels: string[];
  data: number[] | { name: string; values: number[] }[];
  colors?: string[];
}

export type SlideContent =
  | TextElement
  | BulletListElement
  | NumberedListElement
  | ImageElement
  | ShapeElement
  | TableElement
  | ChartElement;

export interface Slide {
  layout?: SlideLayout;
  title?: string;
  subtitle?: string;
  content?: SlideContent[];
  notes?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  transition?: "none" | "fade" | "slide" | "zoom";
}

// Default theme
const DEFAULT_THEME: PresentationTheme = {
  backgroundColor: "FFFFFF",
  titleColor: "2F5496",
  textColor: "333333",
  accentColor: "4472C4",
  titleFont: "Calibri Light",
  bodyFont: "Calibri",
};

// Default options
const DEFAULT_OPTIONS: PresentationOptions = {
  layout: "LAYOUT_16x9",
  theme: DEFAULT_THEME,
};

// Generate temp file path
function getTempPath(): string {
  const id = randomBytes(8).toString("hex");
  return join(tmpdir(), `moltbot-presentation-${id}.pptx`);
}

// Escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Convert percentage to EMUs (English Metric Units)
// Slide dimensions in EMUs: 16:9 is 9144000 x 5143500
function percentToEmuX(percent: number, layout: string = "LAYOUT_16x9"): number {
  const slideWidth = layout === "LAYOUT_4x3" ? 9144000 : 12192000;
  return Math.round((percent / 100) * slideWidth);
}

function percentToEmuY(percent: number, layout: string = "LAYOUT_16x9"): number {
  const slideHeight = layout === "LAYOUT_4x3" ? 6858000 : 6858000;
  return Math.round((percent / 100) * slideHeight);
}

// Convert points to EMUs (1 point = 12700 EMUs)
function pointsToEmu(points: number): number {
  return points * 12700;
}

// Convert color to OOXML format (remove # if present)
function normalizeColor(color: string): string {
  return color.replace("#", "").toUpperCase();
}

// Generate [Content_Types].xml
function generateContentTypesXml(slideCount: number): string {
  let overrides = "";
  for (let i = 1; i <= slideCount; i++) {
    overrides += `<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${overrides}
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

// Generate _rels/.rels
function generateRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

// Generate ppt/presentation.xml
function generatePresentationXml(slideCount: number, options: PresentationOptions): string {
  let slideIdList = "";
  let slideRelIds = "";

  for (let i = 1; i <= slideCount; i++) {
    slideIdList += `<p:sldId id="${255 + i}" r:id="rId${i + 2}"/>`;
  }

  const layout = options.layout || "LAYOUT_16x9";
  const slideWidth = layout === "LAYOUT_4x3" ? "9144000" : "12192000";
  const slideHeight = "6858000";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                saveSubsetFonts="1">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    ${slideIdList}
  </p:sldIdLst>
  <p:sldSz cx="${slideWidth}" cy="${slideHeight}"/>
  <p:notesSz cx="${slideHeight}" cy="${slideWidth}"/>
</p:presentation>`;
}

// Generate ppt/_rels/presentation.xml.rels
function generatePresentationRelsXml(slideCount: number): string {
  let slideRels = "";
  for (let i = 1; i <= slideCount; i++) {
    slideRels += `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  ${slideRels}
</Relationships>`;
}

// Generate ppt/theme/theme1.xml
function generateThemeXml(theme: PresentationTheme): string {
  const t = { ...DEFAULT_THEME, ...theme };

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Moltbot Theme">
  <a:themeElements>
    <a:clrScheme name="Moltbot">
      <a:dk1><a:srgbClr val="000000"/></a:dk1>
      <a:lt1><a:srgbClr val="${normalizeColor(t.backgroundColor!)}"/></a:lt1>
      <a:dk2><a:srgbClr val="${normalizeColor(t.titleColor!)}"/></a:dk2>
      <a:lt2><a:srgbClr val="EEECE1"/></a:lt2>
      <a:accent1><a:srgbClr val="${normalizeColor(t.accentColor!)}"/></a:accent1>
      <a:accent2><a:srgbClr val="C0504D"/></a:accent2>
      <a:accent3><a:srgbClr val="9BBB59"/></a:accent3>
      <a:accent4><a:srgbClr val="8064A2"/></a:accent4>
      <a:accent5><a:srgbClr val="4BACC6"/></a:accent5>
      <a:accent6><a:srgbClr val="F79646"/></a:accent6>
      <a:hlink><a:srgbClr val="0000FF"/></a:hlink>
      <a:folHlink><a:srgbClr val="800080"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Moltbot">
      <a:majorFont>
        <a:latin typeface="${t.titleFont}"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:majorFont>
      <a:minorFont>
        <a:latin typeface="${t.bodyFont}"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Moltbot">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;
}

// Generate ppt/slideMasters/slideMaster1.xml
function generateSlideMasterXml(theme: PresentationTheme, layout: string): string {
  const t = { ...DEFAULT_THEME, ...theme };
  const slideWidth = layout === "LAYOUT_4x3" ? 9144000 : 12192000;
  const slideHeight = 6858000;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill>
          <a:srgbClr val="${normalizeColor(t.backgroundColor!)}"/>
        </a:solidFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
    <p:sldLayoutId id="2147483650" r:id="rId2"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`;
}

// Generate ppt/slideMasters/_rels/slideMaster1.xml.rels
function generateSlideMasterRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
}

// Generate slide layout XML
function generateSlideLayoutXml(layoutType: "title" | "content"): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             type="${layoutType === "title" ? "title" : "obj"}">
  <p:cSld name="${layoutType === "title" ? "Title Slide" : "Title and Content"}">
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

// Generate slide layout rels
function generateSlideLayoutRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
}

// Generate slide XML
function generateSlideXml(
  slide: Slide,
  slideIndex: number,
  options: PresentationOptions
): string {
  const theme = { ...DEFAULT_THEME, ...options.theme };
  const layout = options.layout || "LAYOUT_16x9";
  const slideWidth = layout === "LAYOUT_4x3" ? 9144000 : 12192000;
  const slideHeight = 6858000;

  let shapesXml = "";
  let shapeId = 2;

  // Background
  let bgXml = "";
  if (slide.backgroundColor) {
    bgXml = `<p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="${normalizeColor(slide.backgroundColor)}"/></a:solidFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>`;
  }

  // Title
  if (slide.title) {
    const titleY = slide.layout === "title" ? 30 : 5;
    const titleFontSize = slide.layout === "title" ? 4400 : 3200;

    shapesXml += `<p:sp>
      <p:nvSpPr>
        <p:cNvPr id="${shapeId++}" name="Title"/>
        <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
        <p:nvPr><p:ph type="title"/></p:nvPr>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm>
          <a:off x="${Math.round(slideWidth * 0.05)}" y="${Math.round(slideHeight * titleY / 100)}"/>
          <a:ext cx="${Math.round(slideWidth * 0.9)}" cy="${Math.round(slideHeight * 0.15)}"/>
        </a:xfrm>
      </p:spPr>
      <p:txBody>
        <a:bodyPr anchor="ctr"/>
        <a:lstStyle/>
        <a:p>
          <a:pPr algn="ctr"/>
          <a:r>
            <a:rPr lang="en-US" sz="${titleFontSize}" b="1">
              <a:solidFill><a:srgbClr val="${normalizeColor(theme.titleColor!)}"/></a:solidFill>
              <a:latin typeface="${theme.titleFont}"/>
            </a:rPr>
            <a:t>${escapeXml(slide.title)}</a:t>
          </a:r>
        </a:p>
      </p:txBody>
    </p:sp>`;
  }

  // Subtitle (for title slides)
  if (slide.subtitle && slide.layout === "title") {
    shapesXml += `<p:sp>
      <p:nvSpPr>
        <p:cNvPr id="${shapeId++}" name="Subtitle"/>
        <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
        <p:nvPr><p:ph type="subTitle"/></p:nvPr>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm>
          <a:off x="${Math.round(slideWidth * 0.1)}" y="${Math.round(slideHeight * 0.55)}"/>
          <a:ext cx="${Math.round(slideWidth * 0.8)}" cy="${Math.round(slideHeight * 0.15)}"/>
        </a:xfrm>
      </p:spPr>
      <p:txBody>
        <a:bodyPr anchor="t"/>
        <a:lstStyle/>
        <a:p>
          <a:pPr algn="ctr"/>
          <a:r>
            <a:rPr lang="en-US" sz="2400">
              <a:solidFill><a:srgbClr val="${normalizeColor(theme.textColor!)}"/></a:solidFill>
              <a:latin typeface="${theme.bodyFont}"/>
            </a:rPr>
            <a:t>${escapeXml(slide.subtitle)}</a:t>
          </a:r>
        </a:p>
      </p:txBody>
    </p:sp>`;
  }

  // Content elements
  if (slide.content) {
    for (const element of slide.content) {
      shapesXml += generateContentElementXml(element, shapeId++, options, theme);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    ${bgXml}
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${shapesXml}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

// Generate content element XML
function generateContentElementXml(
  element: SlideContent,
  shapeId: number,
  options: PresentationOptions,
  theme: PresentationTheme
): string {
  const layout = options.layout || "LAYOUT_16x9";
  const slideWidth = layout === "LAYOUT_4x3" ? 9144000 : 12192000;
  const slideHeight = 6858000;

  // Default positions based on content type
  const x = element.x !== undefined ? percentToEmuX(element.x, layout) : Math.round(slideWidth * 0.05);
  const y = element.y !== undefined ? percentToEmuY(element.y, layout) : Math.round(slideHeight * 0.25);
  const width = element.width !== undefined ? percentToEmuX(element.width, layout) : Math.round(slideWidth * 0.9);
  const height = element.height !== undefined ? percentToEmuY(element.height, layout) : Math.round(slideHeight * 0.65);

  switch (element.type) {
    case "text":
      return generateTextElementXml(element, shapeId, x, y, width, height, theme);
    case "bullet-list":
      return generateBulletListElementXml(element, shapeId, x, y, width, height, theme);
    case "numbered-list":
      return generateNumberedListElementXml(element, shapeId, x, y, width, height, theme);
    case "table":
      return generateTableElementXml(element, shapeId, x, y, width, height, theme);
    case "shape":
      return generateShapeElementXml(element, shapeId, x, y, width, height);
    case "image":
      return generateImagePlaceholderXml(element, shapeId, x, y, width, height);
    case "chart":
      return generateChartPlaceholderXml(element, shapeId, x, y, width, height, theme);
    default:
      return "";
  }
}

// Generate text element XML
function generateTextElementXml(
  element: TextElement,
  shapeId: number,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: PresentationTheme
): string {
  const fontSize = (element.fontSize || 18) * 100;
  const color = element.color ? normalizeColor(element.color) : normalizeColor(theme.textColor!);
  const font = element.fontFace || theme.bodyFont;
  const align = element.align || "left";
  const valign = element.valign || "top";

  let rPr = `<a:rPr lang="en-US" sz="${fontSize}"`;
  if (element.bold) rPr += ' b="1"';
  if (element.italic) rPr += ' i="1"';
  if (element.underline) rPr += ' u="sng"';
  rPr += `><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${font}"/></a:rPr>`;

  return `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${shapeId}" name="TextBox ${shapeId}"/>
      <p:cNvSpPr txBox="1"/>
      <p:nvPr/>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:noFill/>
    </p:spPr>
    <p:txBody>
      <a:bodyPr anchor="${valign === "middle" ? "ctr" : valign === "bottom" ? "b" : "t"}"/>
      <a:lstStyle/>
      <a:p>
        <a:pPr algn="${align === "center" ? "ctr" : align === "right" ? "r" : "l"}"/>
        <a:r>${rPr}<a:t>${escapeXml(element.text)}</a:t></a:r>
      </a:p>
    </p:txBody>
  </p:sp>`;
}

// Generate bullet list element XML
function generateBulletListElementXml(
  element: BulletListElement,
  shapeId: number,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: PresentationTheme
): string {
  const fontSize = (element.fontSize || 18) * 100;
  const color = element.color ? normalizeColor(element.color) : normalizeColor(theme.textColor!);
  const bulletColor = element.bulletColor ? normalizeColor(element.bulletColor) : normalizeColor(theme.accentColor!);

  let paragraphs = "";
  for (const item of element.items) {
    paragraphs += `<a:p>
      <a:pPr marL="457200" indent="-457200">
        <a:buFont typeface="Arial"/>
        <a:buChar char="\u2022"/>
        <a:buClr><a:srgbClr val="${bulletColor}"/></a:buClr>
      </a:pPr>
      <a:r>
        <a:rPr lang="en-US" sz="${fontSize}">
          <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
          <a:latin typeface="${theme.bodyFont}"/>
        </a:rPr>
        <a:t>${escapeXml(item)}</a:t>
      </a:r>
    </a:p>`;
  }

  return `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${shapeId}" name="Content ${shapeId}"/>
      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
      <p:nvPr><p:ph idx="1"/></p:nvPr>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm>
    </p:spPr>
    <p:txBody>
      <a:bodyPr/>
      <a:lstStyle/>
      ${paragraphs}
    </p:txBody>
  </p:sp>`;
}

// Generate numbered list element XML
function generateNumberedListElementXml(
  element: NumberedListElement,
  shapeId: number,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: PresentationTheme
): string {
  const fontSize = (element.fontSize || 18) * 100;
  const color = element.color ? normalizeColor(element.color) : normalizeColor(theme.textColor!);
  const startNum = element.startNumber || 1;

  let paragraphs = "";
  for (let i = 0; i < element.items.length; i++) {
    paragraphs += `<a:p>
      <a:pPr marL="457200" indent="-457200">
        <a:buFont typeface="Arial"/>
        <a:buAutoNum type="arabicPeriod" startAt="${startNum}"/>
      </a:pPr>
      <a:r>
        <a:rPr lang="en-US" sz="${fontSize}">
          <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
          <a:latin typeface="${theme.bodyFont}"/>
        </a:rPr>
        <a:t>${escapeXml(element.items[i])}</a:t>
      </a:r>
    </a:p>`;
  }

  return `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${shapeId}" name="Content ${shapeId}"/>
      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
      <p:nvPr><p:ph idx="1"/></p:nvPr>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm>
    </p:spPr>
    <p:txBody>
      <a:bodyPr/>
      <a:lstStyle/>
      ${paragraphs}
    </p:txBody>
  </p:sp>`;
}

// Generate table element XML
function generateTableElementXml(
  element: TableElement,
  shapeId: number,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: PresentationTheme
): string {
  const colCount = element.headers?.length || element.rows[0]?.length || 1;
  const rowCount = (element.headers ? 1 : 0) + element.rows.length;
  const colWidth = Math.round(width / colCount);
  const rowHeight = Math.round(height / rowCount);

  const headerColor = element.headerColor ? normalizeColor(element.headerColor) : normalizeColor(theme.accentColor!);
  const headerTextColor = element.headerTextColor ? normalizeColor(element.headerTextColor) : "FFFFFF";
  const borderColor = element.borderColor ? normalizeColor(element.borderColor) : "CCCCCC";
  const altRowColor = element.alternateRowColor ? normalizeColor(element.alternateRowColor) : "F5F5F5";

  let gridCols = "";
  for (let i = 0; i < colCount; i++) {
    gridCols += `<a:gridCol w="${colWidth}"/>`;
  }

  let rowsXml = "";

  // Header row
  if (element.headers) {
    let cells = "";
    for (const header of element.headers) {
      cells += `<a:tc>
        <a:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="1400" b="1">
                <a:solidFill><a:srgbClr val="${headerTextColor}"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(header)}</a:t>
            </a:r>
          </a:p>
        </a:txBody>
        <a:tcPr>
          <a:solidFill><a:srgbClr val="${headerColor}"/></a:solidFill>
        </a:tcPr>
      </a:tc>`;
    }
    rowsXml += `<a:tr h="${rowHeight}">${cells}</a:tr>`;
  }

  // Data rows
  for (let rowIdx = 0; rowIdx < element.rows.length; rowIdx++) {
    const row = element.rows[rowIdx];
    const rowBg = rowIdx % 2 === 1 ? altRowColor : "FFFFFF";
    let cells = "";

    for (const cell of row) {
      cells += `<a:tc>
        <a:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1200">
                <a:solidFill><a:srgbClr val="${normalizeColor(theme.textColor!)}"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(cell)}</a:t>
            </a:r>
          </a:p>
        </a:txBody>
        <a:tcPr>
          <a:solidFill><a:srgbClr val="${rowBg}"/></a:solidFill>
        </a:tcPr>
      </a:tc>`;
    }
    rowsXml += `<a:tr h="${rowHeight}">${cells}</a:tr>`;
  }

  return `<p:graphicFrame>
    <p:nvGraphicFramePr>
      <p:cNvPr id="${shapeId}" name="Table ${shapeId}"/>
      <p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>
      <p:nvPr/>
    </p:nvGraphicFramePr>
    <p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></p:xfrm>
    <a:graphic>
      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
        <a:tbl>
          <a:tblPr firstRow="1" bandRow="1">
            <a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>
          </a:tblPr>
          <a:tblGrid>${gridCols}</a:tblGrid>
          ${rowsXml}
        </a:tbl>
      </a:graphicData>
    </a:graphic>
  </p:graphicFrame>`;
}

// Generate shape element XML
function generateShapeElementXml(
  element: ShapeElement,
  shapeId: number,
  x: number,
  y: number,
  width: number,
  height: number
): string {
  const shapeTypeMap: Record<string, string> = {
    rectangle: "rect",
    ellipse: "ellipse",
    triangle: "triangle",
    arrow: "rightArrow",
    line: "line",
  };

  const prstGeom = shapeTypeMap[element.shapeType] || "rect";
  const fill = element.fill ? normalizeColor(element.fill) : "4472C4";
  const stroke = element.stroke ? normalizeColor(element.stroke) : fill;
  const strokeWidth = (element.strokeWidth || 1) * 12700;

  let textXml = "";
  if (element.text) {
    const textColor = element.textColor ? normalizeColor(element.textColor) : "FFFFFF";
    textXml = `<p:txBody>
      <a:bodyPr anchor="ctr"/>
      <a:lstStyle/>
      <a:p>
        <a:pPr algn="ctr"/>
        <a:r>
          <a:rPr lang="en-US" sz="1400">
            <a:solidFill><a:srgbClr val="${textColor}"/></a:solidFill>
          </a:rPr>
          <a:t>${escapeXml(element.text)}</a:t>
        </a:r>
      </a:p>
    </p:txBody>`;
  }

  return `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${shapeId}" name="Shape ${shapeId}"/>
      <p:cNvSpPr/>
      <p:nvPr/>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm>
      <a:prstGeom prst="${prstGeom}"><a:avLst/></a:prstGeom>
      <a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>
      <a:ln w="${strokeWidth}"><a:solidFill><a:srgbClr val="${stroke}"/></a:solidFill></a:ln>
    </p:spPr>
    ${textXml}
  </p:sp>`;
}

// Generate image placeholder XML
function generateImagePlaceholderXml(
  element: ImageElement,
  shapeId: number,
  x: number,
  y: number,
  width: number,
  height: number
): string {
  return `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${shapeId}" name="Image Placeholder ${shapeId}"/>
      <p:cNvSpPr/>
      <p:nvPr/>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:solidFill><a:srgbClr val="E0E0E0"/></a:solidFill>
      <a:ln><a:solidFill><a:srgbClr val="CCCCCC"/></a:solidFill></a:ln>
    </p:spPr>
    <p:txBody>
      <a:bodyPr anchor="ctr"/>
      <a:lstStyle/>
      <a:p>
        <a:pPr algn="ctr"/>
        <a:r>
          <a:rPr lang="en-US" sz="1200" i="1">
            <a:solidFill><a:srgbClr val="666666"/></a:solidFill>
          </a:rPr>
          <a:t>[Image: ${escapeXml(element.path)}]</a:t>
        </a:r>
      </a:p>
    </p:txBody>
  </p:sp>`;
}

// Generate chart placeholder XML
function generateChartPlaceholderXml(
  element: ChartElement,
  shapeId: number,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: PresentationTheme
): string {
  const title = element.title || `${element.chartType.charAt(0).toUpperCase() + element.chartType.slice(1)} Chart`;

  return `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${shapeId}" name="Chart Placeholder ${shapeId}"/>
      <p:cNvSpPr/>
      <p:nvPr/>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:solidFill><a:srgbClr val="F5F5F5"/></a:solidFill>
      <a:ln><a:solidFill><a:srgbClr val="${normalizeColor(theme.accentColor!)}"/></a:solidFill></a:ln>
    </p:spPr>
    <p:txBody>
      <a:bodyPr anchor="ctr"/>
      <a:lstStyle/>
      <a:p>
        <a:pPr algn="ctr"/>
        <a:r>
          <a:rPr lang="en-US" sz="1400" b="1">
            <a:solidFill><a:srgbClr val="${normalizeColor(theme.textColor!)}"/></a:solidFill>
          </a:rPr>
          <a:t>${escapeXml(title)}</a:t>
        </a:r>
      </a:p>
      <a:p>
        <a:pPr algn="ctr"/>
        <a:r>
          <a:rPr lang="en-US" sz="1000" i="1">
            <a:solidFill><a:srgbClr val="666666"/></a:solidFill>
          </a:rPr>
          <a:t>[Chart placeholder - Labels: ${element.labels.join(", ")}]</a:t>
        </a:r>
      </a:p>
    </p:txBody>
  </p:sp>`;
}

// Generate slide rels XML
function generateSlideRelsXml(slideIndex: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>
</Relationships>`;
}

// Generate docProps/core.xml
function generateCorePropsXml(options: PresentationOptions): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  ${options.title ? `<dc:title>${escapeXml(options.title)}</dc:title>` : ""}
  ${options.author ? `<dc:creator>${escapeXml(options.author)}</dc:creator>` : "<dc:creator>Moltbot</dc:creator>"}
  ${options.subject ? `<dc:subject>${escapeXml(options.subject)}</dc:subject>` : ""}
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

// Generate docProps/app.xml
function generateAppPropsXml(options: PresentationOptions, slideCount: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Moltbot Presentation Generator</Application>
  <AppVersion>1.0</AppVersion>
  ${options.company ? `<Company>${escapeXml(options.company)}</Company>` : ""}
  <Slides>${slideCount}</Slides>
  <HiddenSlides>0</HiddenSlides>
</Properties>`;
}

// Generate presentation using pptxgenjs library if available, otherwise create raw OOXML
export async function generatePresentation(
  slides: Slide[],
  filename?: string,
  options: PresentationOptions = {}
): Promise<PresentationResult> {
  const filePath = filename
    ? isPathAllowed(filename)
      ? filename
      : join(tmpdir(), filename)
    : getTempPath();

  if (slides.length === 0) {
    return { success: false, error: "No slides provided" };
  }

  try {
    await mkdir(dirname(filePath), { recursive: true });

    // Try to use pptxgenjs library if available
    try {
      const PptxGenJS = await import("pptxgenjs");
      return await generateWithPptxGenJs(slides, filePath, options, PptxGenJS.default);
    } catch {
      // Fallback: generate raw OOXML and create the ZIP manually
      console.log("[Presentations] pptxgenjs library not available, using raw OOXML generation");
      return await generateRawPptx(slides, filePath, options);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Generate using pptxgenjs library
async function generateWithPptxGenJs(
  slides: Slide[],
  filePath: string,
  options: PresentationOptions,
  PptxGenJS: typeof import("pptxgenjs").default
): Promise<PresentationResult> {
  const pptx = new PptxGenJS();

  // Set presentation properties
  if (options.title) pptx.title = options.title;
  if (options.author) pptx.author = options.author;
  if (options.subject) pptx.subject = options.subject;
  if (options.company) pptx.company = options.company;

  // Set layout
  if (options.layout === "LAYOUT_4x3") {
    pptx.layout = "LAYOUT_4x3";
  } else {
    pptx.layout = "LAYOUT_16x9";
  }

  const theme = { ...DEFAULT_THEME, ...options.theme };

  for (const slideData of slides) {
    const slide = pptx.addSlide();

    // Background
    if (slideData.backgroundColor) {
      slide.background = { color: slideData.backgroundColor.replace("#", "") };
    }

    // Title
    if (slideData.title) {
      const titleY = slideData.layout === "title" ? "40%" : "5%";
      const fontSize = slideData.layout === "title" ? 44 : 32;

      slide.addText(slideData.title, {
        x: "5%",
        y: titleY,
        w: "90%",
        h: "15%",
        fontSize,
        bold: true,
        color: theme.titleColor?.replace("#", ""),
        fontFace: theme.titleFont,
        align: "center",
        valign: "middle",
      });
    }

    // Subtitle
    if (slideData.subtitle && slideData.layout === "title") {
      slide.addText(slideData.subtitle, {
        x: "10%",
        y: "55%",
        w: "80%",
        h: "15%",
        fontSize: 24,
        color: theme.textColor?.replace("#", ""),
        fontFace: theme.bodyFont,
        align: "center",
        valign: "top",
      });
    }

    // Content elements
    if (slideData.content) {
      for (const element of slideData.content) {
        addContentElementToPptx(slide, element, theme);
      }
    }

    // Speaker notes
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  }

  await pptx.writeFile({ fileName: filePath });
  return { success: true, filePath };
}

// Add content element to pptx slide
function addContentElementToPptx(
  slide: ReturnType<import("pptxgenjs").default["addSlide"]>,
  element: SlideContent,
  theme: PresentationTheme
): void {
  const x = element.x !== undefined ? `${element.x}%` : "5%";
  const y = element.y !== undefined ? `${element.y}%` : "25%";
  const w = element.width !== undefined ? `${element.width}%` : "90%";
  const h = element.height !== undefined ? `${element.height}%` : "65%";

  switch (element.type) {
    case "text":
      slide.addText(element.text, {
        x,
        y,
        w,
        h,
        fontSize: element.fontSize || 18,
        fontFace: element.fontFace || theme.bodyFont,
        color: element.color?.replace("#", "") || theme.textColor?.replace("#", ""),
        bold: element.bold,
        italic: element.italic,
        underline: element.underline ? { style: "sng" } : undefined,
        align: element.align,
        valign: element.valign,
      });
      break;

    case "bullet-list":
      slide.addText(
        element.items.map((item) => ({
          text: item,
          options: { bullet: { type: "bullet" } },
        })),
        {
          x,
          y,
          w,
          h,
          fontSize: element.fontSize || 18,
          color: element.color?.replace("#", "") || theme.textColor?.replace("#", ""),
        }
      );
      break;

    case "numbered-list":
      slide.addText(
        element.items.map((item, idx) => ({
          text: item,
          options: { bullet: { type: "number", numberStartAt: element.startNumber || 1 } },
        })),
        {
          x,
          y,
          w,
          h,
          fontSize: element.fontSize || 18,
          color: element.color?.replace("#", "") || theme.textColor?.replace("#", ""),
        }
      );
      break;

    case "table":
      const tableData: string[][] = [];
      if (element.headers) {
        tableData.push(element.headers);
      }
      tableData.push(...element.rows);

      slide.addTable(tableData, {
        x,
        y,
        w,
        h,
        border: { color: element.borderColor?.replace("#", "") || "CCCCCC" },
        fill: { color: "FFFFFF" },
        fontFace: theme.bodyFont,
        fontSize: 12,
      });
      break;

    case "shape":
      const shapeTypeMap: Record<string, "rect" | "ellipse" | "triangle" | "rightArrow" | "line"> = {
        rectangle: "rect",
        ellipse: "ellipse",
        triangle: "triangle",
        arrow: "rightArrow",
        line: "line",
      };

      slide.addShape(shapeTypeMap[element.shapeType] || "rect", {
        x,
        y,
        w,
        h,
        fill: { color: element.fill?.replace("#", "") || theme.accentColor?.replace("#", "") },
        line: {
          color: element.stroke?.replace("#", "") || element.fill?.replace("#", "") || theme.accentColor?.replace("#", ""),
          width: element.strokeWidth || 1,
        },
      });

      if (element.text) {
        slide.addText(element.text, {
          x,
          y,
          w,
          h,
          align: "center",
          valign: "middle",
          color: element.textColor?.replace("#", "") || "FFFFFF",
        });
      }
      break;

    case "image":
      // For actual implementation, would need to read the image file
      slide.addText(`[Image: ${element.path}]`, {
        x,
        y,
        w,
        h,
        align: "center",
        valign: "middle",
        italic: true,
        color: "666666",
        fill: { color: "E0E0E0" },
      });
      break;

    case "chart":
      // For actual implementation, would need to create chart objects
      slide.addText(`[${element.chartType} Chart: ${element.title || "Data"}]`, {
        x,
        y,
        w,
        h,
        align: "center",
        valign: "middle",
        italic: true,
        color: "666666",
        fill: { color: "F5F5F5" },
      });
      break;
  }
}

// Generate raw OOXML and create ZIP
async function generateRawPptx(
  slides: Slide[],
  filePath: string,
  options: PresentationOptions
): Promise<PresentationResult> {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  const theme = { ...DEFAULT_THEME, ...finalOptions.theme };

  try {
    // Try to use archiver for ZIP creation
    const archiver = await import("archiver");
    const fs = await import("fs");

    const output = fs.createWriteStream(filePath);
    const archive = archiver.default("zip", { zlib: { level: 9 } });

    return new Promise((resolve) => {
      output.on("close", () => {
        resolve({ success: true, filePath });
      });

      archive.on("error", (err: Error) => {
        resolve({ success: false, error: err.message });
      });

      archive.pipe(output);

      // Add files to archive
      archive.append(generateContentTypesXml(slides.length), { name: "[Content_Types].xml" });
      archive.append(generateRootRelsXml(), { name: "_rels/.rels" });
      archive.append(generatePresentationXml(slides.length, finalOptions), { name: "ppt/presentation.xml" });
      archive.append(generatePresentationRelsXml(slides.length), { name: "ppt/_rels/presentation.xml.rels" });
      archive.append(generateThemeXml(theme), { name: "ppt/theme/theme1.xml" });
      archive.append(generateSlideMasterXml(theme, finalOptions.layout || "LAYOUT_16x9"), { name: "ppt/slideMasters/slideMaster1.xml" });
      archive.append(generateSlideMasterRelsXml(), { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels" });
      archive.append(generateSlideLayoutXml("title"), { name: "ppt/slideLayouts/slideLayout1.xml" });
      archive.append(generateSlideLayoutXml("content"), { name: "ppt/slideLayouts/slideLayout2.xml" });
      archive.append(generateSlideLayoutRelsXml(), { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels" });
      archive.append(generateSlideLayoutRelsXml(), { name: "ppt/slideLayouts/_rels/slideLayout2.xml.rels" });

      // Add slides
      for (let i = 0; i < slides.length; i++) {
        archive.append(generateSlideXml(slides[i], i + 1, finalOptions), { name: `ppt/slides/slide${i + 1}.xml` });
        archive.append(generateSlideRelsXml(i + 1), { name: `ppt/slides/_rels/slide${i + 1}.xml.rels` });
      }

      // Add document properties
      archive.append(generateCorePropsXml(finalOptions), { name: "docProps/core.xml" });
      archive.append(generateAppPropsXml(finalOptions, slides.length), { name: "docProps/app.xml" });

      archive.finalize();
    });
  } catch {
    // Ultimate fallback: save slide content as text
    const txtPath = filePath.replace(".pptx", ".txt");
    let content = `Presentation: ${options.title || "Untitled"}\n${"=".repeat(50)}\n\n`;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      content += `--- Slide ${i + 1} ---\n`;
      if (slide.title) content += `Title: ${slide.title}\n`;
      if (slide.subtitle) content += `Subtitle: ${slide.subtitle}\n`;
      if (slide.content) {
        content += "Content:\n";
        for (const element of slide.content) {
          if ("text" in element && element.type === "text") content += `  ${element.text}\n`;
          if ("items" in element) content += element.items.map((item: string) => `  - ${item}`).join("\n") + "\n";
        }
      }
      content += "\n";
    }

    await writeFile(txtPath, content, "utf-8");
    return { success: true, filePath: txtPath };
  }
}

// Quick presentation from outline
export async function quickPresentation(
  title: string,
  outline: Array<{ title: string; bullets?: string[] }>,
  filename?: string,
  options?: PresentationOptions
): Promise<PresentationResult> {
  const slides: Slide[] = [
    {
      layout: "title",
      title,
      subtitle: options?.author ? `By ${options.author}` : undefined,
    },
  ];

  for (const section of outline) {
    slides.push({
      layout: "title-content",
      title: section.title,
      content: section.bullets
        ? [{ type: "bullet-list", items: section.bullets }]
        : undefined,
    });
  }

  return generatePresentation(slides, filename, options);
}

// Main function for tool use
export async function generatePPTX(
  slides: Slide[],
  filename: string,
  options?: PresentationOptions
): Promise<PresentationResult> {
  return generatePresentation(slides, filename, options);
}

export default {
  generatePresentation,
  generatePPTX,
  quickPresentation,
};
