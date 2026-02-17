
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Use recommended model names as per guidelines
const MODEL_TEXT = 'gemini-3-flash-preview';
const MODEL_IMAGE = 'gemini-2.5-flash-image';

// Guidelines require obtaining API key exclusively from process.env.API_KEY.
// We remove the helper function and direct access import.meta.env to resolve TS errors
// and strictly adhere to the SDK initialization rules.

export async function getPromptSuggestion(base64Image: string): Promise<string> {
  // Always use a new instance with the required process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

  const response = await ai.models.generateContent({
    model: MODEL_TEXT,
    contents: {
      parts: [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: 'image/png',
          },
        },
        {
          text: `Analyze this image. It is an empty interior scene. 
          Generate a high-quality inpainting prompt to add life to this specific scene.
          Focus on adding people naturally seated or standing in logical places.
          
          Format your response EXACTLY like this:
          
          Inpainting task: [Detailed description of who to add and what they are doing].
          
          PEOPLE DETAILS: [Age, ethnicity, clothing style].
          
          TECHNICAL REQUIREMENTS: Photorealistic, correct scale, proper shadows.
          
          ABSOLUTE DO NOT TOUCH: [List specific architectural elements to preserve].`
        },
      ],
    },
  });

  // Extract text using the .text property as per guidelines
  return response.text || "Failed to generate suggestion.";
}

export async function analyzeResultForErrors(originalBase64: string, resultBase64: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const cleanResult = resultBase64.replace(/^data:image\/\w+;base64,/, "");

  const response = await ai.models.generateContent({
    model: MODEL_TEXT,
    contents: {
      parts: [
        {
          inlineData: {
            data: cleanResult,
            mimeType: 'image/png',
          },
        },
        {
          text: `You are an AI quality assurance expert for image generation. 
          Look at this edited image. Check for "rendering errors" or "AI hallucinations" such as:
          - Floating objects (plates, phones, limbs not touching surfaces).
          - Distorted anatomy (extra fingers, weird faces).
          - Lighting/Shadow mismatches (people without shadows or shadows in wrong direction).
          - Perspective errors.
          
          Provide a NEW inpainting prompt specifically designed to FIX these errors while keeping the rest of the additions.
          
          Format: 
          Refinement task: [Specifically what to fix, e.g., 'Ensure the plate on the middle table is resting on the surface'].
          TECHNICAL FIX: [Instructions for lighting/shadow correction].`
        },
      ],
    },
  });

  // Extract text using the .text property
  return response.text || "No specific errors found. Try refining the prompt manually.";
}

export async function processInpainting(
  base64Image: string,
  prompt: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_IMAGE,
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: 'image/png',
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    let resultUrl = "";
    // Iterate through candidates and parts to find the image, as per guidelines
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          resultUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!resultUrl) throw new Error("The model did not return an edited image.");

    return resultUrl;
  } catch (err: any) {
    console.error("Gemini Inpainting Error:", err);
    throw new Error(err.message || "Failed to process inpainting.");
  }
}
