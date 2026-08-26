import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  PageBreak, Header, Footer, PageNumber, VerticalAlign, ImageRun,
} from "docx";
import { LOGO_PNG_BASE64 } from "./branding";

const NAVY = "1F3864";
const BLUE = "2E75B6";
const GREY = "595959";
const FONT = "Arial";

export type ScheduleKey = "bucket" | "ssms" | "e_examiner" | "ledger" | "custom";

export const SCHEDULE_LABELS: Record<ScheduleKey, string> = {
  bucket: "SUIBING Bucket",
  ssms: "Suibing School Management Software (SSMS)",
  e_examiner: "E-Examiner Contract",
  ledger: "SuibingLedger",
  custom: "Custom / Bespoke Development Services",
};

export type ContractRequest = {
  clientName: string;
  clientAddress: string;
  contactPerson: string;
  contactEmail: string;
  schedules: ScheduleKey[];
  effectiveDate: string; // display string
  subscriptionFee?: string; // for Bucket
  subscriptionPeriod?: string; // for Bucket, e.g. "3 months"
};

function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 32, color: NAVY, font: FONT })],
  });
}
function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: BLUE, font: FONT })],
  });
}
function h3(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 90 },
    children: [new TextRun({ text, bold: true, size: 22, font: FONT })],
  });
}
function body(text: string) {
  return new Paragraph({
    spacing: { after: 140, line: 300 },
    children: [new TextRun({ text, size: 22, font: FONT })],
  });
}
function bullet(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80, line: 280 },
    children: [new TextRun({ text, size: 22, font: FONT })],
  });
}
function clause(num: string, text: string) {
  return new Paragraph({
    spacing: { after: 120, line: 300 },
    children: [
      new TextRun({ text: `${num}  `, bold: true, size: 22, font: FONT }),
      new TextRun({ text, size: 22, font: FONT }),
    ],
  });
}
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}
function logoBuffer(): Buffer {
  const base64 = LOGO_PNG_BASE64.split(",")[1] ?? LOGO_PNG_BASE64;
  return Buffer.from(base64, "base64");
}
function signBlock(roleTitle: string) {
  return [
    new Paragraph({ spacing: { before: 400, after: 40 }, children: [new TextRun({ text: "_".repeat(35), size: 22, font: FONT })] }),
    new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: "Signature", size: 20, font: FONT, color: GREY })] }),
    new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: "Name: " + "_".repeat(30), size: 22, font: FONT })] }),
    new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: "Title: " + roleTitle, size: 22, font: FONT })] }),
    new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: "Date: " + "_".repeat(30), size: 22, font: FONT })] }),
  ];
}

function docHeader() {
  return new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: "right", position: 10500 }],
        children: [
          new ImageRun({ data: logoBuffer(), transformation: { width: 16, height: 16 }, type: "png" }),
          new TextRun({ text: "  SUIBING IT SERVICES", bold: true, size: 16, color: NAVY, font: FONT }),
          new TextRun({ text: "\tService Agreement", size: 16, color: GREY, font: FONT }),
        ],
      }),
    ],
  });
}
function docFooter() {
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: "right", position: 10500 }],
        children: [
          new TextRun({ text: "CONFIDENTIAL", size: 14, color: GREY, font: FONT }),
          new TextRun({ text: "\t", size: 14, font: FONT }),
          new TextRun({ children: [PageNumber.CURRENT], size: 14, color: GREY, font: FONT }),
        ],
      }),
    ],
  });
}

// ---- Schedule content blocks, mirroring the Master Services Agreement ----

function scheduleBucket(fee?: string, period?: string): Paragraph[] {
  return [
    pageBreak(),
    h1("Schedule — SUIBING Bucket"),
    clause("B1.1", "SUIBING Bucket is a browser-based school records management platform, provided on a subscription basis."),
    clause("B1.2", `Subscription Fee: ${fee || "[amount]"} per ${period || "[period]"}. This fee is set individually for the Client and may increase over time as the volume of the Client's stored records and data grows.`),
    clause("B1.3", "Client Data under Bucket is retained for as long as the subscription remains active and paid. Data is wiped on non-renewal only after 14 days' written notice, per the common terms below."),
    clause("B1.4", "Free onboarding training applies on initial subscription. Requests for new features beyond the standard Bucket feature set are chargeable and quoted separately."),
  ];
}
function scheduleSSMS(): Paragraph[] {
  return [
    pageBreak(),
    h1("Schedule — Suibing School Management Software (SSMS)"),
    clause("C1.1", "SSMS provides school administration and computer-based testing (CBT), including student/teacher records, class and subject management, attendance, automatically generated report sheets, and a parent portal."),
    clause("C1.2", "Feature Additions: any feature added beyond what was included at initial subscription is chargeable, quoted separately at the time of request."),
    clause("C1.3", "Persistent Storage of Test/Exam Files: not held by default. The Client may pay for persistent storage as an add-on; where the Client does so, the Client is granted full privileges, including administrative access, in relation to that stored material."),
    clause("C1.4", "End-of-Term Data Handling: after report sheets are generated, the Client may download all Data. Suibing will then wipe that Data following 14 days' written notice, unless the Parties agree in writing to an alternative retention arrangement."),
  ];
}
function scheduleEExaminer(): Paragraph[] {
  return [
    pageBreak(),
    h1("Schedule — E-Examiner Contract"),
    clause("D1.1", "Under an E-Examiner Contract, the Client engages Suibing to manage its examination process using the SSMS CBT platform."),
    h3("D1.2 Question Supply & Setup"),
    body("The Client supplies its own examination questions, in objective (multiple-choice) format only. Suibing sets up the supplied questions within the SSMS CBT system on the Client's behalf."),
    h3("D1.3 Student Registration"),
    body("Suibing registers the Client's students within the system for the purpose of sitting the examination."),
    h3("D1.4 Scope of Client Access"),
    body("Unless the Client has separately paid for administrative privilege, the Client's access is limited to: the examination portal, the report sheet portal, and the parent portal."),
    h3("D1.5 Question Bank Visibility"),
    body("Where the Client has not paid for administrative privilege, the Client may view its own submitted questions on a read-only basis. Editing remains the responsibility of Suibing."),
    h3("D1.6 Manual Score Entry"),
    body("Where assessment is not conducted via CBT (e.g. Continuous Assessment or pen-and-paper tests), the Client's teacher(s) are responsible for manually entering scores into the report sheet system."),
    h3("D1.7 Recommended Assessment Approach"),
    body("Suibing recommends CBT for formal examinations, and pen-and-paper for Continuous Assessment and shorter tests, particularly for younger students, to support handwriting and psychomotor development alongside computer literacy."),
    h3("D1.8 End-of-Term Data Handling"),
    body("After report sheets are generated, the Client may download all examination and results Data. Suibing will then wipe that Data following 14 days' written notice, unless otherwise agreed in writing."),
  ];
}
function scheduleLedger(): Paragraph[] {
  return [
    pageBreak(),
    h1("Schedule — SuibingLedger"),
    clause("E1.1", "SuibingLedger provides report sheet generation, registration and fee payment recording, student admission, and teacher-to-class assignment functionality, with security-focused access control."),
    clause("E1.2", "Feature Additions, Persistent Storage, and End-of-Term Data Handling terms mirror those set out for SSMS above, unless varied in writing between the Parties."),
    clause("E1.3", "Teacher-to-Class Security: each teacher account is assigned to specific class(es); access to student and assessment data is restricted according to that assignment."),
  ];
}
function scheduleCustom(): Paragraph[] {
  return [
    pageBreak(),
    h1("Schedule — Custom / Bespoke Development Services"),
    clause("F1.1", "Where the Client requests custom development, integration, or a bespoke feature not covered by an existing product, Suibing will provide a written quotation before work begins, based on the complexity and scope of the request, the technology/framework required, and the level of professionalism, finish, and testing required."),
    clause("F1.2", "Custom work is chargeable as quoted and is not included in any standard subscription fee. Payment terms will be set out in the written quotation for each engagement."),
    clause("F1.3", "Unless otherwise agreed in writing, Suibing retains ownership of underlying reusable code and technology; the Client receives the right to use the specific deliverable built for it."),
  ];
}

const SCHEDULE_BUILDERS: Record<ScheduleKey, (r: ContractRequest) => Paragraph[]> = {
  bucket: (r) => scheduleBucket(r.subscriptionFee, r.subscriptionPeriod),
  ssms: () => scheduleSSMS(),
  e_examiner: () => scheduleEExaminer(),
  ledger: () => scheduleLedger(),
  custom: () => scheduleCustom(),
};

export async function generateContractDocx(req: ContractRequest): Promise<Buffer> {
  const scheduleParagraphs = req.schedules.flatMap((s) => SCHEDULE_BUILDERS[s](req));
  const scheduleNames = req.schedules.map((s) => SCHEDULE_LABELS[s]).join(", ");

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1080, bottom: 1080, left: 1260, right: 1260 } } },
        headers: { default: docHeader() },
        footers: { default: docFooter() },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 160 },
            children: [new ImageRun({ data: logoBuffer(), transformation: { width: 72, height: 72 }, type: "png" })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60 },
            children: [new TextRun({ text: "SUIBING LIMITED", bold: true, size: 36, color: NAVY, font: FONT })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 8 },
            children: [new TextRun({ text: "RC 9801555 · trading as Suibing IT Services", size: 20, color: GREY, font: FONT })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 },
            children: [new TextRun({ text: "Makwalla Junction, Garko LGA, Kano State, Nigeria", size: 18, color: GREY, font: FONT })] }),

          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 },
            children: [new TextRun({ text: "SERVICE AGREEMENT", bold: true, size: 32, color: NAVY, font: FONT })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 260 },
            children: [new TextRun({ text: scheduleNames, italics: true, size: 22, color: BLUE, font: FONT })] }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
              left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "E5E5E5" },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              ["Client / Organisation", req.clientName],
              ["Address", req.clientAddress || "—"],
              ["Contact Person", req.contactPerson || "—"],
              ["Contact Email", req.contactEmail || "—"],
              ["Effective Date", req.effectiveDate],
              ["Services Covered", scheduleNames],
            ].map(([a, b]) => new TableRow({
              children: [
                new TableCell({ width: { size: 32, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 90, bottom: 90, left: 140, right: 140 },
                  children: [new Paragraph({ children: [new TextRun({ text: a, bold: true, size: 19, font: FONT })] })] }),
                new TableCell({ width: { size: 68, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 90, bottom: 90, left: 140, right: 140 },
                  children: [new Paragraph({ children: [new TextRun({ text: b, size: 19, font: FONT })] })] }),
              ],
            })),
          }),

          pageBreak(),
          h1("1. Parties"),
          clause("1.1", "This Service Agreement (\"Agreement\") is entered into between SUIBING LIMITED (RC 9801555), trading as Suibing IT Services, of Makwalla Junction, Garko LGA, Kano State, Nigeria (\"Suibing\"), and:"),
          body(req.clientName),
          body(req.clientAddress || ""),
          clause("1.2", `This Agreement covers: ${scheduleNames}, together with the common terms set out below.`),

          h1("2. Training & Onboarding"),
          clause("2.1", "For any new subscription to a Suibing product, Suibing will provide initial training on how to use the Service to the Client's staff, free of charge."),
          clause("2.2", "Training for newly released features added after initial onboarding, or requested feature additions, is not covered above and is chargeable as described in the applicable Schedule."),

          h1("3. Data Ownership, Retrieval & Deletion"),
          clause("3.1", "The Client retains ownership of its Data at all times. Suibing acts only as custodian of Data for the purpose of providing the Service."),
          clause("3.2", "Where a Schedule provides that Data is deleted at the end of a Term (a \"Wipe\"), Suibing will give the Client written notice at least fourteen (14) days before any Wipe, and will not proceed until that deadline has passed unless the Parties agree an alternative arrangement in writing."),

          h1("4. Confidentiality & Intellectual Property"),
          clause("4.1", "Each Party will keep confidential all non-public information disclosed by the other Party in connection with this Agreement."),
          clause("4.2", "All software, source code, and underlying technology of the Service remain the sole property of Suibing. This Agreement grants the Client a right to use the Service; it does not transfer ownership of Suibing intellectual property."),

          h1("5. Limitation of Liability"),
          clause("5.1", "Suibing's total liability arising from this Agreement is limited to the fees paid by the Client in the three (3) months preceding the event giving rise to the claim, to the fullest extent permitted by Nigerian law."),

          h1("6. Term & Termination"),
          clause("6.1", "This Agreement begins on the Effective Date and continues for the Subscription Period, renewing automatically unless either Party gives written notice of non-renewal."),
          clause("6.2", "Either Party may terminate this Agreement for material breach not remedied within fourteen (14) days of written notice."),

          h1("7. Governing Law"),
          clause("7.1", "This Agreement is governed by the laws of the Federal Republic of Nigeria."),

          ...scheduleParagraphs,

          pageBreak(),
          h1("Signatures"),
          body("The Parties, by their authorised representatives, have executed this Agreement as of the Effective Date above."),
          new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: "For and on behalf of SUIBING LIMITED (trading as Suibing IT Services):", bold: true, size: 22, font: FONT })] }),
          ...signBlock("Director"),
          new Paragraph({ spacing: { before: 500 }, children: [new TextRun({ text: `For and on behalf of ${req.clientName}:`, bold: true, size: 22, font: FONT })] }),
          ...signBlock("Authorised Representative"),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
