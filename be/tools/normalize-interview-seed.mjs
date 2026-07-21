import { readFile, writeFile, rename, stat } from "node:fs/promises";
import { resolve } from "node:path";

const seedPath = resolve(process.cwd(), "src/main/resources/seed/interview_questions_seed_format.reviewed.cleaned.json");
const checkpointPath = `${seedPath}.normalization-progress.json`;
const redoCheckpointPath = `${seedPath}.redo-generic-progress.json`;
const debugResponsePath = `${seedPath}.normalization-last-response.txt`;
const batchSize = Number.parseInt(process.env.BATCH_SIZE ?? "10", 10);
const delayMs = Number.parseInt(process.env.REQUEST_DELAY_MS ?? "1200", 10);
const mode = (process.env.NORMALIZATION_MODE ?? "remote").trim().toLowerCase();
const forceRedoFromStart = ["1", "true", "yes"].includes((process.env.FORCE_REDO_FROM_START ?? "").trim().toLowerCase());
const applyProgressOnly = mode === "apply-progress";
const useLocalFallback = mode === "hybrid" || mode === "local";
const redoGenericMode = mode === "redo-generic";

function propertyValue(source, name) {
  const match = source.match(new RegExp(`^${name.replaceAll(".", "\\.")}=(.+)$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function getApiConfig(properties) {
  const apiKey = process.env.GEMINI_API_KEY || propertyValue(properties, "gemini.api.key");
  const model = process.env.GEMINI_MODEL || propertyValue(properties, "gemini.model") || "gemini-3-flash";
  const fallbackModels = propertyValue(properties, "gemini.fallback-models")
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (!apiKey || apiKey.includes("${")) {
    throw new Error("Set GEMINI_API_KEY before normalizing the seed file.");
  }
  return { apiKey, models: [...new Set([model, ...fallbackModels])] };
}

function normalizePoints(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((point) => String(point).replaceAll(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 5);
}

function stripWrappingQuotes(value) {
  return value.replace(/^["'`]+|["'`]+$/g, "").trim();
}

function toTitleWords(subject) {
  return subject
    .replaceAll(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word ? word[0].toUpperCase() + word.slice(1) : word)
    .join(" ");
}

function cleanSubject(questionText, prefixPattern) {
  return stripWrappingQuotes(
    questionText
      .replace(prefixPattern, "")
      .replace(/[?.!]+$/g, "")
      .replace(/\s+/g, " ")
      .replace(/^(a|an|the)\s+/i, "")
      .trim()
  );
}

function comparisonSubjects(questionText) {
  const normalized = questionText.replace(/[?.!]+$/g, "").replaceAll(/\s+/g, " ").trim();
  const patterns = [
    /difference(?:s)? between (.+?) and (.+)$/i,
    /compare (.+?) and (.+)$/i,
    /(.+?) vs\.? (.+)$/i
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return [toTitleWords(stripWrappingQuotes(match[1])), toTitleWords(stripWrappingQuotes(match[2]))];
    }
  }
  return [];
}

function definitionPoints(subject) {
  const label = toTitleWords(subject || "the concept");
  return [
    `Define ${label} clearly in the correct technical context`,
    `Explain the main mechanism, structure, or lifecycle of ${label}`,
    `Describe the practical role of ${label} in implementation or workflow`,
    `Mention one important benefit, limitation, or trade-off of ${label}`
  ];
}

function purposePoints(subject) {
  const label = toTitleWords(subject || "the feature");
  return [
    `State the primary purpose of ${label}`,
    `Explain how ${label} is used or configured in practice`,
    `Describe the main benefit or problem ${label} solves`,
    `Mention one important behavior, limitation, or side effect of ${label}`
  ];
}

function comparisonPoints(left, right) {
  const first = toTitleWords(left || "the first concept");
  const second = toTitleWords(right || "the second concept");
  return [
    `Define ${first} in the correct technical context`,
    `Define ${second} in the correct technical context`,
    `Contrast the main architectural or behavioral difference between ${first} and ${second}`,
    `Explain the practical trade-off or when one is more suitable than the other`
  ];
}

function processPoints(questionText) {
  const subject = cleanSubject(questionText, /^How (do|would|can) you\s+/i);
  const label = toTitleWords(subject || "the task");
  return [
    `Outline the main steps to approach ${label}`,
    `Explain the reasoning behind the chosen method, design, or sequence`,
    `Mention how to verify correctness, reliability, or performance`,
    `Call out one key risk, trade-off, or failure mode to watch for`
  ];
}

function explanationPoints(questionText) {
  const subject = cleanSubject(questionText, /^(Explain|Describe|Can you explain|Walk me through)\s+/i);
  const label = toTitleWords(subject || "the topic");
  return [
    `State the core concept behind ${label}`,
    `Explain how ${label} works or is structured`,
    `Describe the practical implication of ${label} in real development work`,
    `Mention one limitation, trade-off, or important edge condition of ${label}`
  ];
}

function behavioralPoints(questionText) {
  if (/why should we hire you/i.test(questionText)) {
    return [
      "Connect relevant skills and experience to the role requirements",
      "Provide concrete evidence through projects, results, or responsibilities",
      "Show motivation and ability to contribute quickly",
      "Explain the specific value the candidate would add to the team"
    ];
  }
  if (/tell me about yourself/i.test(questionText)) {
    return [
      "Summarize current academic or professional background relevant to the role",
      "Highlight the most relevant skills, projects, or responsibilities",
      "Explain motivation for pursuing this career path or role",
      "Connect personal strengths to the needs of the target position"
    ];
  }
  return [
    "Describe the specific situation, problem, or goal",
    "Explain the concrete actions taken and the reasoning behind them",
    "State the outcome, impact, or lesson learned",
    "Connect the example back to the target role requirements"
  ];
}

function localNormalizeItem(item) {
  const questionText = String(item.questionText ?? "").replaceAll(/\s+/g, " ").trim();
  if (!questionText) return ["State the core answer clearly", "Explain the reasoning behind the answer", "Provide one practical implication or outcome"];
  if (["BEHAVIORAL", "PROJECT", "COMMUNICATION"].includes(item.category)) {
    return behavioralPoints(questionText);
  }
  const comparison = comparisonSubjects(questionText);
  if (comparison.length === 2) {
    return comparisonPoints(comparison[0], comparison[1]);
  }
  if (/^What is the purpose of /i.test(questionText) || /^What is the use of /i.test(questionText) || /^What is the need for /i.test(questionText)) {
    return purposePoints(cleanSubject(questionText, /^What is (the )?(purpose|use|need) of\s+/i));
  }
  if (/^What is /i.test(questionText) || /^What are /i.test(questionText)) {
    return definitionPoints(cleanSubject(questionText, /^What (is|are)\s+/i));
  }
  if (/^(How|Why|Can)\b/i.test(questionText)) {
    return processPoints(questionText);
  }
  if (/^(Explain|Describe|Write|Walk me through)\b/i.test(questionText)) {
    return explanationPoints(questionText);
  }
  return explanationPoints(questionText);
}

function localNormalizeBatch(batch) {
  return batch.map((item) => normalizePoints(localNormalizeItem(item)));
}

function matchesTemplatePoint(point) {
  const normalized = String(point ?? "").replaceAll(/\s+/g, " ").trim();
  return [
    /^Define .+ clearly in the correct technical context$/i,
    /^Explain the main mechanism, structure, or lifecycle of .+$/i,
    /^Describe the practical role of .+ in implementation or workflow$/i,
    /^Mention one important benefit, limitation, or trade-off of .+$/i,
    /^State the primary purpose of .+$/i,
    /^Explain how .+ is used or configured in practice$/i,
    /^Describe the main benefit or problem .+ solves$/i,
    /^Mention one important behavior, limitation, or side effect of .+$/i,
    /^Contrast the main architectural or behavioral difference between .+$/i,
    /^Explain the practical trade-off or when one is more suitable than the other$/i,
    /^Outline the main steps to approach .+$/i,
    /^Explain the reasoning behind the chosen method, design, or sequence$/i,
    /^Mention how to verify correctness, reliability, or performance$/i,
    /^Call out one key risk, trade-off, or failure mode to watch for$/i,
    /^State the core concept behind .+$/i,
    /^Explain how .+ works or is structured$/i,
    /^Describe the practical implication of .+ in real development work$/i,
    /^Mention one limitation, trade-off, or important edge condition of .+$/i,
    /^Describe the specific situation, problem, or goal$/i,
    /^Explain the concrete actions taken and the reasoning behind them$/i,
    /^State the outcome, impact, or lesson learned$/i,
    /^Connect the example back to the target role requirements$/i,
    /^Connect relevant skills and experience to the role requirements$/i,
    /^Provide concrete evidence through projects, results, or responsibilities$/i,
    /^Show motivation and ability to contribute quickly$/i,
    /^Explain the specific value the candidate would add to the team$/i,
    /^Summarize current academic or professional background relevant to the role$/i,
    /^Highlight the most relevant skills, projects, or responsibilities$/i,
    /^Explain motivation for pursuing this career path or role$/i,
    /^Connect personal strengths to the needs of the target position$/i
  ].some((pattern) => pattern.test(normalized));
}

function needsGeminiRewrite(item) {
  return normalizePoints(item.expectedPoints).some(matchesTemplatePoint);
}

function parseJsonResponse(text) {
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  const start = objectStart < 0 ? arrayStart : arrayStart < 0 ? objectStart : Math.min(objectStart, arrayStart);
  if (start < 0) throw new Error("Gemini did not return JSON.");
  const opening = text[start];
  const closing = opening === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === opening) depth += 1;
    else if (character === closing) {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(start, index + 1));
    }
  }
  throw new Error("Gemini returned incomplete JSON.");
}

function buildPrompt(batch) {
  return `You are reviewing an interview-question bank used for RAG retrieval and deterministic answer coverage.
Rewrite the expectedPoints for every item below and return JSON only:
{"items":[{"id":number,"expectedPoints":["string"]}]}

Each expected point is a mandatory, atomic core answer criterion for that exact question. It will be embedded together with the question for semantic retrieval and later compared with a candidate answer, so it must read like the substance of an excellent answer, not like grading instructions.

Rules:
- Return 3 to 5 points for every item. Return exactly one object for every input id, in the same order as the input. Keep the output in the same language as the question.
- Cover the essential answer, not the question topic or a generic answer structure.
- Never use generic labels: "use case", "key features", "example", "impact", "validation", "edge cases", "recommendation", "differences", or a restatement of the question.
- Never write instruction-style expected points such as "Define X", "Explain how X works", "Describe the practical role", "Outline the main steps", or "Mention one trade-off". Write the actual answer content that those instructions are asking for.
- Do not require optional vendor/framework/tool names. A point must express the underlying concept, not a particular example such as TensorRT, OpenVINO, AWS, React, or Docker.
- For comparison questions, cover both sides and the relevant trade-off. For behavioral/project questions, require the relevant situation, action/reasoning, and result. For technical definitions, require definition, mechanism, and practical consequence where appropriate.
- Do not invent requirements outside the question. Avoid vague wording. Do not include explanations outside the JSON.

Items:
${JSON.stringify(batch.map((item, id) => ({ id, questionText: item.questionText, targetPosition: item.targetPosition, level: item.level, category: item.category })))}`;
}

async function callGemini(apiKey, models, batch) {
  let lastError;
  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(batch) }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: "application/json" } })
    });
    if (!response.ok) {
      const error = new Error(`Gemini model ${model} failed (${response.status}): ${await response.text()}`);
      if (response.status !== 404) lastError = error;
      continue;
    }
    const body = await response.json();
    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no normalization content.");
    const result = parseJsonResponse(text);
    const resultItems = Array.isArray(result) ? result : result.items;
    if (!Array.isArray(resultItems) || resultItems.length !== batch.length) {
      await writeFile(debugResponsePath, text, "utf8");
      throw new Error("Gemini returned an incomplete normalization batch.");
    }
    return resultItems.map((item, index) => {
      if (item.id !== index || normalizePoints(item.expectedPoints).length < 3) throw new Error(`Gemini returned an invalid rubric for batch item ${index}.`);
      return normalizePoints(item.expectedPoints);
    });
  }
  throw lastError ?? new Error("No Gemini model was available.");
}

async function loadJson(path) {
  const source = await readFile(path, "utf8");
  return JSON.parse(source.replace(/^\uFEFF/, ""));
}

async function checkpoint(items, completed) {
  const temporaryCheckpoint = `${checkpointPath}.tmp`;
  await writeFile(temporaryCheckpoint, JSON.stringify({ completed, items }, null, 2) + "\n", "utf8");
  await renameWithRetry(temporaryCheckpoint, checkpointPath);
}

async function checkpointRedo(completed, targetIndexes) {
  const temporaryCheckpoint = `${redoCheckpointPath}.tmp`;
  await writeFile(temporaryCheckpoint, JSON.stringify({ completed, targetIndexes }, null, 2) + "\n", "utf8");
  await renameWithRetry(temporaryCheckpoint, redoCheckpointPath);
}

async function writeSeed(items) {
  const temporaryOutput = `${seedPath}.tmp`;
  await writeFile(temporaryOutput, JSON.stringify(items, null, 2) + "\n", "utf8");
  await renameWithRetry(temporaryOutput, seedPath);
}

async function renameWithRetry(from, to) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      if (!["EPERM", "EBUSY"].includes(error?.code) || attempt >= 6) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 300));
    }
  }
}

async function main() {
  const sourceItems = await loadJson(seedPath);
  let items = sourceItems;
  let completed = 0;

  if (!redoGenericMode) {
    try {
      await stat(checkpointPath);
      const progress = await loadJson(checkpointPath);
      if (Array.isArray(progress.items) && Number.isInteger(progress.completed) && progress.items.length === sourceItems.length) {
        items = progress.items;
        completed = progress.completed;
        console.log(`Resuming at ${completed}/${items.length}.`);
      }
    } catch {
      console.log(`Starting normalization for ${items.length} questions.`);
    }
  }

  if (applyProgressOnly) {
    await writeSeed(items);
    console.log(`Applied checkpoint snapshot to seed file at ${completed}/${items.length}.`);
    return;
  }

  let apiKey = "";
  let models = [];
  if (mode !== "local") {
    const properties = await readFile(resolve(process.cwd(), "src/main/resources/application.properties"), "utf8");
    ({ apiKey, models } = getApiConfig(properties));
  }

  if (redoGenericMode) {
    let targetIndexes = items.map((item, index) => needsGeminiRewrite(item) ? index : -1).filter((index) => index >= 0);
    completed = 0;
    if (!forceRedoFromStart) {
      try {
        await stat(redoCheckpointPath);
        const progress = await loadJson(redoCheckpointPath);
        if (Array.isArray(progress.targetIndexes) && Number.isInteger(progress.completed) && progress.targetIndexes.length === targetIndexes.length) {
          targetIndexes = progress.targetIndexes;
          completed = progress.completed;
          console.log(`Resuming Gemini rewrite at ${completed}/${targetIndexes.length}.`);
        } else {
          console.log(`Starting Gemini rewrite for ${targetIndexes.length} template-like questions.`);
        }
      } catch {
        console.log(`Starting Gemini rewrite for ${targetIndexes.length} template-like questions.`);
      }
    } else {
      console.log(`Force restarting Gemini rewrite for ${targetIndexes.length} template-like questions.`);
    }
    if (forceRedoFromStart) {
      console.log(`Starting Gemini rewrite for ${targetIndexes.length} template-like questions.`);
    }

    for (let start = completed; start < targetIndexes.length; start += batchSize) {
      const batchIndexes = targetIndexes.slice(start, Math.min(start + batchSize, targetIndexes.length));
      const batchItems = batchIndexes.map((index) => items[index]);
      let normalized;
      for (let attempt = 1; ; attempt += 1) {
        try {
          normalized = await callGemini(apiKey, models, batchItems);
          break;
        } catch (error) {
          if (error.message?.includes("incomplete normalization batch")) throw error;
          if (attempt >= 4) throw error;
          const backoff = attempt * 3000;
          console.warn(`Rewrite batch ${start}-${start + batchIndexes.length} failed (attempt ${attempt}); retrying in ${backoff}ms.`);
          await new Promise((resolveDelay) => setTimeout(resolveDelay, backoff));
        }
      }
      normalized.forEach((expectedPoints, offset) => { items[batchIndexes[offset]].expectedPoints = expectedPoints; });
      await writeSeed(items);
      await checkpointRedo(start + batchIndexes.length, targetIndexes);
      console.log(`Rewrote ${start + batchIndexes.length}/${targetIndexes.length} template-like questions.`);
      if (start + batchIndexes.length < targetIndexes.length) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    console.log(`Completed Gemini rewrite for ${targetIndexes.length} template-like questions.`);
    return;
  }

  for (let start = completed; start < items.length; start += batchSize) {
    const end = Math.min(start + batchSize, items.length);
    let normalized;
    if (mode === "local") {
      normalized = localNormalizeBatch(items.slice(start, end));
    } else {
      for (let attempt = 1; ; attempt += 1) {
        try {
          normalized = await callGemini(apiKey, models, items.slice(start, end));
          break;
        } catch (error) {
          if (error.message?.includes("incomplete normalization batch")) throw error;
          if (attempt >= 4) {
            if (!useLocalFallback) throw error;
            console.warn(`Batch ${start}-${end} is falling back to local normalization after remote failure.`);
            normalized = localNormalizeBatch(items.slice(start, end));
            break;
          }
          const backoff = attempt * 3000;
          console.warn(`Batch ${start}-${end} failed (attempt ${attempt}); retrying in ${backoff}ms.`);
          await new Promise((resolveDelay) => setTimeout(resolveDelay, backoff));
        }
      }
    }
    normalized.forEach((expectedPoints, offset) => { items[start + offset].expectedPoints = expectedPoints; });
    await checkpoint(items, end);
    console.log(`Normalized ${end}/${items.length}.`);
    if (end < items.length) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
  }

  await writeSeed(items);
  console.log(`Completed normalization for ${items.length} questions.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
