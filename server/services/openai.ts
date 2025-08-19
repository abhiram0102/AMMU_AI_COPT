import OpenAI from "openai";
import { z } from "zod";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

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

export interface TranscriptionResult {
  text: string;
  confidence: number;
  duration?: number;
  language?: string;
}

export interface EmotionalAnalysis {
  tone: string;
  confidence: number;
  emotions: Array<{
    emotion: string;
    intensity: number;
  }>;
}

export interface VoiceCharacteristics {
  pitch: number;
  speed: number;
  energy: number;
  characteristics: string[];
}

class OpenAIService {
  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<string> {
    try {
      const {
        model = "gpt-4o",
        temperature = 0.7,
        maxTokens = 2000,
        jsonMode = false
      } = options;

      const systemMessages: ChatMessage[] = options.systemPrompt 
        ? [{ role: "system", content: options.systemPrompt }]
        : [];

      const response = await openai.chat.completions.create({
        model,
        messages: [...systemMessages, ...messages],
        temperature,
        max_tokens: maxTokens,
        response_format: jsonMode ? { type: "json_object" } : undefined,
      });

      return response.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("OpenAI chat completion error:", error);
      throw new Error(`Chat completion failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<TranscriptionResult> {
    try {
      // Create a temporary file-like object for the API
      const file = new File([audioBuffer], "audio.wav", { type: "audio/wav" });
      
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: "en",
        response_format: "verbose_json",
      });

      return {
        text: transcription.text,
        confidence: 0.95, // Whisper doesn't provide confidence, using default
        duration: transcription.duration,
        language: transcription.language || "en"
      };
    } catch (error) {
      console.error("OpenAI transcription error:", error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async analyzeEmotion(text: string): Promise<EmotionalAnalysis> {
    try {
      const systemPrompt = `You are an expert in emotional analysis. Analyze the emotional tone and content of the given text.
      
      Provide your analysis in JSON format with:
      - tone: primary emotional tone (happy, sad, angry, excited, frustrated, calm, anxious, etc.)
      - confidence: confidence score between 0 and 1
      - emotions: array of detected emotions with intensity scores (0-1)
      
      Be precise and consider context, word choice, and sentiment indicators.`;

      const response = await this.chatCompletion(
        [{ role: "user", content: text }],
        {
          systemPrompt,
          jsonMode: true,
          temperature: 0.3
        }
      );

      const analysis = JSON.parse(response);
      
      // Validate response structure
      const schema = z.object({
        tone: z.string(),
        confidence: z.number().min(0).max(1),
        emotions: z.array(z.object({
          emotion: z.string(),
          intensity: z.number().min(0).max(1)
        }))
      });

      return schema.parse(analysis);
    } catch (error) {
      console.error("Emotion analysis error:", error);
      // Return default analysis on error
      return {
        tone: "neutral",
        confidence: 0.5,
        emotions: [{ emotion: "neutral", intensity: 0.5 }]
      };
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("OpenAI embedding error:", error);
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
          temperature: 0.6
        }
      );

      const parsed = JSON.parse(response);
      
      // Validate response structure
      const schema = z.object({
        content: z.string(),
        sources: z.array(z.string()),
        mitreTags: z.array(z.string()),
        riskLevel: z.enum(["low", "medium", "high"])
      });

      return schema.parse(parsed);
    } catch (error) {
      console.error("Cybersecurity response error:", error);
      // Return fallback response
      return {
        content: "I apologize, but I'm experiencing technical difficulties processing your cybersecurity query. Please try again or rephrase your question.",
        sources: [],
        mitreTags: [],
        riskLevel: "low"
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
          temperature: 0.8
        }
      );

      return response;
    } catch (error) {
      console.error("Emotional response error:", error);
      return content; // Fallback to original content
    }
  }
}

export const openaiService = new OpenAIService();
