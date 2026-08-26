import { NextRequest, NextResponse } from "next/server";
import { generateContractDocx, ScheduleKey } from "@/lib/contract";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName, clientAddress, contactPerson, contactEmail,
      schedules, effectiveDate, subscriptionFee, subscriptionPeriod,
    } = body as {
      clientName: string; clientAddress: string; contactPerson: string; contactEmail: string;
      schedules: ScheduleKey[]; effectiveDate: string; subscriptionFee?: string; subscriptionPeriod?: string;
    };

    if (!clientName?.trim()) {
      return NextResponse.json({ error: "clientName is required" }, { status: 400 });
    }
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return NextResponse.json({ error: "At least one schedule must be selected" }, { status: 400 });
    }

    const buffer = await generateContractDocx({
      clientName: clientName.trim(),
      clientAddress: (clientAddress || "").trim(),
      contactPerson: (contactPerson || "").trim(),
      contactEmail: (contactEmail || "").trim(),
      schedules,
      effectiveDate: effectiveDate?.trim() || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
      subscriptionFee: subscriptionFee?.trim(),
      subscriptionPeriod: subscriptionPeriod?.trim(),
    });

    const filename = `Service_Agreement_${clientName.trim().replace(/\s+/g, "_")}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to generate contract" }, { status: 500 });
  }
}
