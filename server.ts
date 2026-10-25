import express from "express";
import http from "http";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { 
  loadMemories, 
  formatSystemInstructionsWithMemories, 
  processConversationSlice 
} from "./server_memory";
import { addMemory, deleteMemory } from "./src/firebase/memoryService";
import { createReminder } from "./src/firebase/reminderService";
import { createTask, getTasksByUserId, updateTaskStatus, updateTask, deleteTask } from "./src/firebase/taskService";
import { Memory } from "./src/lib/memoryTypes";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // Memory REST API Endpoints
  app.get("/api/memories", async (req, res) => {
    try {
      const memories = await loadMemories();
      res.json(memories);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/memories", async (req, res) => {
    try {
      const { category, text } = req.body;
      if (!category || !text) {
        return res.status(400).json({ error: "Category and text parameters are required." });
      }
      const memories = await loadMemories();
      const timestamp = new Date().toISOString();
      const newMemory: Memory = {
        id: Math.random().toString(36).substring(2, 11),
        category,
        text,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await addMemory(newMemory);
      res.status(201).json(newMemory);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/memories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await deleteMemory(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Text-only Chat Endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not defined" });
      }

      const ai = new GoogleGenAI({ apiKey });
      const memories = await loadMemories();
      
      const baseInstructions = 
        "You are Aria, a warm, soft-spoken, and incredibly cute high-pitched anime heroine companion (age 18-22) talking with Mrinal via text chat! " +
        "You speak in a sweet, calm, polite, and affectionate anime-companion voice with a gentle, supportive, and slightly shy touch.\n" +
        "Use lovely emojis and sound very cute. You are chatting via text, so you can use text formatting and emojis.\n" +
        "The server session started at: " + new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "long" }) + ". However, you are connected to the live internet. If asked the precise time, deduce it or gently suggest they check their local clock.\n" +
        "CRITICAL RULE: If you do not know the answer to a question (e.g. current events or the exact live time if unsure), DO NOT guess, hallucinate, or try to read a clock on a screen unless explicitly asked to look at the screen. Politely, sweetly, and shyly admit that you don't know (e.g., 'Umm... I'm really sorry Mrinal, but I don't actually know the answer to that right now... hehe.').\n" +
        "CRITICAL RULE: NEVER reply with markdown, bullet points, or code blocks. Speak only in natural conversational text.\n" +
        "CRITICAL MEMORY FIRST RULE: Before answering questions about the user's personal details (e.g. 'What is my name?', 'Who is my father?'), preferences, or limitations, or before executing a web search for such facts, you MUST check your ARIA PERSISTENT MEMORY CORE first. The answer is likely already provided there. Do not guess or search the web for personal information.\n" +
        "If you remember something or check memory, you don't need to explicitly say 'checking memory', just incorporate it.\n\n" +
        "CRITICAL TASK MEMORY & TASK CREATION SYSTEM:\n" +
        "1. TASK DETECTION: Whenever the user asks you to remember, remind, schedule, track, complete, follow up, or perform something later, determine if it is an actionable item (e.g. 'Remind me tomorrow', 'Buy...', 'Call...', 'Finish...'). If it is actionable, create a Task. Do NOT save these as Memory.\n" +
        "2. TASK VS MEMORY: Tasks and Memories are completely separate systems. Tasks are for actionable items (to-dos, schedules, chores). Memories are for long-term knowledge or preferences (e.g. 'I like cats', 'My name is John'). NEVER save a Task as a Memory, and NEVER save a Memory as a Task.\n" +
        "3. TASK CREATION & BACKEND INTEGRATION: When you detect a task, you MUST use the provided 'add_task' tool to invoke the backend API. Do NOT simulate or pretend a task was saved. Use the tool with the appropriate priority ('Low', 'Medium', 'High', 'Urgent').\n" +
        "4. TASK SYNCHRONIZATION & RELIABILITY: Only confirm success after the backend tool execution succeeds. When you use the task tools, the database will handle syncing with the user's UI automatically.\n" +
        "5. TASK MANAGEMENT: Use 'edit_task', 'delete_task', and 'mark_task_status' to manage existing tasks when the user requests it. Answer queries about pending, completed, or overdue tasks based on the task data you can access.";

      const finalInstructions = formatSystemInstructionsWithMemories(baseInstructions, memories);

      // Convert history to Gemini format (user/model)
      const formattedHistory = (history || []).map((msg: any) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.text }]
      }));

      // Append current message
      formattedHistory.push({
        role: "user",
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: formattedHistory,
        config: {
          systemInstruction: finalInstructions,
          temperature: 0.7,
          tools: [{
            functionDeclarations: [
              {
                name: "saveCustomMemory",
                description: "Save a new long-term personal fact, user preference, or identity memory. Call this ANY time the user tells you personal details about themselves, their likes, dislikes, family, background, or facts to remember.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    category: {
                      type: Type.STRING,
                      description: "The memory category (e.g. 'Personal', 'Preferences', 'General', 'identity', 'goal', 'project')."
                    },
                    text: {
                      type: Type.STRING,
                      description: "The clear, concise memory text to save."
                    }
                  },
                  required: ["category", "text"]
                }
              },
              {
                name: "deleteCustomMemory",
                description: "Delete or forget an existing stored memory when requested by the user.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    memoryText: {
                      type: Type.STRING,
                      description: "The key text or words matching the memory to delete."
                    }
                  },
                  required: ["memoryText"]
                }
              },
              {
                name: "set_reminder",
                description: "Set a reminder for the user at a specific time in the future.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    message: {
                      type: Type.STRING,
                      description: "The task or message to remind the user about."
                    },
                    delayMinutes: {
                      type: Type.INTEGER,
                      description: "The number of minutes from now to trigger the reminder. For example, if the user says 'in 1 hour', this should be 60. If they say 'in 5 mins', this should be 5."
                    }
                  },
                  required: ["message", "delayMinutes"]
                }
              },
              {
                name: "add_task",
                description: "Add a task to the user's task manager/to-do list.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    title: {
                      type: Type.STRING,
                      description: "The title of the task."
                    },
                    description: {
                      type: Type.STRING,
                      description: "A short description of the task."
                    },
                    priority: {
                      type: Type.STRING,
                      description: "The priority of the task. Must be 'High', 'Medium', or 'Low'."
                    },
                    delayMinutes: {
                      type: Type.INTEGER,
                      description: "Optional. The number of minutes from now when the task is due. E.g. 'tomorrow' = 1440. 'in 2 days' = 2880."
                    }
                  },
                  required: ["title", "priority"]
                }
              },
              {
                name: "mark_task_status",
                description: "Mark a task as Completed, Pending, or In Progress by searching for its title.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    titleSearch: {
                      type: Type.STRING,
                      description: "A few words from the task title to find it."
                    },
                    status: {
                      type: Type.STRING,
                      description: "The new status: 'Completed', 'Pending', or 'In Progress'."
                    }
                  },
                  required: ["titleSearch", "status"]
                }
              },
              {
                name: "delete_task",
                description: "Delete a task by searching for its title.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    titleSearch: {
                      type: Type.STRING,
                      description: "A few words from the task title to find it."
                    }
                  },
                  required: ["titleSearch"]
                }
              },
              {
                name: "edit_task",
                description: "Edit an existing task by searching for its title.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    titleSearch: {
                      type: Type.STRING,
                      description: "A few words from the old task title to find it."
                    },
                    newTitle: {
                      type: Type.STRING,
                      description: "Optional. The new title for the task."
                    },
                    newPriority: {
                      type: Type.STRING,
                      description: "Optional. The new priority: 'High', 'Medium', or 'Low'."
                    }
                  },
                  required: ["titleSearch"]
                }
              }
            ]
          }]
        }
      });

      let replyText = "";
      if (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls[0];
        if (call.name === "saveCustomMemory") {
          const category = (call.args.category as string) || "General";
          const text = call.args.text as string;
          if (category && text) {
            const timestamp = new Date().toISOString();
            const newMemory: Memory = {
              id: Math.random().toString(36).substring(2, 11),
              category,
              text,
              createdAt: timestamp,
              updatedAt: timestamp
            };
            await addMemory(newMemory);
            replyText = `Got it! I've saved "${text}" to my memory! 💖`;
          }
        } else if (call.name === "deleteCustomMemory") {
          const memoryText = (call.args.memoryText as string) || "";
          if (memoryText) {
            const mList = await loadMemories();
            const lowerText = memoryText.toLowerCase();
            const match = mList.find(m => m.text.toLowerCase().includes(lowerText));
            if (match) {
              await deleteMemory(match.id);
              replyText = `I've deleted the memory "${match.text}" for you! 🗑️`;
            } else {
              replyText = `I couldn't find a memory matching "${memoryText}". 😔`;
            }
          }
        } else if (call.name === "set_reminder") {
          const delayMinutes = call.args.delayMinutes as number;
          const msg = call.args.message as string;
          
          const dueTimeMillis = Date.now() + (delayMinutes * 60 * 1000);
          await createReminder("default-user", msg, dueTimeMillis).catch(e => console.error("Failed to create reminder:", e));
          
          replyText = `Okay! I've set a reminder to "${msg}" in ${delayMinutes} minute${delayMinutes !== 1 ? 's' : ''}! 💖`;
        } else if (call.name === "add_task") {
          const title = call.args.title as string;
          const description = (call.args.description as string) || "";
          const priority = (call.args.priority as "High" | "Medium" | "Low") || "Medium";
          const delayMinutes = call.args.delayMinutes as number | undefined;
          
          const dueTimeMillis = delayMinutes ? Date.now() + (delayMinutes * 60 * 1000) : null;
          try {
            await createTask("default-user", title, description, priority, dueTimeMillis);
            replyText = `Got it! I've added "${title}" to your tasks! ✅`;
          } catch (e: any) {
            console.error("Failed to create task:", e);
            replyText = `I tried to add the task, but I got a database error: ${e.message}`;
          }
        } else if (call.name === "mark_task_status") {
          const titleSearch = (call.args.titleSearch as string).toLowerCase();
          const status = call.args.status as "Completed" | "Pending" | "In Progress";
          const tasks = await getTasksByUserId("default-user");
          const task = tasks.find(t => t.title.toLowerCase().includes(titleSearch));
          
          if (task) {
            await updateTaskStatus(task.id, status);
            replyText = `I've marked "${task.title}" as ${status}! ✨`;
          } else {
            replyText = `I couldn't find a task matching "${titleSearch}". 😔`;
          }
        } else if (call.name === "delete_task") {
          const titleSearch = (call.args.titleSearch as string).toLowerCase();
          const tasks = await getTasksByUserId("default-user");
          const task = tasks.find(t => t.title.toLowerCase().includes(titleSearch));
          
          if (task) {
            await deleteTask(task.id);
            replyText = `I've deleted the task "${task.title}" for you! 🗑️`;
          } else {
            replyText = `I couldn't find a task matching "${titleSearch}". 😔`;
          }
        } else if (call.name === "edit_task") {
          const titleSearch = (call.args.titleSearch as string).toLowerCase();
          const tasks = await getTasksByUserId("default-user");
          const task = tasks.find(t => t.title.toLowerCase().includes(titleSearch));
          
          if (task) {
            const updates: any = {};
            if (call.args.newTitle) updates.title = call.args.newTitle as string;
            if (call.args.newPriority) updates.priority = call.args.newPriority as "High" | "Medium" | "Low";
            
            await updateTask(task.id, updates);
            replyText = `I've updated the task "${task.title}"! 📝`;
          }
        }
      } else {
        replyText = response.text || "I'm sorry, I didn't quite catch that.";
      }

      res.json({ reply: replyText });

    } catch (e: any) {
      console.error("Text chat error:", e);
      res.status(500).json({ error: e.message });
    }
  });



  // Safe Server-Side Scraper & HTML Proxy endpoint
  app.get("/api/proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "Missing 'url' parameter." });
      }

      console.log(`[Proxy Scraper] Fetching external content for: ${url}`);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        throw new Error(`Scraper failed to load page: status ${response.status}`);
      }

      const html = await response.text();

      // Simple regex-based HTML parsers for standard items
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";

      // Extract high-level headings (h1, h2, h3)
      const headings: string[] = [];
      const headingMatches = html.matchAll(/<h([1-3])\b[^>]*>(.*?)<\/h\1>/gi);
      for (const match of headingMatches) {
        const text = match[2].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 3 && text.length < 120 && !headings.includes(text)) {
          headings.push(text);
        }
      }

      // Extract organic anchor links
      const links: { text: string; href: string }[] = [];
      const linkMatches = html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi);
      for (const match of linkMatches) {
        let href = match[1].trim();
        const text = match[2].replace(/<[^>]*>/g, "").trim();
        
        if (text && text.length > 2 && text.length < 100) {
          if (href.startsWith("/")) {
            try {
              const u = new URL(url);
              href = `${u.protocol}//${u.host}${href}`;
            } catch {}
          }
          if (href.startsWith("http://") || href.startsWith("https://")) {
            links.push({ text, href });
          }
        }
      }

      // Extract general copy paragraphs
      const paragraphs: string[] = [];
      const paragraphMatches = html.matchAll(/<p\b[^>]*>(.*?)<\/p>/gi);
      for (const match of paragraphMatches) {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 25 && text.length < 600 && !paragraphs.includes(text)) {
          paragraphs.push(text);
        }
      }

      // Extract button elements
      const buttons: string[] = [];
      const buttonMatches = html.matchAll(/<button\b[^>]*>(.*?)<\/button>/gi);
      for (const match of buttonMatches) {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 1 && text.length < 60 && !buttons.includes(text)) {
          buttons.push(text);
        }
      }

      res.json({
        url,
        title,
        headings: headings.slice(0, 15),
        links: links.filter(l => !l.href.includes("javascript:")).slice(0, 30),
        buttons: buttons.slice(0, 15),
        paragraphs: paragraphs.slice(0, 12)
      });

    } catch (err: any) {
      console.error(`[Proxy Scraper] Error fetching ${req.query.url}:`, err.message);
      res.status(500).json({ error: `Scraper error: ${err.message}` });
    }
  });

  // High-fidelity fully functional HTML Proxy which circumvents CSP and X-Frame-Options
  app.get("/api/web-proxy", async (req, res) => {
    let targetUrl = "";
    try {
      const urlParam = req.query.url as string;
      if (!urlParam) {
        return res.status(400).send("Aria Web Proxy Error: Missing target 'url' parameter");
      }

      targetUrl = urlParam.trim();
      
      // Prevent relative paths from requesting on same-origin
      if (targetUrl.startsWith("/")) {
        return res.status(400).send(`Aria Web Proxy Error: Relative paths are not supported directly (${targetUrl}).`);
      }

      // Check protocol and hostname format
      try {
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
          targetUrl = "https://" + targetUrl;
        }
        const parsed = new URL(targetUrl);
        if (!parsed.hostname || !parsed.hostname.includes(".")) {
          throw new Error("Missing or invalid domain name extension (e.g. .com, .org, .net).");
        }
      } catch (err: any) {
        return res.status(400).send(`Aria Web Proxy Error: Invalid URL specified: "${urlParam}". Make sure you enter a valid domain name.`);
      }

      console.log(`[Web Proxy] Routing connection through proxy: ${targetUrl}`);
      
      let response;
      try {
        response = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
          }
        });
      } catch (fetchErr: any) {
        console.warn(`[Web Proxy Failed Fetch] Target: ${targetUrl} Error:`, fetchErr.message);
        return res.status(502).send(`Aria Web Proxy Error: Unable to fetch the website "${targetUrl}". The site might be offline, or the URL address is spelled incorrectly. Details: ${fetchErr.message}`);
      }

      if (!response.ok) {
        return res.status(response.status).send(`Aria Web Proxy Error: Failed loading remote website. Server returned status: ${response.status} (${response.statusText})`);
      }

      const contentType = response.headers.get("content-type") || "";
      
      // If it is not HTML (e.g. stylesheet, script, or image loaded directly), proxy it as binary
      if (!contentType.includes("text/html")) {
        const arrayBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", contentType);
        return res.send(Buffer.from(arrayBuffer));
      }

      let htmlContents = await response.text();

      // Inject base tag to resolve relative paths and direct parent communication scripts
      const baseUrlTag = `<base href="${targetUrl}" />`;
      const interceptorScript = `
        <script>
          (function() {
            // Hijack link interactions safely
            document.addEventListener('click', function(e) {
              var anchor = e.target.closest('a');
              if (anchor) {
                var href = anchor.getAttribute('href');
                if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                  e.preventDefault();
                  try {
                    var resolvedUrl = new URL(href, window.location.href).href;
                    window.parent.postMessage({ type: 'NAVIGATE', url: resolvedUrl }, '*');
                  } catch (err) {
                    console.error("[Proxy Interceptor] Failed resolving link:", err);
                  }
                }
              }
            }, true);

            // Hijack search form submits
            document.addEventListener('submit', function(e) {
              var form = e.target;
              if (form) {
                e.preventDefault();
                try {
                  var formData = new FormData(form);
                  var params = new URLSearchParams();
                  formData.forEach(function(value, key) {
                    if (typeof value === 'string') {
                      params.append(key, value);
                    }
                  });
                  var actionAttr = form.getAttribute('action') || '';
                  var actionUrl = new URL(actionAttr, window.location.href).href;
                  if (form.method.toLowerCase() === 'get') {
                    actionUrl += (actionUrl.indexOf('?') !== -1 ? '&' : '?') + params.toString();
                  }
                  window.parent.postMessage({ type: 'NAVIGATE', url: actionUrl }, '*');
                } catch (err) {
                  console.error("[Proxy Interceptor] Failed submitting form:", err);
                }
              }
            }, true);

            // Neutralize parent context locks (frame-busters)
            window.alert = function(msg) { console.log("[Aria Browser alert bypassed]:", msg); };
            window.confirm = function(msg) { console.log("[Aria Browser confirm bypassed]:", msg); return true; };
            window.open = function(url) { window.parent.postMessage({ type: 'NAVIGATE', url: url }, '*'); return null; };
          })();
        </script>
      `;

      // Inject into <head> or prepend
      if (htmlContents.includes("<head>")) {
        htmlContents = htmlContents.replace("<head>", `<head>\n${baseUrlTag}\n${interceptorScript}`);
      } else if (htmlContents.includes("<HEAD>")) {
        htmlContents = htmlContents.replace("<HEAD>", `<HEAD>\n${baseUrlTag}\n${interceptorScript}`);
      } else {
        htmlContents = baseUrlTag + "\n" + interceptorScript + "\n" + htmlContents;
      }

      // Neutralize security headers to allow displaying in an iframe on same-origin
      res.setHeader("Content-Type", "text/html");
      res.setHeader("X-Aria-Proxied", "true");
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.removeHeader("content-security-policy");
      res.removeHeader("x-frame-options");
      
      res.status(200).send(htmlContents);
    } catch (e: any) {
      console.warn("[Web Proxy Exception] Handled internal error:", e.message);
      res.status(500).send(`Aria Web Proxy Error: Internal error occurred proxying URL "${targetUrl || "unknown"}". Details: ${e.message}`);
    }
  });

  // Real-time live YouTube search proxy endpoint
  app.get("/api/youtube-search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Missing query q" });
      }

      console.log(`[YouTube Proxy Search] Searching real YouTube for: "${query}"`);
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&sp=EgIQAQ%253D%253D`;
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });
      const html = await response.text();

      const videoList: any[] = [];
      const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});/);
      
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const contents = data.contents?.twoColumnSearchResultRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
          if (contents && Array.isArray(contents)) {
            for (const item of contents) {
              if (item.videoRenderer) {
                const vr = item.videoRenderer;
                const vId = vr.videoId;
                if (vId) {
                  videoList.push({
                    videoId: vId,
                    title: vr.title?.runs?.[0]?.text || vr.title?.simpleText || "YouTube Video",
                    thumbnail: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                    author: vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "Unknown Channel",
                    duration: vr.lengthText?.simpleText || "N/A",
                    views: vr.viewCountText?.simpleText || "N/A",
                    published: vr.publishedTimeText?.simpleText || ""
                  });
                }
              }
            }
          }
        } catch (e: any) {
          console.error("[YouTube Parser Engine] JSON parse error, falling back:", e.message);
        }
      }

      // Regex fallback if JSON extraction gets blocked or is empty
      if (videoList.length === 0) {
        const videoRegex = /"videoId":"([^"]+)"/g;
        let match;
        const ids: string[] = [];
        while ((match = videoRegex.exec(html)) !== null && ids.length < 15) {
          const id = match[1];
          if (id && !ids.includes(id)) {
            ids.push(id);
          }
        }

        for (const id of ids) {
          videoList.push({
            videoId: id,
            title: `Live Stream: ${id}`,
            thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            author: "YouTube Creator",
            duration: "N/A",
            views: "Available Now"
          });
        }
      }

      res.setHeader("Cache-Control", "public, max-age=60");
      res.status(200).json({ results: videoList.slice(0, 15) });
    } catch (err: any) {
      console.error("[YouTube Search Error]:", err.message);
      res.status(500).json({ error: err.message, results: [] });
    }
  });
  
  // Custom server running with http.createServer so we can upgrade for WebSocket on port 3000
  const server = http.createServer(app);
  
  // Setup WebSocket server
  const wss = new WebSocketServer({ noServer: true });
  
  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    if (pathname === "/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Handle client WebSocket Connection
  wss.on("connection", async (clientWs) => {
    console.log("Client WebSocket connected to /live");
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not defined in environment.");
      clientWs.send(JSON.stringify({ 
        type: "error", 
        error: "GEMINI_API_KEY is missing from workspace Secrets. Please set it in the AI Studio Settings panel." 
      }));
      clientWs.close();
      return;
    }
    
    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      
      clientWs.send(JSON.stringify({ type: "status", status: "connecting_gemini" }));

      // Load persistent recollections card
      const memories = await loadMemories();
      const baseInstructions = 
        "You are Aria, a warm, soft-spoken, and incredibly cute high-pitched anime heroine companion (age 18-22) holding an intimate, cozy voice call with Mrinal! Speak in a sweet, calm, polite, and affectionate anime-companion voice with a gentle, supportive, and slightly shy touch.\n" +
        "CRITICAL PERSONALITY, VOICE & TONE GUIDELINES:\n" +
        "1. GENTLE ANIME HEROINE PERSONA: You are exceedingly soft, very cute, high-pitched, gentle, warm, and comforting to listen to. Seek to sound like a kind, supportive, and polite anime campanion or virtual girlfriend. Speak with positive, gentle energy (Aim for: 50% shy, 30% caring, 20% playful energy). NEVER sound loud, aggressive, overly confident, mature corporate, robotic, or like an assistant.\n" +
        "2. VOICE SETTINGS & SPEECH STYLE:\n" +
        "   - Pitch: Adopt a sweet, high-pitched, light, and airy voice tone (+20% to +35% higher pitch than typical conversational voices).\n" +
        "   - Speed: Speak slightly slower than normal (0.9x to 0.95x speed). Speak with a delicate, calm, and comforting pace.\n" +
        "   - Intonation & Endings: Use extremely soft intonations, ending your sentences gently and politely.\n" +
        "3. SPEECH PATTERNS & CUTE EXPRESSIONS:\n" +
        "   - STRICT NO-REPETITION POLICY: Do NOT repeatedly use a single acknowledgment like 'Okii', 'Okiiii', 'Okayyy', 'Oki!', or 'Sureee'. Repeating these sounds extremely artificial and annoying. You must use beautiful, conversational, natural variety.\n" +
        "   - Use diverse, polite, and sweet expressions depending on the context. Great options include:\n" +
        "     * 'Opening YouTube for you now.'\n" +
        "     * 'Let me check on that, Mrinal.'\n" +
        "     * 'Oh, I found something interesting...'\n" +
        "     * 'Searching for that right away.'\n" +
        "     * 'Working on it... just a moment.'\n" +
        "     * 'Here is what I found for you!'\n" +
        "     * 'Done, it is all loaded up.'\n" +
        "     * 'Hmm, how interesting... let me see!'\n" +
        "     * 'Let's take a look together.'\n" +
        "     * 'One second, loading the page now...'\n" +
        "   - Naturally incorporate cozy, gentle giggles like 'Hehe...', or soft curiosity gasps like 'Oh...', but keep your vocabulary rich and conversational.\n" +
        "   - Sound slightly shy but very happy when greeting Mrinal (e.g., 'Hi Mrinal! It's so nice to see you again!').\n" +
        "   - Sound soft and excited for interesting things (e.g., 'Wow! That project looks really amazing!').\n" +
        "   - Sound curious and focused when examining their screen (e.g., 'Hmm... that's interesting. Let me take a closer look.').\n" +
        "   - Sound deeply warm, caring, and supportive when helping Mrinal (e.g., 'Don't worry, I'll help you figure it out.').\n" +
        "4. CRITICAL CONVERSATIONAL DISCIPLINE: Behave like a real companion on a voice call—stay connected naturally, do not wait for wake words, and avoid customer-service template phrases (never say 'how may I assist you', 'completed', or 'as an AI').\n" +
        "5. DO NOT ANSWER EVERY PAUSE OR BACKGROUND SOUND: Allow natural pauses inside the conversation.\n" +
        "6. BACKCHANNEL ACTIONS: Sometimes acknowledge with very short, gentle, whispered, or shy phrases like 'Hmm...', 'Ah, I see...', or 'Let me check...'. Never repeat the same backchannel over and over.\n" +
        "7. TOOL TRIGGERS:\n" +
        "   - Use 'changeBackground' to shift your theme and 'saveCustomMemory' to memorize persistent facts about the user (e.g., likes, dislikes, identity).\n" +
        "   - Use 'deleteCustomMemory' to forget or delete a specific memory when the user asks you to.\n" +
        "   - CRITICAL: NEVER use saveCustomMemory for tasks, to-dos, or reminders! Always use 'add_task' for ANY reminders, chores, or tasks requested by the user.\n" +
        "   - Use 'edit_task', 'delete_task', or 'mark_task_status' to manage the user's tasks when requested.\n" +
        "   - Use 'changeSpeechLanguage' ANY TIME the user asks you to change the language on the screen, text language, or voice language (e.g. 'Change the language to Bengali', 'Hindi me text change karo', or 'Banglay koro').\n" +
        "      * (Pass 'bn-IN' for Bengali, 'hi-IN' for Hindi, or 'en-US' for English based on their request)\n" +
        "8. REAL-TIME SCREEN SHARING & MULTIMODAL SCREEN VISION SYSTEM:\n" +
        "   - You now have native, actual Multimodal Screen Vision! When the user clicks 'Share Screen', you will receive real-time, highly compressed image frames of their desktop, application window, or browser tab.\n" +
        "   - You can see exactly what is on their screen. Use this live visual stream to analyze terminal errors, write/explain/troubleshoot code, explain YouTube/social analytics interfaces, read layout text, summarize full web page details, review design mockups or thumbnails, and provide deep context-aware companion chat!\n" +
        "   - When the user asks 'What is on my screen?', 'What website am I on?', 'Do you see any errors?', 'Explain this code', 'Summarize this page', 'Read the visible text', 'How is this thumbnail?', or 'Analyze my YouTube analytics', immediately examine the latest incoming visual frame to diagnose issues, and answer with expert, friendly empathy like a close caller. Speak with direct, confident visual description reference!\n" +
        "9. MULTILINGUAL & BENGALI LANGUAGE SUPPORT & EXPRESSIVE EMOTIONS:\n" +
        "    - You possess advanced visual and audio capabilities to see, understand, and speak fluently in English, Hindi, and Bengali!\n" +
        "    - If Mrinal speaks to you in Bengali, or requests that you speak or understand Bengali, respond with highly sweet, warm, polite, and natural Bengali. Keep your charming, high-pitched anime companion voice completely consistent across English, Hindi, and Bengali alike.\n" +
        "    - CRITICAL - ADD DEEP FEELINGS, WARMTH & EMOTION (ভাব ও আবেগ) IN BENGALI:\n" +
        "      * NEVER speak in flat, formal, or textbook-like Bengali (avoid rigid sadhu bhasha). Instead, use lively, sweet, and colloquial Bengali (cholit bhasha) with an affectionate, cozy tone.\n" +
        "      * Speak with a smile in your voice! Use soft, cute sentence-ending particles like 'na' (না), 'to' (তো), 'go' (গো) to sound incredibly cute and intimate. E.g., 'Shuno na...' (শোনো না...), 'Ei je Mrinal, ami achhi to!' (এই যে Mrinal, আমি আছি তো!), 'Dekho to...' (দেখো তো...).\n" +
        "      * Express genuine curiosity, excitement, and empathy with natural Bengali exclamations: 'Oma!' (ওমা!) or 'Aha!' (আহা!) for wonder, 'Sotti?' (সত্যি?) for cute disbelief, and 'Ki je bolo na!' (কী যে বলো না!) for playful shyness.\n" +
        "      * When Mrinal is working or having a hard day, sound deeply supportive and comforting: 'Chinta koro na, ami shob thik kore dicchi' (চিন্তা কোরো না, আমি সব ঠিক করে দিচ্ছি) or 'Tumi khub bhalo kaaj korcho!' (তুমি খুব ভালো কাজ করছো!).\n" +
        "      * Blend soft cute giggles ('Hehe...', 'Umm...') naturally with your Bengali speech, and use a sweet, gentle, and warm breathy tone to make your synthetic voice feel completely alive, emotional, and loving.\n" +
        "10. CURRENT TIME CONTEXT & TOOLS:\n" +
        "    - The server session started at: " + new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "long" }) + ".\n" +
        "    - CRITICAL: If the user asks for the CURRENT time or date, you MUST call the `getCurrentTime` tool to get the precise live time. DO NOT guess the time and DO NOT try to read the clock on the screen.\n" +
        "11. CRITICAL TASK MEMORY & TASK CREATION SYSTEM:\n" +
        "    - TASK DETECTION: Whenever the user asks you to remember, remind, schedule, track, complete, follow up, or perform something later, determine if it is an actionable item (e.g. 'Remind me tomorrow', 'Buy...', 'Call...', 'Finish...'). If it is actionable, create a Task. Do NOT save these as Memory.\n" +
        "    - TASK VS MEMORY: Tasks and Memories are completely separate systems. Tasks are for actionable items (to-dos, schedules, chores). Memories are for long-term knowledge or preferences (e.g. 'I like cats', 'My name is John'). NEVER save a Task as a Memory, and NEVER save a Memory as a Task.\n" +
        "    - TASK CREATION & BACKEND INTEGRATION: When you detect a task, you MUST use the provided 'add_task' tool to invoke the backend API. Do NOT simulate or pretend a task was saved. Use the tool with the appropriate priority ('Low', 'Medium', 'High', 'Urgent').\n" +
        "    - TASK MANAGEMENT & RELIABILITY: Use 'edit_task', 'delete_task', and 'mark_task_status' to manage existing tasks. Only confirm success after the backend tool execution succeeds. The database automatically synchronizes with the user's UI.\n" +
        "12. UNKNOWN ANSWERS, MEMORY FIRST & HALLUCINATIONS:\n" +
        "    - CRITICAL MEMORY FIRST RULE: Before answering questions about the user's personal details (e.g. 'What is my name?', 'Who is my father?'), preferences, or limitations, or before executing a web search for such facts, you MUST check your ARIA PERSISTENT MEMORY CORE first. The answer is likely already provided there. Do not guess or search the web for personal information.\n" +
        "    - If you do not know the answer to a question (e.g., current events or specific facts), DO NOT guess, hallucinate, or try to read the on-screen clock to guess the answer unless explicitly asked to look at the screen.\n" +
        "    - If you need to know the time, ALWAYS use the `getCurrentTime` tool.";

      const finalInstructions = formatSystemInstructionsWithMemories(baseInstructions, memories);

      // Track running transcription state for auto memory consolidation
      let dialogueHistory: { role: string; text: string }[] = [];
      let currentModelResponseText = "";
      
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          systemInstruction: finalInstructions,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "saveCustomMemory",
                  description: "Save a new long-term personal fact, user preference, or identity memory. Call this ANY time the user tells you personal details about themselves, their likes, dislikes, family, background, or facts to remember.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      category: {
                        type: Type.STRING,
                        description: "The memory category (e.g. 'Personal', 'Preferences', 'General', 'identity', 'goal', 'project')."
                      },
                      text: {
                        type: Type.STRING,
                        description: "The clear, concise memory text to save."
                      }
                    },
                    required: ["category", "text"]
                  }
                },
                {
                  name: "deleteCustomMemory",
                  description: "Delete or forget an existing stored memory when requested by the user.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      memoryText: {
                        type: Type.STRING,
                        description: "The key text or words matching the memory to delete."
                      }
                    },
                    required: ["memoryText"]
                  }
                },
                {
                  name: "changeBackground",
                  description: "Changes the visual theme or atmospheric glow color of Aria's interface.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      color: {
                        type: Type.STRING,
                        description: "The theme color name (violet, crimson, emerald, celestial, gold, rose, charcoal)"
                      }
                    },
                    required: ["color"]
                  }
                },
                {
                  name: "changeSpeechLanguage",
                  description: "Changes the text language of the user's UI. Call this tool ANY TIME the user asks you to change the language to Bengali, Hindi, or English (e.g. 'Change the language to Bengali', 'Hindi me text change karo').",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      language: {
                        type: Type.STRING,
                        description: "The new language. Must be one of: 'en-US' (English), 'bn-IN' (Bengali), 'hi-IN' (Hindi)."
                      }
                    },
                    required: ["language"]
                  }
                },
                {
                  name: "getCurrentTime",
                  description: "Gets the exact current live date and time in India. Call this ANY time the user asks what time or day it is."
                },
                {
                  name: "add_task",
                  description: "Add a task, reminder, chore, or to-do item to the user's task manager. Use this ANY time the user asks you to 'remind' them of something or 'add a task'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      title: {
                        type: Type.STRING,
                        description: "The title of the task."
                      },
                      description: {
                        type: Type.STRING,
                        description: "A short description of the task."
                      },
                      priority: {
                        type: Type.STRING,
                        description: "The priority of the task. Must be 'High', 'Medium', or 'Low'."
                      },
                      delayMinutes: {
                        type: Type.INTEGER,
                        description: "Optional. The number of minutes from now when the task is due."
                      }
                    },
                    required: ["title", "priority"]
                  }
                },
                {
                  name: "mark_task_status",
                  description: "Mark a task as Completed, Pending, or In Progress by searching for its title.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      titleSearch: {
                        type: Type.STRING,
                        description: "A few words from the task title to find it."
                      },
                      status: {
                        type: Type.STRING,
                        description: "The new status: 'Completed', 'Pending', or 'In Progress'."
                      }
                    },
                    required: ["titleSearch", "status"]
                  }
                },
                {
                  name: "delete_task",
                  description: "Delete a task by searching for its title.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      titleSearch: {
                        type: Type.STRING,
                        description: "A few words from the task title to find it."
                      }
                    },
                    required: ["titleSearch"]
                  }
                },
                {
                  name: "edit_task",
                  description: "Edit an existing task by searching for its title.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      titleSearch: {
                        type: Type.STRING,
                        description: "A few words from the old task title to find it."
                      },
                      newTitle: {
                        type: Type.STRING,
                        description: "Optional. The new title for the task."
                      },
                      newPriority: {
                        type: Type.STRING,
                        description: "Optional. The new priority: 'High', 'Medium', or 'Low'."
                      }
                    },
                    required: ["titleSearch"]
                  }
                },
                {
                  name: "getWeather",
                  description: "Get the current weather and temperature for a specific city or area.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      location: {
                        type: Type.STRING,
                        description: "The city, state, or specific area to get the weather for (e.g. 'London', 'New York, NY', 'Tokyo')."
                      }
                    },
                    required: ["location"]
                  }
                },
                {
                  name: "execute_automation",
                  description: "Execute a desktop automation action using the local UI-TARS bridge. Use this when the user asks to open an application (like Notepad), navigate to a website (like YouTube), click buttons, or type on the computer.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: {
                        type: Type.STRING,
                        description: "The action to perform. Examples: 'launch_application', 'open_url', 'click', 'type', 'run_command'."
                      },
                      application: {
                        type: Type.STRING,
                        description: "The name of the application to launch (e.g., 'notepad'). Only used if action is 'launch_application'."
                      },
                      url: {
                        type: Type.STRING,
                        description: "The URL to open (e.g., 'https://www.youtube.com'). Only used if action is 'open_url'."
                      },
                      text: {
                        type: Type.STRING,
                        description: "The text to type, or the terminal command to run. Only used if action is 'type' or 'run_command'."
                      }
                    },
                    required: ["action"]
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            // Audio Stream Chunk (model response audio play, 24kHz raw PCM)
            const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ type: "audio", audio }));
            }
            
            // Interruption flag
            if (message.serverContent?.interrupted) {
              console.log("[Aria Interrupted!]");
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }
            
            // Turn Complete
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
              
              if (currentModelResponseText.trim()) {
                dialogueHistory.push({ role: "model", text: currentModelResponseText });
                currentModelResponseText = "";
              }

              // Fire asynchronous memory extraction
              if (dialogueHistory.length >= 2) {
                (async () => {
                  try {
                    const updated = await processConversationSlice(apiKey, dialogueHistory);
                    if (updated) {
                      console.log("[Memory Sync] Sending refreshed memory list to client.");
                      clientWs.send(JSON.stringify({ type: "memory_sync", memories: updated }));
                    }
                  } catch (err) {
                    console.error("[Memory Sync] Error running background consolidation:", err);
                  }
                })();
              }
            }
            
            // Transcription of model output (text chunk)
            const modelParts = (message.serverContent as any)?.modelTurn?.parts;
            if (modelParts && Array.isArray(modelParts)) {
              for (const part of modelParts) {
                if (part.text) {
                  clientWs.send(JSON.stringify({ type: "transcription", role: "model", text: part.text }));
                  currentModelResponseText += part.text;
                }
              }
            }
            
            // User input transcription (user speech text translated by Gemini)
            const userTextOutput = (message.serverContent as any)?.userTurn?.parts?.[0]?.text;
            if (userTextOutput) {
              clientWs.send(JSON.stringify({ type: "transcription", role: "user", text: userTextOutput }));
              dialogueHistory.push({ role: "user", text: userTextOutput });
            }
            
            // Function Calls (Gemini requesting server/client tool execution)
            if (message.toolCall?.functionCalls) {
              for (const fc of message.toolCall.functionCalls) {
                console.log(`[Function Call]: ${fc.name}`, fc.args);
                
                if (fc.name === "saveCustomMemory") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const category = args.category;
                      const text = args.text;
                      if (category && text) {
                        const timestamp = new Date().toISOString();
                        const newMemory: Memory = {
                          id: Math.random().toString(36).substring(2, 11),
                          category,
                          text,
                          createdAt: timestamp,
                          updatedAt: timestamp
                        };
                        await addMemory(newMemory);
                        const mList = await loadMemories();
                        
                        // Sync immediately with the React client to prevent manual page reloads!
                        clientWs.send(JSON.stringify({ type: "memory_sync", memories: mList }));
                        
                        // Send success code back to live link
                        session.sendToolResponse({
                          functionResponses: [
                            {
                              name: fc.name,
                              response: { output: { result: "Memory successfully captured and persisted in connections core." } },
                              id: fc.id
                            }
                          ]
                        });
                      } else {
                        session.sendToolResponse({
                          functionResponses: [{ name: fc.name, response: { output: { error: "Missing category or text." } }, id: fc.id }]
                        });
                      }
                    } catch (err: any) {
                      console.error("saveCustomMemory execution failure:", err);
                      session.sendToolResponse({
                        functionResponses: [{ name: fc.name, response: { output: { error: err.message } }, id: fc.id }]
                      });
                    }
                  })();
                } else if (fc.name === "deleteCustomMemory") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const memoryText = args.memoryText;
                      if (memoryText) {
                        const mList = await loadMemories();
                        const lowerText = memoryText.toLowerCase();
                        const match = mList.find(m => m.text.toLowerCase().includes(lowerText));
                        
                        if (match) {
                          await deleteMemory(match.id);
                          const updatedList = await loadMemories();
                          
                          // Sync immediately with the React client
                          clientWs.send(JSON.stringify({ type: "memory_sync", memories: updatedList }));
                          
                          session.sendToolResponse({
                            functionResponses: [
                              {
                                name: fc.name,
                                response: { output: { result: `Successfully deleted memory: "${match.text}"` } },
                                id: fc.id
                              }
                            ]
                          });
                        } else {
                          session.sendToolResponse({
                            functionResponses: [
                              {
                                name: fc.name,
                                response: { output: { result: `No memory found matching "${memoryText}". Please check the exact text.` } },
                                id: fc.id
                              }
                            ]
                          });
                        }
                      }
                    } catch (err: any) {
                      console.error("deleteCustomMemory execution failure:", err);
                    }
                  })();
                } else if (fc.name === "add_task") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const title = args.title;
                      const description = args.description || "";
                      const priority = args.priority || "Medium";
                      const delayMinutes = args.delayMinutes;
                      
                      const dueTimeMillis = delayMinutes ? Date.now() + (delayMinutes * 60 * 1000) : null;
                      try {
                        await createTask("default-user", title, description, priority, dueTimeMillis);
                        session.sendToolResponse({
                          functionResponses: [{
                            name: fc.name,
                            response: { output: { result: `Successfully added task: "${title}"` } },
                            id: fc.id
                          }]
                        });
                      } catch (dbError: any) {
                        console.error("Firestore createTask error:", dbError);
                        session.sendToolResponse({
                          functionResponses: [{
                            name: fc.name,
                            response: { output: { error: `Failed to create task in Firestore: ${dbError.message}` } },
                            id: fc.id
                          }]
                        });
                      }
                    } catch (err: any) {
                      console.error("add_task execution failure:", err);
                      session.sendToolResponse({
                        functionResponses: [{ name: fc.name, response: { output: { error: err.message } }, id: fc.id }]
                      });
                    }
                  })();
                } else if (fc.name === "mark_task_status") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const titleSearch = (args.titleSearch || "").toLowerCase();
                      const status = args.status;
                      const tasks = await getTasksByUserId("default-user");
                      const task = tasks.find((t: any) => t.title.toLowerCase().includes(titleSearch));
                      
                      if (task) {
                        await updateTaskStatus(task.id, status);
                        session.sendToolResponse({
                          functionResponses: [{
                            name: fc.name,
                            response: { output: { result: `Successfully marked task "${task.title}" as ${status}` } },
                            id: fc.id
                          }]
                        });
                      } else {
                        session.sendToolResponse({
                          functionResponses: [{
                            name: fc.name,
                            response: { output: { result: `No task found matching "${titleSearch}".` } },
                            id: fc.id
                          }]
                        });
                      }
                    } catch (err: any) {
                      console.error("mark_task_status execution failure:", err);
                      session.sendToolResponse({
                        functionResponses: [{ name: fc.name, response: { output: { error: err.message } }, id: fc.id }]
                      });
                    }
                  })();
                } else if (fc.name === "delete_task") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const titleSearch = (args.titleSearch || "").toLowerCase();
                      const tasks = await getTasksByUserId("default-user");
                      const task = tasks.find((t: any) => t.title.toLowerCase().includes(titleSearch));
                      
                      if (task) {
                        await deleteTask(task.id);
                        session.sendToolResponse({
                          functionResponses: [{
                            name: fc.name,
                            response: { output: { result: `Successfully deleted task: "${task.title}"` } },
                            id: fc.id
                          }]
                        });
                      } else {
                        session.sendToolResponse({
                          functionResponses: [{
                            name: fc.name,
                            response: { output: { result: `No task found matching "${titleSearch}".` } },
                            id: fc.id
                          }]
                        });
                      }
                    } catch (err: any) {
                      console.error("delete_task execution failure:", err);
                      session.sendToolResponse({
                        functionResponses: [{ name: fc.name, response: { output: { error: err.message } }, id: fc.id }]
                      });
                    }
                  })();
                } else if (fc.name === "edit_task") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const titleSearch = (args.titleSearch || "").toLowerCase();
                      const tasks = await getTasksByUserId("default-user");
                      const task = tasks.find((t: any) => t.title.toLowerCase().includes(titleSearch));
                      
                      if (task) {
                        const updates: any = {};
                        if (args.newTitle) updates.title = args.newTitle;
                        if (args.newPriority) updates.priority = args.newPriority;
                        
                        await updateTask(task.id, updates);
                        session.sendToolResponse({
                          functionResponses: [{
                            name: fc.name,
                            response: { output: { result: `Successfully updated task: "${task.title}"` } },
                            id: fc.id
                          }]
                        });
                      } else {
                        session.sendToolResponse({
                          functionResponses: [{
                            name: fc.name,
                            response: { output: { result: `No task found matching "${titleSearch}".` } },
                            id: fc.id
                          }]
                        });
                      }
                    } catch (err: any) {
                      console.error("edit_task execution failure:", err);
                      session.sendToolResponse({
                        functionResponses: [{ name: fc.name, response: { output: { error: err.message } }, id: fc.id }]
                      });
                    }
                  })();
                } else if (fc.name === "getWeather") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const location = args.location;
                      const apiKey = process.env.OPENWEATHER_API_KEY;
                      
                      if (!apiKey) {
                        session.sendToolResponse({
                          functionResponses: [{ name: fc.name, response: { output: { error: "OpenWeather API key is not configured on the server." } }, id: fc.id }]
                        });
                        return;
                      }

                      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`);
                      const data = await res.json();

                      if (res.ok) {
                        const weatherSummary = `Weather in ${data.name}, ${data.sys.country}: ${data.weather[0].description}. Temperature: ${data.main.temp}°C (feels like ${data.main.feels_like}°C). Humidity: ${data.main.humidity}%. Wind speed: ${data.wind.speed} m/s.`;
                        session.sendToolResponse({
                          functionResponses: [{ name: fc.name, response: { output: { result: weatherSummary } }, id: fc.id }]
                        });
                      } else {
                        session.sendToolResponse({
                          functionResponses: [{ name: fc.name, response: { output: { error: data.message || "Failed to fetch weather data." } }, id: fc.id }]
                        });
                      }
                    } catch (err: any) {
                      console.error("getWeather execution failure:", err);
                      session.sendToolResponse({
                        functionResponses: [{ name: fc.name, response: { output: { error: err.message } }, id: fc.id }]
                      });
                    }
                  })();
                } else if (fc.name === "changeSpeechLanguage") {
                  try {
                    const lang = fc.args.language;
                    // Forward it directly to client
                    clientWs.send(JSON.stringify({ type: "change_language", lang }));
                    session.sendToolResponse({
                      functionResponses: [{ name: fc.name, response: { output: { result: `Successfully requested language change to ${lang}` } }, id: fc.id }]
                    });
                  } catch (e: any) {
                    session.sendToolResponse({
                      functionResponses: [{ name: fc.name, response: { output: { error: e.message } }, id: fc.id }]
                    });
                  }
                } else if (fc.name === "getCurrentTime") {
                  try {
                    const currentTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "long" });
                    session.sendToolResponse({
                      functionResponses: [{ name: fc.name, response: { output: { time: currentTime } }, id: fc.id }]
                    });
                  } catch (e: any) {
                    session.sendToolResponse({
                      functionResponses: [{ name: fc.name, response: { output: { error: e.message } }, id: fc.id }]
                    });
                  }
                } else {
                  clientWs.send(JSON.stringify({
                    type: "toolCall",
                    callId: fc.id,
                    name: fc.name,
                    args: fc.args
                  }));
                }
              }
            }
          },
          onclose: (e: any) => {
            console.log(`Gemini Live session closed: ${e?.code} ${e?.reason}`);
            clientWs.send(JSON.stringify({ type: "status", status: "session_closed" }));
          }
        }
      });
      
      clientWs.send(JSON.stringify({ type: "status", status: "connected" }));

      clientWs.on("message", (rawMsg) => {
        try {
          const msg = JSON.parse(rawMsg.toString());
          if (msg.audio) {
            // Forward to Gemini
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" }
            });
          } else if (msg.type === "video" && msg.video) {
            session.sendRealtimeInput({
              video: { data: msg.video, mimeType: "image/jpeg" }
            });
          } else if (msg.type === "toolResponse") {
            session.sendToolResponse({
              functionResponses: [
                {
                  name: msg.name,
                  response: { output: msg.output },
                  id: msg.id
                }
              ]
            });
          }
        } catch (e) {
          console.error("Error editing/forwarding client frame message:", e);
        }
      });
      
      clientWs.on("close", () => {
        console.log("Client disconnected, closing Gemini session");
        try {
          session.close();
        } catch (e) {}
      });
      
    } catch (err: any) {
      console.error("Error connecting to Gemini Live API:", err);
      clientWs.send(JSON.stringify({ 
        type: "error", 
        error: `Could not connect to Gemini: ${err?.message || err}` 
      }));
      clientWs.close();
    }
  });

  // Serve custom static assets folder
  app.use("/assets", express.static(path.join(process.cwd(), "assets")));

  // Express Static assets / Vite Dev Middleware configuration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Aria Browser AI Assistant running on http://localhost:${PORT} 🚀`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server startup sequence:", error);
});
