import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

export async function getPromptTemplate(
  templateName: 'ocr_extraction' | 'assistant_system' | 'admin_query',
  variables: Record<string, string> = {}
): Promise<string> {
  try {
    // Robust path resolution: handle both root execution and server-subdir execution
    const rootDir = process.cwd().endsWith('server') ? path.join(process.cwd(), '..') : process.cwd();
    const promptPath = path.resolve(rootDir, 'prompts', `${templateName}.md`);
    let content = await fs.readFile(promptPath, 'utf-8');

    // Dynamically inject values
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      content = content.replace(regex, value);
    }

    return content;
  } catch (err) {
    logger.error(`[Prompts] Failed to load prompt template: ${templateName}`, err);
    throw new Error(`Failed to load prompt template: ${templateName}`);
  }
}
