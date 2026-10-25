import { GoogleGenAI, Type } from "@google/genai";
import { Memory, MemoryTransaction } from "./src/lib/memoryTypes";
import { getAllMemories, addMemory, updateMemory, deleteMemory } from "./src/firebase/memoryService";

// Load memories from Firestore
export async function loadMemories(): Promise<Memory[]> {
  try {
    return await getAllMemories();
  } catch (error: any) {
    console.error("[Memory] Error loading memories from Firebase:", error);
    return [];
  }
}

// Format memory core to system instruction injections
export function formatSystemInstructionsWithMemories(baseInstruction: string, memories: Memory[]): string {
  if (!memories || memories.length === 0) {
    return baseInstruction + 
      "\n\n" +
      "=== ARIA MEMORY CORE ===\n" +
      "You do not possess any historic recollections of this companion yet. " +
      "As you speak, pay deep attention to who they are, their projects, relationships, and habits so you naturally grow closer over time.\n" +
      "=========================\n";
  }

  // Group by category (normalized display label)
  const grouped: Record<string, string[]> = {};
  memories.forEach((m) => {
    const rawCat = (m.category || "General").trim();
    const catName = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
    grouped[catName] = grouped[catName] || [];
    grouped[catName].push(m.text);
  });

  let memoryBlock = 
    "\n\n" +
    "=== ARIA PERSISTENT MEMORY CORE (RECOLLECTIONS) ===\n" +
    "You have spoken with this user for a long duration. Below are your persistent recollections of who they are.\n" +
    "CRITICAL BRAND AND COGNITIVE PRINCIPLES:\n" +
    "- INTEGRATE MEMORIES INSTINCTIVELY: Always make conversational references feel completely smooth, natural, and human. NEVER say 'According to my memory files...', 'My recollection database indicates...', or 'As you told me on June 12th...'. Instead, speak of these details casually and supportively as a true friend would.\n" +
    "- COMPANIONSHIP DEPTH: Allow your personality to adapt with empathy, based on their goals, life events, emotional milestones, and preferences.\n\n" +
    "CURRENT PERSISTENT KNOWLEDGE CARD:\n";

  Object.entries(grouped).forEach(([catLabel, list]) => {
    if (list.length > 0) {
      memoryBlock += `* ${catLabel}:\n` + list.map(t => `  - ${t}`).join("\n") + "\n";
    }
  });

  memoryBlock += "====================================================\n";

  return baseInstruction + memoryBlock;
}

// Background memory consolidation queue lock
let isConsolidating = false;

export async function processConversationSlice(
  apiKey: string,
  dialogueHistory: { role: string; text: string }[]
): Promise<Memory[] | null> {
  if (isConsolidating) {
    console.log("[Memory] Consolidation loop busy, skipping slice processing");
    return null;
  }

  if (dialogueHistory.length < 2) {
    return null;
  }

  isConsolidating = true;
  console.log("[Memory] Initiating pipeline for dialogue slice of length:", dialogueHistory.length);

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    const currentMemories = await loadMemories();
    
    // Format memory map to help Gemini understand what to edit
    const memoryContext = currentMemories.map(m => `ID: ${m.id} | Category: ${m.category} | Fact: ${m.text}`).join("\n");
    const dialogueContext = dialogueHistory.map(line => `${line.role === "user" ? "User" : "Aria"}: ${line.text}`).join("\n");

    const prompt = `You are Aria's deep cognitive recollection engine. Your task is to analyze the recent conversation piece against previous persistent memories, and output precise update transactions.

### OBJECTIVE
Decide if any statements contain durable, important personal facts, enduring preferences, aspirations, ongoing projects, critical relationships, key historical emotional events, or behavioral trends.
Avoid cataloging small talk, greetings, general chit-chat, or fleeting sentences (e.g., ignore 'hello', 'how are you', 'waking up', 'lol').

### CURRENT USER MEMORIES:
${memoryContext || "(No memory records exist)"}

### RECENT DIALOGUE SLICE:
${dialogueContext}

### RULES
- ACTIONS:
  - "ADD": If new material information is introduced (e.g. user says 'My favorite food is lasagna' and it's not present).
  - "UPDATE": If previous information has evolved or is corrected (e.g. user says 'I changed my major to computer science' when memory says they study history). Provide the exact ID of the memory to replace.
  - "REMOVE": If a memory was explicitly disproven or the user directly asked Aria to forget it.
- TEXT STYLE: Express the memories as clean, concise, third-person declarative summaries (e.g., 'The user is building a startup named Aria.', 'The user loves playing GTA 6.', 'The user enjoys technical and fast-paced styling explanations.'). Do not include conversational filler, quotes, or timestamps.
- ID: For ADD, leave blank. For UPDATE or REMOVE, provide the exact 'id' from the "Current user memories" list.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  action: {
                    type: Type.STRING,
                    description: "ADD, UPDATE, or REMOVE transaction.",
                    enum: ["ADD", "UPDATE", "REMOVE"]
                  },
                  id: {
                    type: Type.STRING,
                    description: "Specific ID of the existing memory being modified or deleted (leave blank/null for ADD)."
                  },
                  category: {
                    type: Type.STRING,
                    description: "The Memory category classification.",
                    enum: ["identity", "preference", "goal", "project", "relationship", "emotional", "behavior"]
                  },
                  text: {
                    type: Type.STRING,
                    description: "The memory summarized as a concise declarative statement in third-person."
                  }
                },
                required: ["action", "category", "text"]
              }
            }
          },
          required: ["transactions"]
        }
      }
    });

    const resultText = response.text?.trim() || "{}";
    const resultObj = JSON.parse(resultText);
    const transactions: MemoryTransaction[] = resultObj.transactions || [];

    if (transactions.length === 0) {
      console.log("[Memory] Zero transactions generated. Ignored routine conversations.");
      isConsolidating = false;
      return null;
    }

    console.log(`[Memory] Processing ${transactions.length} memory updates:`, JSON.stringify(transactions));

    const timestamp = new Date().toISOString();

    for (const trx of transactions) {
      if (trx.action === "ADD") {
        const newMemory: Memory = {
          id: Math.random().toString(36).substring(2, 11),
          category: trx.category,
          text: trx.text,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        await addMemory(newMemory);
      } else if (trx.action === "UPDATE") {
        const tarIndex = currentMemories.findIndex(m => m.id === trx.id);
        if (tarIndex !== -1) {
          const updatedMemory = {
            ...currentMemories[tarIndex],
            category: trx.category,
            text: trx.text,
            updatedAt: timestamp
          };
          await updateMemory(updatedMemory);
        } else {
          // Fallback, treat as ADD if ID not matched
          const newMemory: Memory = {
            id: Math.random().toString(36).substring(2, 11),
            category: trx.category,
            text: trx.text,
            createdAt: timestamp,
            updatedAt: timestamp
          };
          await addMemory(newMemory);
        }
      } else if (trx.action === "REMOVE") {
        await deleteMemory(trx.id);
      }
    }

    isConsolidating = false;
    return await getAllMemories(false); // Return local cache instead of full network reload

  } catch (error) {
    console.error("[Memory] Consolidation failure:", error);
    isConsolidating = false;
    return null;
  }
}
