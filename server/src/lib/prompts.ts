import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

export async function getPromptTemplate(
  templateName: 'ocr_extraction' | 'assistant_system' | 'admin_query',
  variables: Record<string, string> = {}
): Promise<string> {
  try {
    // Fallback chain for finding the 'prompts' directory
    const possibleRoots = [
      process.cwd(),
      path.join(process.cwd(), '..'),
      path.resolve(__dirname, '../../..')
    ];

    let promptPath = '';
    let content = '';

    for (const root of possibleRoots) {
      const target = path.resolve(root, 'prompts', `${templateName}.md`);
      try {
        content = await fs.readFile(target, 'utf-8');
        promptPath = target;
        break; // Success!
      } catch (e) {
        // Continue to next possible root
      }
    }

    if (!content) {
      throw new Error(`Prompt template not found in any of: ${possibleRoots.join(', ')}`);
    }

    logger.info(`[Prompts] Successfully loaded template: ${templateName} from ${promptPath}`);

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
