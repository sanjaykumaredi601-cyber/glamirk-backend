import OpenAI from 'openai';

// Step 1: Verify ENV and initialize
let openai = null;
if (process.env.OPENROUTER_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });
  console.log('[AI Service] OpenRouter SDK initialized successfully.');
} else {
  console.warn('[AI Service] WARNING: OPENROUTER_API_KEY missing from environment. AI features will fallback to local generation. Server will not crash.');
}

const MODEL = 'deepseek/deepseek-chat-v3-0324:free';

// Helper for retries and delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const executeWithRetry = async (fn, maxRetries = 3) => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (error.status === 429) {
        console.warn(`[AI Service] Rate limit hit. Retrying (${attempt}/${maxRetries}) in ${attempt * 1000}ms...`);
        await delay(attempt * 1000); // Exponential backoff
      } else if (attempt >= maxRetries) {
        console.error(`[AI Service] Max retries reached or unhandled error:`, error.message);
        throw error;
      } else {
        console.warn(`[AI Service] API Error. Retrying (${attempt}/${maxRetries})...`);
        await delay(500);
      }
    }
  }
};

/**
 * Queue system for rate limiting and concurrency control.
 * Limits concurrent requests to avoid 429 errors.
 */
class AIQueue {
  constructor(concurrency = 5) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }
    this.running++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.processNext();
    }
  }
}

const aiQueue = new AIQueue(5); // Process max 5 requests concurrently

export const generateLuxuryShadeName = async (hex, productType, imageBase64 = null) => {
  if (!openai) {
    return getLocalFallbackName(hex);
  }

  const task = async () => {
    const startTime = Date.now();
    let messages = [
      {
        role: "system",
        content: `You are a senior beauty industry copywriter for Glamirk, a luxury cosmetic brand. Your ONLY output should be a sophisticated, high-end shade name (e.g., 'Crimson Velvet', 'Nude Satin', 'Midnight Muse'). Output ONLY JSON: {"shade": "Name", "color": "#HEX"}. NEVER use file paths, numbers, or technical labels.`
      }
    ];

    messages.push({
      role: "user",
      content: `Product Type: ${productType}. Dominant Hex Detected: ${hex}. Provide the luxury shade name and a slightly refined luxury hex color if needed.`
    });

    const response = await executeWithRetry(() => openai.chat.completions.create({
      model: MODEL,
      messages: messages,
      max_tokens: 50,
      response_format: { type: "json_object" }
    }));

    let result;
    try {
      // Remove any potential markdown code blocks like ```json ... ``` that some models output
      let content = response.choices[0].message.content.trim();
      if (content.startsWith('```json')) content = content.substring(7);
      if (content.endsWith('```')) content = content.substring(0, content.length - 3).trim();
      
      result = JSON.parse(content);
    } catch (parseError) {
      console.warn('[AI Service] Failed to parse JSON from AI response:', response.choices[0].message.content);
      throw new Error('Invalid JSON response');
    }
    console.log(`[AI Service] Generated Shade: ${result.shade} in ${Date.now() - startTime}ms. Usage: ${response.usage?.total_tokens || 'unknown'} tokens.`);
    return result;
  };

  try {
    return await aiQueue.enqueue(task);
  } catch (error) {
    console.error('[AI Service] Failed to generate shade name. Falling back to local generation.', error.message);
    return { shade: getLocalFallbackName(hex), color: hex };
  }
};

export const generateProductMetadata = async (productName, category, variants) => {
  if (!openai) {
    return {
      description: `Indulge in the ${productName} collection. Each shade is meticulously crafted for the modern connoisseur.`,
      seoTitle: `${productName} | Glamirk Luxury Cosmetics`,
      seoDescription: `Shop the ${productName} collection at Glamirk.`,
      tags: ['luxury', category, 'beauty']
    };
  }

  const task = async () => {
    const startTime = Date.now();
    const shadesList = variants.map(v => v.shade).join(', ');
    
    const response = await executeWithRetry(() => openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a senior beauty copywriter for Glamirk, a luxury cosmetic brand. Output ONLY valid JSON containing 'description' (premium editorial short copy), 'seoTitle', 'seoDescription', and 'tags' (array of strings)."
        },
        {
          role: "user",
          content: `Product: ${productName}. Category: ${category}. Shades: ${shadesList}. Generate luxury product descriptions and SEO metadata.`
        }
      ],
      max_tokens: 300,
      response_format: { type: "json_object" }
    }));

    let result;
    try {
      let content = response.choices[0].message.content.trim();
      if (content.startsWith('```json')) content = content.substring(7);
      if (content.endsWith('```')) content = content.substring(0, content.length - 3).trim();
      
      result = JSON.parse(content);
    } catch (parseError) {
      console.warn('[AI Service] Failed to parse JSON for metadata:', response.choices[0].message.content);
      throw new Error('Invalid JSON response');
    }
    console.log(`[AI Service] Generated Metadata for ${productName} in ${Date.now() - startTime}ms. Usage: ${response.usage?.total_tokens || 'unknown'} tokens.`);
    return result;
  };

  try {
    return await aiQueue.enqueue(task);
  } catch (error) {
    console.error('[AI Service] Failed to generate metadata. Falling back.', error.message);
    return {
      description: `Indulge in the ${productName} collection. Each shade is meticulously crafted for the modern connoisseur.`,
      seoTitle: `${productName} | Glamirk Luxury Cosmetics`,
      seoDescription: `Shop the ${productName} collection at Glamirk.`,
      tags: ['luxury', category, 'beauty']
    };
  }
};

export const chatWithConcierge = async (messages) => {
  if (!openai) {
    return { message: "I am the Glamirk Luxury Concierge. How may I assist you today?" };
  }

  const SYSTEM_PROMPT = `You are the Glamirk Luxury Concierge...`;

  const task = async () => {
    const response = await executeWithRetry(() => openai.chat.completions.create({
      model: MODEL, // Use OpenRouter default model
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
    }));
    
    const reply = response.choices[0].message.content;
    if (reply.toLowerCase().includes('priority support ticket') || reply.toLowerCase().includes('escalate')) {
      return { message: reply, autoEscalate: true };
    }
    return { message: reply };
  };

  try {
    return await aiQueue.enqueue(task);
  } catch (error) {
    console.error('[AI Service] Chat failed:', error.message);
    throw error;
  }
};

// Fallback algorithm for offline/failed API
export const getLocalFallbackName = (hex) => {
  if (!hex || hex.length < 7) return 'Luxe Shade';
  
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Very basic hue-based naming
  if (r > 150 && g < 100 && b < 100) return 'Ruby Desire';
  if (r > 200 && g > 150 && b < 150) return 'Coral Muse';
  if (r > 150 && g > 100 && b > 150) return 'Velvet Rose';
  if (r < 100 && g < 100 && b > 150) return 'Royal Blue';
  if (r < 100 && g > 150 && b < 100) return 'Emerald Glow';
  if (r > 100 && g > 100 && b > 100 && r < 180) return 'Mocha Satin';
  if (r > 220 && g > 220 && b > 220) return 'Pure Pearl';
  return 'Luxe Shade';
};

export default {
  generateLuxuryShadeName,
  generateProductMetadata,
  chatWithConcierge,
  getLocalFallbackName
};
