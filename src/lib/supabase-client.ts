import { createClient } from "@supabase/supabase-js";

export async function uploadToSupabase(
  file: File,
  file_key: string
): Promise<{ file_key: string; file_name: string }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error } = await supabase.storage
    .from("pdfs") // make sure this bucket exists in Supabase dashboard
    .upload(file_key, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) throw error;

  return {
    file_key,
    file_name: file.name,
  };
}

export function getSupabaseUrl(file_key: string): string {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = supabase.storage.from("pdfs").getPublicUrl(file_key);
  return data.publicUrl;
}