import { QuestionData } from './types';

export class AIGenerationService {
  private apiKey: string;
  // 使用 Gemini Pro 或 Flash 模型
  private modelName = 'gemini-2.5-pro'; 

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * 將教師的自然語言發送給 Gemini API，並強制返回符合 QuestionData Schema 的 JSON
   */
  async generateQuestion(topic: string, difficulty: string, prompt: string): Promise<QuestionData> {
    const systemInstruction = `
    你是一位專業的香港 DSE 數學科出題專家。
    請根據使用者提供的「主題」、「難度」與「自訂指令」，生成一題符合 DSE 格式的數學幾何題。
    
    【重要輸出規範】
    你必須且只能輸出一個合法的 JSON 物件，不可以包含任何 Markdown 標籤 (例如 \`\`\`json) 或其他廢話。
    該 JSON 必須符合以下 TypeScript Interface 的結構：
    
    \`\`\`typescript
    interface QuestionData {
      geometry_state: {
        variables: Record<string, number>;
        points: Record<string, 
          | { type: 'absolute', x: number, y: number }
          | { type: 'polar', refOrigin: string, radiusVar: string, angleVar: string }
          | { type: 'polar_eval', refOrigin: string, radiusVar: string, angleExpression: string }
        >;
        elements: {
          lines?: Array<{ from: string, to: string, conditionalToggle?: string }>;
          circles?: Array<{ center: string, radiusVar: string }>;
          arcs?: Array<{ center: string, from: string, to: string, radius: number }>;
          labels?: Array<{ point: string, text: string, offset: { x: number, y: number } }>;
        };
      };
      question_template: { text: string }; // 使用 _{{variable}}_ 代表變數，使用 $...$ 或 $$...$$ 撰寫 KaTeX
      marking_scheme: { 
        steps: Array<{ description: string, marks: number, markType: 'M' | 'A' }> 
      };
      controls: {
        sliders: Array<{ targetVariable: string, label: string, min: number, max: number, step: number }>;
        toggles: Array<{ id: string, label: string, defaultValue: boolean }>;
      };
    }
    \`\`\`
    `;

    const userMessage = `主題：${topic}\n難度：${difficulty}\n指令：${prompt}`;

    // 使用 Gemini 的 REST API 發起請求
    // 實作自動重試機制 (最多重試 2 次)
    const MAX_RETRIES = 2;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }]
            },
            contents: [{
              role: 'user',
              parts: [{ text: userMessage }]
            }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json", // 強制要求 JSON
            }
          }),
        });

        if (!response.ok) {
          throw new Error(`Gemini API Error: Status ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
          throw new Error("No candidates returned from Gemini");
        }

        const rawText = data.candidates[0].content.parts[0].text;
        
        // 嘗試解析 JSON (有時 Gemini 仍可能包裝在 ```json 中，需要清理)
        const cleanedText = rawText.replace(/^\\s*\`\`\`json\\s*/, '').replace(/\\s*\`\`\`\\s*$/, '');
        const parsedJson = JSON.parse(cleanedText) as QuestionData;
        
        // 可選：在這裡做更多的 Zod/Schema Validation...

        return parsedJson;

      } catch (error) {
        attempt++;
        console.error(`Attempt ${attempt} failed:`, error);
        
        if (attempt > MAX_RETRIES) {
          throw new Error("生成題目失敗，請稍後再試或調整您的指令。");
        }
      }
    }
    
    throw new Error("Unexpected error in LLM generation.");
  }
}
