import { Pinecone, PineconeRecord } from "@pinecone-database/pinecone";
import { downloadFromSupabase } from "./supabase-server";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import md5 from "md5";
import {
  Document,
  RecursiveCharacterTextSplitter,
} from "@pinecone-database/doc-splitter";
import { getEmbeddings } from "./embeddings";
import { convertToAscii } from "./utils";

export const getPineconeClient = () => {
  return new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
};

type PDFPage = {
  pageContent: string;
  metadata: {
    loc: { pageNumber: number };
  };
};

export async function loadS3IntoPinecone(fileKey: string) {
  console.log("downloading supabase into file system");
  const file_name = await downloadFromSupabase(fileKey);
  if (!file_name) {
    throw new Error("could not download from supabase");
  }

  console.log("loading pdf into memory: " + file_name);
  const loader = new PDFLoader(file_name);
  const pages = (await loader.load()) as PDFPage[];
  console.log("pages loaded:", pages.length);

  const documents = await Promise.all(pages.map(prepareDocument));
  const flatDocs = documents.flat();
  console.log("documents prepared:", flatDocs.length);

  // Sequential to avoid Jina rate limits
  const vectors: PineconeRecord[] = [];
  for (const doc of flatDocs) {
    const vector = await embedDocument(doc);
    vectors.push(vector);
  }
  console.log("vectors created:", vectors.length);

  if (vectors.length === 0) {
    throw new Error("No vectors were created from the PDF");
  }

  const client = getPineconeClient();
  const pineconeIndex = client.index(process.env.PINECONE_INDEX_NAME!);
  const namespaceName = convertToAscii(fileKey);

  console.log("inserting vectors into pinecone");
  await pineconeIndex.namespace(namespaceName).upsert(vectors);

  return documents[0];
}

async function embedDocument(doc: Document) {
  try {
    const embeddings = await getEmbeddings(doc.pageContent);
    console.log("embedding result:", typeof embeddings, Array.isArray(embeddings), embeddings?.length);
    const hash = md5(doc.pageContent);
    return {
      id: hash,
      values: embeddings,
      metadata: {
        text: doc.metadata.text,
        pageNumber: doc.metadata.pageNumber,
      },
    } as PineconeRecord;
  } catch (error) {
    console.log("error embedding document", error);
    throw error;
  }
}

export const truncateStringByBytes = (str: string, bytes: number) => {
  const enc = new TextEncoder();
  return new TextDecoder("utf-8").decode(enc.encode(str).slice(0, bytes));
};

async function prepareDocument(page: PDFPage) {
  let { pageContent, metadata } = page;
  pageContent = pageContent.replace(/\n/g, "");
  const splitter = new RecursiveCharacterTextSplitter();
  const docs = await splitter.splitDocuments([
    new Document({
      pageContent,
      metadata: {
        pageNumber: metadata.loc.pageNumber,
        text: truncateStringByBytes(pageContent, 36000),
      },
    }),
  ]);
  return docs;
}