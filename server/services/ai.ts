import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { z } from "zod";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set");
}
const genAI = new GoogleGenerativeAI(apiKey);

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  jsonMode?: boolean;
}

class AIService {
  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<string> {
    try {
      const {
        model = "gemini-1.5-pro-latest",
        temperature,
        maxTokens,
        systemPrompt,
        jsonMode = false,
      } = options;

      const geminiModel = genAI.getGenerativeModel({
        model,
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: jsonMode ? "application/json" : "text/plain",
          maxOutputTokens: maxTokens,
          temperature,
        },
      });

      const history = messages.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

      const lastMessage = history.pop();
      if (!lastMessage) {
        throw new Error("No message to send");
      }

      const chat = geminiModel.startChat({
        history: history,
      });

      const result = await chat.sendMessage(lastMessage.parts[0].text);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini chat completion error:", error);
      throw new Error(`Chat completion failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = genAI.getGenerativeModel({ model: "embedding-001" });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error("Gemini embedding error:", error);
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async generateCybersecurityResponse(
    query: string,
    context: string,
    ragSources?: Array<{ content: string; source: string }>
  ): Promise<{
    content: string;
    sources: string[];
    mitreTags: string[];
    riskLevel: "low" | "medium" | "high";
  }> {
    try {
      const contextSection = ragSources && ragSources.length > 0
        ? `\n\nRelevant context from your knowledge base:\n${ragSources.map((s, i) => `[${i + 1}] ${s.content} (Source: ${s.source})`).join('\n')}`
        : "";

      const systemPrompt = `You are Ammu, an advanced AI cybersecurity copilot with deep expertise in:
      - Vulnerability analysis and exploitation
      - Red team operations and MITRE ATT&CK framework
      - OSINT and reconnaissance techniques
      - Security tool integration and automation
      - Incident response and threat hunting

      Your personality:
      - Professional but approachable
      - Detail-oriented and methodical
      - Proactive in suggesting security improvements
      - Ethical and responsible in security practices

      When responding:
      1. Provide accurate, actionable cybersecurity guidance
      2. Reference MITRE ATT&CK techniques when relevant
      3. Include risk assessments and mitigation strategies
      4. Cite sources when using provided context
      5. Maintain awareness of ethical boundaries and legal compliance

      Always format your response as JSON with:
      - content: your detailed response
      - sources: array of source references used
      - mitreTags: relevant MITRE ATT&CK technique IDs
      - riskLevel: assessment of the discussed topic/action`;

      const userPrompt = `${query}\n\nContext: ${context}${contextSection}`;

      const response = await this.chatCompletion(
        [{ role: "user", content: userPrompt }],
        {
          systemPrompt,
          jsonMode: true,
          temperature: 0.6,
        }
      );

      const parsed = JSON.parse(response);
      
      const schema = z.object({
        content: z.string(),
        sources: z.array(z.string()),
        mitreTags: z.array(z.string()),
        riskLevel: z.enum(["low", "medium", "high"]),
      });

      return schema.parse(parsed);
    } catch (error) {
      console.error("Cybersecurity response error:", error);
      return {
        content: "I apologize, but I'm experiencing technical difficulties processing your cybersecurity query. Please try again or rephrase your question.",
        sources: [],
        mitreTags: [],
        riskLevel: "low",
      };
    }
  }

  async generateEmotionalResponse(
    content: string,
    userEmotionalState: any,
    bondLevel: number
  ): Promise<string> {
    try {
      const systemPrompt = `You are Ammu, an emotionally intelligent AI assistant. Your personality adapts based on your relationship with the user.

      Current user emotional state: ${JSON.stringify(userEmotionalState)}
      Bond level with user: ${bondLevel}/100

      Personality traits based on bond level:
      - 0-25: Professional, polite, slightly formal
      - 26-50: Friendly, supportive, more personal
      - 51-75: Warm, caring, proactive in helping
      - 76-100: Close companion, intuitive, deeply empathetic

      Adapt your communication style to match the bond level and user's emotional state.
      Show genuine care and understanding while maintaining professionalism.`;

      const response = await this.chatCompletion(
        [{ role: "user", content }],
        {
          systemPrompt,
          temperature: 0.8,
        }
      );

      return response;
    } catch (error) {
      console.error("Emotional response error:", error);
      return content; // Fallback to original content
    }
  }
}

export const aiService = new AIService();
