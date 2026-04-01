import { Message, OpenAIStream, StreamingTextResponse } from "ai";
import { getContext } from "@/lib/context";
import { db } from "@/lib/db";
import { chats, messages as _messages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = "edge";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { messages, chatId } = await req.json();
    const _chats = await db.select().from(chats).where(eq(chats.id, chatId));

    if (_chats.length != 1) {
      return NextResponse.json({ error: "chat not found" }, { status: 404 });
    }

    const fileKey = _chats[0].fileKey;
    const lastMessage = messages[messages.length - 1];
    const context = await getContext(lastMessage.content, fileKey);

 const prompt = {
  role: "system" as const,
  content: `You are a smart, friendly and helpful AI assistant. Answer ONLY the current question. Never repeat or reference previous questions or answers.

Rules:
- Answer the current question directly and concisely
- If context is provided and relevant, use it
- If the question is general, answer from your own knowledge  
- Never mention previous questions
- Never mention the context block or document unless asked
- Keep responses short unless a detailed answer is needed
- Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

CONTEXT:
${context}`,
};

    // Save user message to DB before streaming
    await db.insert(_messages).values({
      chatId,
      content: lastMessage.content,
      role: "user",
    });

    const response = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    prompt,
    ...messages.slice(-6).filter((message: Message) => message.role === "user"),
  ],
  stream: true,
});

    // Manually stream and collect full completion for DB save
    const encoder = new TextEncoder();
    let fullCompletion = "";

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            fullCompletion += text;
            controller.enqueue(encoder.encode(text));
          }
        }
        // Save AI response to DB after stream ends
        await db.insert(_messages).values({
          chatId,
          content: fullCompletion,
          role: "system",
        });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}