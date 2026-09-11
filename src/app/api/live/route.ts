import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

function fail() {
  return NextResponse.json({ status: "error" }, { status: 503, headers });
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return fail();

  try {
    const { error } = await createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
      .from("feeds")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(5_000));

    if (error) return fail();

    return NextResponse.json(
      { status: "ok", version: packageJson.version },
      { headers },
    );
  } catch {
    return fail();
  }
}
