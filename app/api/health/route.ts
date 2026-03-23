import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export async function GET() {
  try {
    await queryOne("SELECT 1");
    return NextResponse.json({ status: "ok", db: "connected" });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { status: "error", db: "disconnected" },
      { status: 500 }
    );
  }
}
