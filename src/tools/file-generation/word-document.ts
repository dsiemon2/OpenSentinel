import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { isPathAllowed } from "../../utils/paths";

export interface WordDocumentOptions {
  title?: string;
  author?: string;
  subject?: string;
  description?: string;
  keywords?: string[];
  orientation?: "portrait" | "landscape";
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface WordDocumentResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export type ParagraphAlignment = "left" | "center" | "right" | "justify";
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  size?: number;
  font?: string;
  highlight?: string;
}

export interface Paragraph {
  type: "paragraph";
  content: string | TextRun[];
  alignment?: ParagraphAlignment;
  spacing?: {
    before?: number;
    after?: number;
    line?: number;
  };
  indent?: {
    left?: number;
    right?: number;
    firstLine?: number;
  };
}

export interface Heading {
  type: "heading";
  level: HeadingLevel;
  text: string;
  alignment?: ParagraphAlignment;
}

export interface BulletList {
  type: "bullet-list";
  items: string[];
  level?: number;
}

export interface NumberedList {
  type: "numbered-list";
  items: string[];
  start?: number;
}

export interface TableCell {
  content: string;
  bold?: boolean;
  alignment?: ParagraphAlignment;
  backgroundColor?: string;
  colSpan?: number;
  rowSpan?: number;
}

export interface Table {
  type: "table";
  headers?: TableCell[] | string[];
  rows: (TableCell[] | string[])[];
  widths?: number[];
}

export interface Image {
  type: "image";
  path: string;
  width?: number;
  height?: number;
  alignment?: ParagraphAlignment;
  caption?: string;
}

export interface PageBreak {
  type: "page-break";
}

export interface HorizontalRule {
  type: "horizontal-rule";
}

export interface TableOfContents {
  type: "toc";
  title?: string;
  maxLevel?: HeadingLevel;
}

export type DocumentElement =
  | Paragraph
  | Heading
  | BulletList
  | NumberedList
  | Table
  | Image
  | PageBreak
  | HorizontalRule
  | TableOfContents;

// Default options
const DEFAULT_OPTIONS: WordDocumentOptions = {
  orientation: "portrait",
  margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch in twips
};

// Generate temp file path
function getTempPath(): string {
  const id = randomBytes(8).toString("hex");
  return join(tmpdir(), `moltbot-doc-${id}.docx`);
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

// Convert twips to EMUs (English Metric Units)
function twipsToEmu(twips: number): number {
  return twips * 635;
}

// Generate document.xml content
function generateDocumentXml(
  elements: DocumentElement[],
  options: WordDocumentOptions
): string {
  const orientation = options.orientation || "portrait";
  const margins = options.margins || DEFAULT_OPTIONS.margins!;

  let bodyContent = "";

  for (const element of elements) {
    bodyContent += generateElementXml(element);
  }

  // Section properties for page setup
  const sectionProps = `
    <w:sectPr>
      <w:pgSz w:w="${orientation === "portrait" ? "12240" : "15840"}" w:h="${orientation === "portrait" ? "15840" : "12240"}" ${orientation === "landscape" ? 'w:orient="landscape"' : ""}/>
      <w:pgMar w:top="${margins.top}" w:right="${margins.right}" w:bottom="${margins.bottom}" w:left="${margins.left}" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  `;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${bodyContent}
    ${sectionProps}
  </w:body>
</w:document>`;
}

// Generate XML for a single element
function generateElementXml(element: DocumentElement): string {
  switch (element.type) {
    case "paragraph":
      return generateParagraphXml(element);
    case "heading":
      return generateHeadingXml(element);
    case "bullet-list":
      return generateBulletListXml(element);
    case "numbered-list":
      return generateNumberedListXml(element);
    case "table":
      return generateTableXml(element);
    case "page-break":
      return generatePageBreakXml();
    case "horizontal-rule":
      return generateHorizontalRuleXml();
    case "toc":
      return generateTocXml(element);
    case "image":
      return generateImagePlaceholderXml(element);
    default:
      return "";
  }
}

// Generate paragraph XML
function generateParagraphXml(paragraph: Paragraph): string {
  const alignment = getAlignmentValue(paragraph.alignment);
  const spacing = paragraph.spacing;
  const indent = paragraph.indent;

  let pPr = "<w:pPr>";
  if (alignment) {
    pPr += `<w:jc w:val="${alignment}"/>`;
  }
  if (spacing) {
    pPr += `<w:spacing ${spacing.before ? `w:before="${spacing.before}"` : ""} ${spacing.after ? `w:after="${spacing.after}"` : ""} ${spacing.line ? `w:line="${spacing.line}"` : ""}/>`;
  }
  if (indent) {
    pPr += `<w:ind ${indent.left ? `w:left="${indent.left}"` : ""} ${indent.right ? `w:right="${indent.right}"` : ""} ${indent.firstLine ? `w:firstLine="${indent.firstLine}"` : ""}/>`;
  }
  pPr += "</w:pPr>";

  let runs = "";
  if (typeof paragraph.content === "string") {
    runs = `<w:r><w:t xml:space="preserve">${escapeXml(paragraph.content)}</w:t></w:r>`;
  } else {
    for (const run of paragraph.content) {
      runs += generateTextRunXml(run);
    }
  }

  return `<w:p>${pPr}${runs}</w:p>`;
}

// Generate text run XML
function generateTextRunXml(run: TextRun): string {
  let rPr = "<w:rPr>";

  if (run.bold) rPr += "<w:b/>";
  if (run.italic) rPr += "<w:i/>";
  if (run.underline) rPr += '<w:u w:val="single"/>';
  if (run.strike) rPr += "<w:strike/>";
  if (run.color) rPr += `<w:color w:val="${run.color.replace("#", "")}"/>`;
  if (run.size) rPr += `<w:sz w:val="${run.size * 2}"/>`;
  if (run.font) rPr += `<w:rFonts w:ascii="${run.font}" w:hAnsi="${run.font}"/>`;
  if (run.highlight) rPr += `<w:highlight w:val="${run.highlight}"/>`;

  rPr += "</w:rPr>";

  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`;
}

// Generate heading XML
function generateHeadingXml(heading: Heading): string {
  const styleId = `Heading${heading.level}`;
  const alignment = getAlignmentValue(heading.alignment);

  let pPr = `<w:pPr><w:pStyle w:val="${styleId}"/>`;
  if (alignment) {
    pPr += `<w:jc w:val="${alignment}"/>`;
  }
  pPr += "</w:pPr>";

  return `<w:p>${pPr}<w:r><w:t>${escapeXml(heading.text)}</w:t></w:r></w:p>`;
}

// Generate bullet list XML
function generateBulletListXml(list: BulletList): string {
  const level = list.level || 0;
  let xml = "";

  for (const item of list.items) {
    xml += `<w:p>
      <w:pPr>
        <w:pStyle w:val="ListParagraph"/>
        <w:numPr>
          <w:ilvl w:val="${level}"/>
          <w:numId w:val="1"/>
        </w:numPr>
      </w:pPr>
      <w:r><w:t>${escapeXml(item)}</w:t></w:r>
    </w:p>`;
  }

  return xml;
}

// Generate numbered list XML
function generateNumberedListXml(list: NumberedList): string {
  let xml = "";

  for (const item of list.items) {
    xml += `<w:p>
      <w:pPr>
        <w:pStyle w:val="ListParagraph"/>
        <w:numPr>
          <w:ilvl w:val="0"/>
          <w:numId w:val="2"/>
        </w:numPr>
      </w:pPr>
      <w:r><w:t>${escapeXml(item)}</w:t></w:r>
    </w:p>`;
  }

  return xml;
}

// Generate table XML
function generateTableXml(table: Table): string {
  const columnCount = table.headers?.length || table.rows[0]?.length || 1;
  const defaultWidth = Math.floor(9000 / columnCount);

  let xml = `<w:tbl>
    <w:tblPr>
      <w:tblStyle w:val="TableGrid"/>
      <w:tblW w:w="0" w:type="auto"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>`;

  for (let i = 0; i < columnCount; i++) {
    const width = table.widths?.[i] || defaultWidth;
    xml += `<w:gridCol w:w="${width}"/>`;
  }
  xml += "</w:tblGrid>";

  // Header row
  if (table.headers) {
    xml += "<w:tr>";
    for (const cell of table.headers) {
      xml += generateTableCellXml(cell, true);
    }
    xml += "</w:tr>";
  }

  // Data rows
  for (const row of table.rows) {
    xml += "<w:tr>";
    for (const cell of row) {
      xml += generateTableCellXml(cell, false);
    }
    xml += "</w:tr>";
  }

  xml += "</w:tbl>";
  return xml;
}

// Generate table cell XML
function generateTableCellXml(
  cell: TableCell | string,
  isHeader: boolean
): string {
  const cellData: TableCell =
    typeof cell === "string" ? { content: cell } : cell;

  let tcPr = "<w:tcPr>";
  if (cellData.backgroundColor) {
    tcPr += `<w:shd w:val="clear" w:color="auto" w:fill="${cellData.backgroundColor.replace("#", "")}"/>`;
  }
  if (cellData.colSpan && cellData.colSpan > 1) {
    tcPr += `<w:gridSpan w:val="${cellData.colSpan}"/>`;
  }
  tcPr += "</w:tcPr>";

  const bold = isHeader || cellData.bold;
  const alignment = getAlignmentValue(cellData.alignment || (isHeader ? "center" : "left"));

  return `<w:tc>
    ${tcPr}
    <w:p>
      <w:pPr>${alignment ? `<w:jc w:val="${alignment}"/>` : ""}</w:pPr>
      <w:r>
        ${bold ? "<w:rPr><w:b/></w:rPr>" : ""}
        <w:t>${escapeXml(cellData.content)}</w:t>
      </w:r>
    </w:p>
  </w:tc>`;
}

// Generate page break XML
function generatePageBreakXml(): string {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

// Generate horizontal rule XML
function generateHorizontalRuleXml(): string {
  return `<w:p>
    <w:pPr>
      <w:pBdr>
        <w:bottom w:val="single" w:sz="12" w:space="1" w:color="auto"/>
      </w:pBdr>
    </w:pPr>
  </w:p>`;
}

// Generate table of contents placeholder XML
function generateTocXml(toc: TableOfContents): string {
  const title = toc.title || "Table of Contents";
  return `<w:p>
    <w:pPr><w:pStyle w:val="TOCHeading"/></w:pPr>
    <w:r><w:t>${escapeXml(title)}</w:t></w:r>
  </w:p>
  <w:p>
    <w:r>
      <w:fldChar w:fldCharType="begin"/>
    </w:r>
    <w:r>
      <w:instrText xml:space="preserve"> TOC \\o "1-${toc.maxLevel || 3}" \\h \\z \\u </w:instrText>
    </w:r>
    <w:r>
      <w:fldChar w:fldCharType="separate"/>
    </w:r>
    <w:r>
      <w:t>[Table of Contents - Update field to populate]</w:t>
    </w:r>
    <w:r>
      <w:fldChar w:fldCharType="end"/>
    </w:r>
  </w:p>`;
}

// Generate image placeholder XML
function generateImagePlaceholderXml(image: Image): string {
  const alignment = getAlignmentValue(image.alignment || "center");
  const caption = image.caption || `[Image: ${image.path}]`;

  return `<w:p>
    <w:pPr>${alignment ? `<w:jc w:val="${alignment}"/>` : ""}</w:pPr>
    <w:r>
      <w:rPr><w:i/></w:rPr>
      <w:t>${escapeXml(caption)}</w:t>
    </w:r>
  </w:p>`;
}

// Get alignment value for XML
function getAlignmentValue(
  alignment?: ParagraphAlignment
): string | null {
  switch (alignment) {
    case "left":
      return "left";
    case "center":
      return "center";
    case "right":
      return "right";
    case "justify":
      return "both";
    default:
      return null;
  }
}

// Generate styles.xml
function generateStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160" w:line="259" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:pPr><w:spacing w:before="240" w:after="0"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/><w:b/><w:color w:val="2F5496"/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:pPr><w:spacing w:before="200" w:after="0"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/><w:b/><w:color w:val="2F5496"/><w:sz w:val="26"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:pPr><w:spacing w:before="160" w:after="0"/><w:outlineLvl w:val="2"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/><w:b/><w:color w:val="1F3763"/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="heading 4"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:pPr><w:spacing w:before="120" w:after="0"/><w:outlineLvl w:val="3"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/><w:i/><w:color w:val="2F5496"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading5">
    <w:name w:val="heading 5"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:pPr><w:spacing w:before="80" w:after="0"/><w:outlineLvl w:val="4"/></w:pPr>
    <w:rPr><w:color w:val="2F5496"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading6">
    <w:name w:val="heading 6"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:pPr><w:spacing w:before="40" w:after="0"/><w:outlineLvl w:val="5"/></w:pPr>
    <w:rPr><w:color w:val="1F3763"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:left="720"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TOCHeading">
    <w:name w:val="TOC Heading"/>
    <w:basedOn w:val="Heading1"/>
    <w:next w:val="Normal"/>
    <w:pPr><w:outlineLvl w:val="9"/></w:pPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      </w:tblBorders>
    </w:tblPr>
  </w:style>
</w:styles>`;
}

// Generate numbering.xml for lists
function generateNumberingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <!-- Bullet list definition -->
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val=""/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>
    </w:lvl>
    <w:lvl w:ilvl="1">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="o"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:hint="default"/></w:rPr>
    </w:lvl>
    <w:lvl w:ilvl="2">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val=""/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="2160" w:hanging="360"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Wingdings" w:hAnsi="Wingdings" w:hint="default"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <!-- Numbered list definition -->
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="1">
      <w:start w:val="1"/>
      <w:numFmt w:val="lowerLetter"/>
      <w:lvlText w:val="%2."/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="2">
      <w:start w:val="1"/>
      <w:numFmt w:val="lowerRoman"/>
      <w:lvlText w:val="%3."/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="2160" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;
}

// Generate [Content_Types].xml
function generateContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

// Generate _rels/.rels
function generateRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

// Generate word/_rels/document.xml.rels
function generateDocumentRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;
}

// Generate docProps/core.xml
function generateCorePropsXml(options: WordDocumentOptions): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  ${options.title ? `<dc:title>${escapeXml(options.title)}</dc:title>` : ""}
  ${options.author ? `<dc:creator>${escapeXml(options.author)}</dc:creator>` : "<dc:creator>Moltbot</dc:creator>"}
  ${options.subject ? `<dc:subject>${escapeXml(options.subject)}</dc:subject>` : ""}
  ${options.description ? `<dc:description>${escapeXml(options.description)}</dc:description>` : ""}
  ${options.keywords ? `<cp:keywords>${escapeXml(options.keywords.join(", "))}</cp:keywords>` : ""}
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

// Generate docProps/app.xml
function generateAppPropsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Moltbot Document Generator</Application>
  <AppVersion>1.0</AppVersion>
</Properties>`;
}

// Generate Word document using docx library if available, otherwise create raw OOXML
export async function generateWordDocument(
  elements: DocumentElement[],
  filename?: string,
  options: WordDocumentOptions = {}
): Promise<WordDocumentResult> {
  const filePath = filename
    ? isPathAllowed(filename)
      ? filename
      : join(tmpdir(), filename)
    : getTempPath();

  try {
    await mkdir(dirname(filePath), { recursive: true });

    // Try to use docx library if available
    try {
      const docx = await import("docx");
      return await generateWithDocxLibrary(elements, filePath, options, docx);
    } catch {
      // Fallback: generate raw OOXML and create the ZIP manually
      console.log("[WordDocument] docx library not available, using raw OOXML generation");
      return await generateRawDocx(elements, filePath, options);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Generate using docx library
async function generateWithDocxLibrary(
  elements: DocumentElement[],
  filePath: string,
  options: WordDocumentOptions,
  docx: typeof import("docx")
): Promise<WordDocumentResult> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, PageBreak } = docx;

  const children: (
    | InstanceType<typeof Paragraph>
    | InstanceType<typeof Table>
  )[] = [];

  for (const element of elements) {
    switch (element.type) {
      case "paragraph": {
        const runs: InstanceType<typeof TextRun>[] = [];
        if (typeof element.content === "string") {
          runs.push(new TextRun(element.content));
        } else {
          for (const run of element.content) {
            runs.push(
              new TextRun({
                text: run.text,
                bold: run.bold,
                italics: run.italic,
                underline: run.underline ? {} : undefined,
                strike: run.strike,
                color: run.color?.replace("#", ""),
                size: run.size ? run.size * 2 : undefined,
                font: run.font,
                highlight: run.highlight as "yellow" | "green" | "cyan" | "magenta" | "blue" | "red" | "darkBlue" | "darkCyan" | "darkGreen" | "darkMagenta" | "darkRed" | "darkYellow" | "darkGray" | "lightGray" | "black" | undefined,
              })
            );
          }
        }
        children.push(
          new Paragraph({
            children: runs,
            alignment: getDocxAlignment(element.alignment, AlignmentType),
            spacing: element.spacing
              ? {
                  before: element.spacing.before,
                  after: element.spacing.after,
                  line: element.spacing.line,
                }
              : undefined,
            indent: element.indent
              ? {
                  left: element.indent.left,
                  right: element.indent.right,
                  firstLine: element.indent.firstLine,
                }
              : undefined,
          })
        );
        break;
      }
      case "heading": {
        const headingLevelMap: Record<HeadingLevel, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4,
          5: HeadingLevel.HEADING_5,
          6: HeadingLevel.HEADING_6,
        };
        children.push(
          new Paragraph({
            text: element.text,
            heading: headingLevelMap[element.level],
            alignment: getDocxAlignment(element.alignment, AlignmentType),
          })
        );
        break;
      }
      case "bullet-list": {
        for (const item of element.items) {
          children.push(
            new Paragraph({
              text: item,
              bullet: { level: element.level || 0 },
            })
          );
        }
        break;
      }
      case "numbered-list": {
        for (let i = 0; i < element.items.length; i++) {
          children.push(
            new Paragraph({
              text: element.items[i],
              numbering: {
                reference: "default-numbering",
                level: 0,
              },
            })
          );
        }
        break;
      }
      case "table": {
        const rows: InstanceType<typeof TableRow>[] = [];

        if (element.headers) {
          rows.push(
            new TableRow({
              children: element.headers.map((cell) => {
                const cellData = typeof cell === "string" ? { content: cell } : cell;
                return new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: cellData.content, bold: true }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                  shading: cellData.backgroundColor
                    ? { fill: cellData.backgroundColor.replace("#", "") }
                    : { fill: "E0E0E0" },
                });
              }),
              tableHeader: true,
            })
          );
        }

        for (const row of element.rows) {
          rows.push(
            new TableRow({
              children: row.map((cell) => {
                const cellData = typeof cell === "string" ? { content: cell } : cell;
                return new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cellData.content,
                          bold: cellData.bold,
                        }),
                      ],
                      alignment: getDocxAlignment(cellData.alignment, AlignmentType),
                    }),
                  ],
                  shading: cellData.backgroundColor
                    ? { fill: cellData.backgroundColor.replace("#", "") }
                    : undefined,
                  columnSpan: cellData.colSpan,
                  rowSpan: cellData.rowSpan,
                });
              }),
            })
          );
        }

        children.push(
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        break;
      }
      case "page-break": {
        children.push(
          new Paragraph({
            children: [new PageBreak()],
          })
        );
        break;
      }
      case "horizontal-rule": {
        children.push(
          new Paragraph({
            border: {
              bottom: {
                color: "auto",
                space: 1,
                style: BorderStyle.SINGLE,
                size: 12,
              },
            },
          })
        );
        break;
      }
      case "toc": {
        children.push(
          new Paragraph({
            text: element.title || "Table of Contents",
            heading: HeadingLevel.HEADING_1,
          })
        );
        children.push(
          new Paragraph({
            text: "[Update field to generate Table of Contents]",
          })
        );
        break;
      }
      case "image": {
        children.push(
          new Paragraph({
            text: element.caption || `[Image: ${element.path}]`,
            alignment: getDocxAlignment(element.alignment, AlignmentType),
          })
        );
        break;
      }
    }
  }

  const doc = new Document({
    title: options.title,
    creator: options.author || "Moltbot",
    subject: options.subject,
    description: options.description,
    keywords: options.keywords?.join(", "),
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation:
                options.orientation === "landscape"
                  ? docx.PageOrientation.LANDSCAPE
                  : docx.PageOrientation.PORTRAIT,
            },
            margin: options.margins
              ? {
                  top: options.margins.top,
                  right: options.margins.right,
                  bottom: options.margins.bottom,
                  left: options.margins.left,
                }
              : undefined,
          },
        },
        children,
      },
    ],
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: docx.LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
  });

  const buffer = await Packer.toBuffer(doc);
  await writeFile(filePath, buffer);

  return { success: true, filePath };
}

// Get docx AlignmentType from string
function getDocxAlignment(
  alignment: ParagraphAlignment | undefined,
  AlignmentType: { LEFT: unknown; CENTER: unknown; RIGHT: unknown; JUSTIFIED: unknown }
): unknown {
  switch (alignment) {
    case "left":
      return AlignmentType.LEFT;
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    default:
      return undefined;
  }
}

// Generate raw OOXML and create ZIP
async function generateRawDocx(
  elements: DocumentElement[],
  filePath: string,
  options: WordDocumentOptions
): Promise<WordDocumentResult> {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };

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
      archive.append(generateContentTypesXml(), { name: "[Content_Types].xml" });
      archive.append(generateRootRelsXml(), { name: "_rels/.rels" });
      archive.append(generateDocumentXml(elements, finalOptions), { name: "word/document.xml" });
      archive.append(generateStylesXml(), { name: "word/styles.xml" });
      archive.append(generateNumberingXml(), { name: "word/numbering.xml" });
      archive.append(generateDocumentRelsXml(), { name: "word/_rels/document.xml.rels" });
      archive.append(generateCorePropsXml(finalOptions), { name: "docProps/core.xml" });
      archive.append(generateAppPropsXml(), { name: "docProps/app.xml" });

      archive.finalize();
    });
  } catch {
    // Ultimate fallback: save as XML for manual processing
    const xmlPath = filePath.replace(".docx", ".xml");
    const documentXml = generateDocumentXml(elements, finalOptions);
    await writeFile(xmlPath, documentXml, "utf-8");

    return {
      success: true,
      filePath: xmlPath,
    };
  }
}

// Generate Word document from markdown
export async function generateWordFromMarkdown(
  markdown: string,
  filename?: string,
  options?: WordDocumentOptions
): Promise<WordDocumentResult> {
  const elements = parseMarkdownToElements(markdown);
  return generateWordDocument(elements, filename, options);
}

// Simple markdown parser to document elements
function parseMarkdownToElements(markdown: string): DocumentElement[] {
  const elements: DocumentElement[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      elements.push({
        type: "heading",
        level: headerMatch[1].length as HeadingLevel,
        text: headerMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      elements.push({ type: "horizontal-rule" });
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s+/, "").trim());
        i++;
      }
      elements.push({ type: "bullet-list", items });
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, "").trim());
        i++;
      }
      elements.push({ type: "numbered-list", items });
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph (collect consecutive non-empty lines)
    let paragraphText = "";
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}|[-*+]|\d+\.)\s+/.test(lines[i])) {
      paragraphText += (paragraphText ? " " : "") + lines[i].trim();
      i++;
    }

    if (paragraphText) {
      // Parse inline formatting
      const runs = parseInlineFormatting(paragraphText);
      elements.push({
        type: "paragraph",
        content: runs.length === 1 && !runs[0].bold && !runs[0].italic ? paragraphText : runs,
      });
    }
  }

  return elements;
}

// Parse inline markdown formatting
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Bold + Italic
    const boldItalicMatch = remaining.match(/^\*\*\*(.+?)\*\*\*/);
    if (boldItalicMatch) {
      runs.push({ text: boldItalicMatch[1], bold: true, italic: true });
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      runs.push({ text: boldMatch[1], bold: true });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      runs.push({ text: italicMatch[1], italic: true });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Strikethrough
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      runs.push({ text: strikeMatch[1], strike: true });
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Code (treated as monospace)
    const codeMatch = remaining.match(/^`(.+?)`/);
    if (codeMatch) {
      runs.push({ text: codeMatch[1], font: "Courier New" });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Regular text until next formatting
    const nextFormat = remaining.search(/(\*\*\*|\*\*|\*|~~|`)/);
    if (nextFormat === -1) {
      runs.push({ text: remaining });
      break;
    } else if (nextFormat === 0) {
      // Unmatched formatting character, treat as regular text
      runs.push({ text: remaining[0] });
      remaining = remaining.slice(1);
    } else {
      runs.push({ text: remaining.slice(0, nextFormat) });
      remaining = remaining.slice(nextFormat);
    }
  }

  return runs;
}

// Main function for tool use
export async function generateWord(
  content: string | DocumentElement[],
  filename: string,
  options?: WordDocumentOptions & { contentType?: "markdown" | "elements" }
): Promise<WordDocumentResult> {
  const contentType = options?.contentType || "markdown";

  if (contentType === "elements" || Array.isArray(content)) {
    return generateWordDocument(content as DocumentElement[], filename, options);
  }

  return generateWordFromMarkdown(content as string, filename, options);
}

export default {
  generateWord,
  generateWordDocument,
  generateWordFromMarkdown,
};
