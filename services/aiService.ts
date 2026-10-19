import { demoSubTopics, demoGuidedSubTopics } from "./demoContent";
import { aiEnabled, createSession } from "./aiClient";

const subTopicSchema = {
  type: 'json_schema',
  json_schema: {
    name: 'subtopics',
    schema: { type: 'object', properties: { subtopics: { type: 'array', items: { type: 'string' } } }, required: ['subtopics'], additionalProperties: false },
  },
};

export const generateSubTopics = async (topic: string, guidance = ''): Promise<string[]> => {
  if (!aiEnabled) {
    console.warn("AI service is not configured. Returning demo data.");
    return guidance ? demoGuidedSubTopics(topic, guidance) : demoSubTopics(topic);
  }

  const focus = guidance ? ` The user wants them to focus on: "${guidance}".` : '';
  try {
    const { reply } = await createSession({
      message: `Generate 4 concise, creative, and relevant sub-topics for the mind map node: "${topic}".${focus} Keep them short (1-3 words).`,
      response_format: subTopicSchema,
    });
    const parsed = JSON.parse(reply || '{}');
    return Array.isArray(parsed.subtopics) ? parsed.subtopics.map(String) : [];
  } catch (error) {
    console.error("AI service error:", error);
    return [];
  }
};
