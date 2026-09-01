// LLM Provider types, tool schemas, robust retry logic, and custom model persistence

export type LLMProvider = "databricks" | "openai" | "gemini" | "anthropic" | "ollama" | "custom";

export type LLMModelConfig = {
  id: string;
  name: string;
  provider: LLMProvider;
  isReasoning: boolean;
  contextWindow?: number;
  customBaseUrl?: string;
  customApiKey?: string;
  isCustom?: boolean;
};

export const DEFAULT_AVAILABLE_MODELS: LLMModelConfig[] = [
  { id: "env-default", name: "Default API & Model (.env)", provider: "custom", isReasoning: false },
  { id: "gpt-4o", name: "OpenAI GPT-4o", provider: "openai", isReasoning: false },
  { id: "o3-mini", name: "OpenAI o3-mini (Reasoning)", provider: "openai", isReasoning: true },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1 (Reasoning)", provider: "openai", isReasoning: true },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "gemini", isReasoning: false },
  { id: "gemini-2.0-flash-thinking-exp-01-21", name: "Gemini 2.0 Flash Thinking", provider: "gemini", isReasoning: true },
  { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet (Thinking)", provider: "anthropic", isReasoning: true },
  { id: "databricks-meta-llama-3-3-70b-instruct", name: "Databricks Llama 3.3 70B", provider: "databricks", isReasoning: false },
  { id: "databricks-genie-agent", name: "Databricks Genie Agent", provider: "databricks", isReasoning: true },
  { id: "llama3.3", name: "Ollama Local Llama 3.3", provider: "ollama", isReasoning: false },
];

export const AVAILABLE_MODELS = DEFAULT_AVAILABLE_MODELS;

const CUSTOM_MODELS_KEY = "cg_custom_models";

export function getStoredCustomModels(): LLMModelConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_MODELS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse custom models from localStorage", e);
    return [];
  }
}

export function saveStoredCustomModels(models: LLMModelConfig[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(models));
    window.dispatchEvent(new Event("cg-custom-models-updated"));
  } catch (e) {
    console.error("Failed to save custom models", e);
  }
}

export const LLM_TOOLS = [
  {
    type: "function",
    function: {
      name: "query_lakehouse_sql",
      description: "Execute a SQL query on Databricks Unity Catalog Delta tables in schema 'workspace.campus_explorer' (campus_events, campus_surveys, knowledge_sources, clubs_and_labs, city_tech_events, alumni_career_pathways, procurement_inventory) to retrieve live event details, club openings, survey votes, and alumni paths.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The SQL statement to execute, e.g. SELECT * FROM workspace.campus_explorer.campus_events ORDER BY event_date ASC LIMIT 10",
          },
          explanation: {
            type: "string",
            description: "Brief reason why this query is executed",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_sources",
      description: "Search campus policy documents, student handbooks, syllabi, and club funding guidelines stored in Databricks Lakehouse knowledge base.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search keyword or phrase",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_events_grid",
      description: "Render interactive campus event cards in the chat UI with click-to-open detail modal and event pass registration.",
      parameters: {
        type: "object",
        properties: {
          eventIds: {
            type: "array",
            items: { type: "string" },
            description: "List of event IDs from workspace.campus_explorer.campus_events to display, e.g. ['EV-01', 'EV-10']",
          },
          summary: {
            type: "string",
            description: "Brief summary of why these events were chosen",
          },
        },
        required: ["eventIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_questions",
      description: "Ask the student clarifying multiple-choice or checkbox questions using the interactive step-by-step ApprovalCard component to refine preferences, dietary needs, event tracks, or schedule constraints.",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                q: { type: "string", description: "Question prompt" },
                type: { type: "string", enum: ["radio", "check"], description: "Selection type: 'radio' for single choice, 'check' for multiple choices" },
                options: { type: "array", items: { type: "string" }, description: "List of choices for the student" },
              },
              required: ["q", "type", "options"],
            },
          },
        },
        required: ["questions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_approval_card",
      description: "Display an action confirmation approval card to the student (e.g. 'Want me to place this restock order?', 'Confirm RSVP & Add to Google Calendar', 'Submit Research Lab Application').",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Card header title, e.g. 'Want me to place this restock order?' or 'RSVP Confirmation: ACM Systems & Pizza'",
          },
          description: {
            type: "string",
            description: "Details of the action to be performed",
          },
          itemName: {
            type: "string",
            description: "Name of item, club, or event",
          },
          quantityOrDate: {
            type: "string",
            description: "Quantity or date/time details",
          },
          costOrLocation: {
            type: "string",
            description: "Cost or venue location",
          },
          actionLabel: {
            type: "string",
            description: "Button label, e.g. 'Approve Order', 'Confirm RSVP', 'Submit'",
          },
        },
        required: ["title", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_fine_tune_card",
      description: "Display a slider parameter fine-tuning card to the student (e.g. 'How many flavors should we launch?', 'Adjust Extroversion vs Introvert Focus', 'Commitment Bandwidth (hrs/wk)', 'Bengaluru City Distance Radius').",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Card title, e.g. 'How many flavors should we launch?' or 'Weekly Commitment Bandwidth'",
          },
          min: {
            type: "number",
            description: "Minimum slider value",
          },
          max: {
            type: "number",
            description: "Maximum slider value",
          },
          defaultValue: {
            type: "number",
            description: "Initial value",
          },
          unit: {
            type: "string",
            description: "Unit, e.g. 'flavors', 'hrs/week', 'km', 'events'",
          },
          description: {
            type: "string",
            description: "Context explaining what moving the slider accomplishes",
          },
        },
        required: ["title", "min", "max", "defaultValue"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_recommendation_card",
      description: "Display a high-match campus club, research lab, or city meetup recommendation card.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event / club title" },
          category: { type: "string", description: "Category, e.g. 'AI Meetup', 'Hackathon', 'Research Lab'" },
          matchScore: { type: "string", description: "Match percentage, e.g. '98% Match'" },
          description: { type: "string", description: "Why this matches the student persona" },
          time: { type: "string", description: "Time / date" },
          location: { type: "string", description: "Location" },
          actionLabel: { type: "string", description: "Action button label, e.g. 'RSVP Now', 'Apply to Lab'" },
        },
        required: ["title", "matchScore", "description"],
      },
    },
  },
];

// Helper to execute fetch with exponential backoff auto-retry
export async function fetchWithAutoRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  initialDelayMs = 1000
): Promise<Response> {
  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      const response = await fetch(url, options);

      // Retry on 429 Too Many Requests, 500, 502, 503, 504
      if (
        (response.status === 429 || (response.status >= 500 && response.status <= 504)) &&
        attempt < maxRetries
      ) {
        attempt++;
        console.warn(`[Auto-Retry] Request to ${url} returned ${response.status}. Retrying in ${delay}ms (Attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // exponential backoff
        continue;
      }

      return response;
    } catch (err: any) {
      if (options.signal?.aborted || err?.name === "AbortError") throw err;
      if (attempt < maxRetries) {
        attempt++;
        console.warn(`[Auto-Retry] Network error on ${url}: ${err?.message}. Retrying in ${delay}ms (Attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}
