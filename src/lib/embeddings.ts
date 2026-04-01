export async function getEmbeddings(text: string): Promise<number[]> {
  try {
    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.JINA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: [text.replace(/\n/g, " ").slice(0, 512)],
        model: "jina-embeddings-v2-base-en",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jina API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding as number[];
  } catch (error) {
    console.error("getEmbeddings error:", error);
    throw error;
  }
}