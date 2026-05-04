import { openai } from "@ai-sdk/openai";
import { createKiwixTools } from "@lgrammel/kiwix-tool";
import { isStepCount, ToolLoopAgent } from "ai";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

const zimPath =
  process.env.KIWIX_ZIM_PATH ?? (await findWikipediaZim(process.env.KIWIX_ZIM_DIR ?? "~/opt/zim"));

const prompt =
  process.argv.slice(2).join(" ") ||
  "Use the local Kiwix Wikipedia archive to explain what Kiwix is in three concise bullet points.";

console.error(`Using ZIM archive: ${zimPath}`);

const agent = new ToolLoopAgent({
  id: "kiwix-terminal-agent",
  model: openai(process.env.OPENAI_MODEL ?? "gpt-5-mini"),
  instructions:
    "Answer using the local Kiwix Wikipedia archive. Use kiwixSearchTool first, then use kiwixReadTool with a path from the search results before answering.",
  tools: createKiwixTools({
    zimPath,
    preloadXapianDb: true
  }),
  stopWhen: isStepCount(8)
});

const result = await agent.generate({
  prompt
});

console.log(result.text);

async function findWikipediaZim(directory: string): Promise<string> {
  const root = resolveHomePath(directory);
  const zimFiles = await findZimFiles(root);
  const wikipediaFiles = zimFiles
    .filter((file) => file.toLowerCase().includes("wikipedia"))
    .sort((left, right) => scoreWikipediaZim(right) - scoreWikipediaZim(left));

  const zimPath = wikipediaFiles[0];

  if (!zimPath) {
    throw new Error(
      `No Wikipedia .zim file found under ${root}. Set KIWIX_ZIM_PATH to use a specific archive.`
    );
  }

  return zimPath;
}

async function findZimFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return findZimFiles(path);
      }

      return entry.isFile() && entry.name.endsWith(".zim") ? [path] : [];
    })
  );

  return files.flat();
}

function scoreWikipediaZim(path: string): number {
  const lower = path.toLowerCase();
  let score = 0;

  if (lower.includes("_en_")) score += 3;
  if (lower.includes("_all_")) score += 2;
  if (!lower.includes("_nopic_")) score += 1;

  return score;
}

function resolveHomePath(path: string): string {
  if (path === "~") {
    return homedir();
  }

  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }

  return isAbsolute(path) ? path : join(process.cwd(), path);
}
