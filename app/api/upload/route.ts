import { NextRequest, NextResponse } from "next/server";
import { parseGPX, parseZip } from "@/lib/gpx-utils";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File too large (max 100MB)" },
        { status: 413 }
      );
    }

    const name = file.name.toLowerCase();

    if (!name.endsWith(".gpx") && !name.endsWith(".zip")) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Use .gpx or .zip" },
        { status: 400 }
      );
    }

    const rides = name.endsWith(".zip")
      ? await parseZip(file)
      : await parseGPX(file);

    return NextResponse.json({
      success: true,
      rides,
      uploadId: crypto.randomUUID(),
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 }
    );
  }
}
