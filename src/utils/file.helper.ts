import pdf from 'pdf-parse';
import fs from 'fs/promises';

export const extractTextFromPDF = async (filePath: string): Promise<string> => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    throw new Error('Failed to parse PDF content');
  }
};
