import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import os from "os";

export async function downloadFromSupabase(file_key: string): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // ← service role bypasses RLS
  );

  const { data, error } = await supabase.storage
    .from("pdfs")
    .download(file_key);

  if (error || !data) throw new Error("Failed to download from Supabase");

  const tmp_dir = os.tmpdir();
  const file_name = path.join(tmp_dir, `pdf-${Date.now()}.pdf`);
  const arrayBuffer = await data.arrayBuffer();
  fs.writeFileSync(file_name, new Uint8Array(arrayBuffer));

  return file_name;
}