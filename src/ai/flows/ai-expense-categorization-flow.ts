'use server';
/**
 * @fileOverview An AI agent for extracting and categorizing trucking expenses from text or images.
 *
 * - categorizeExpense - A function that handles the expense extraction and categorization process.
 * - ExpenseCategorizationInput - The input type for the categorizeExpense function.
 * - ExpenseCategorizationOutput - The return type for the categorizeExpense function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExpenseCategorizationInputSchema = z.object({
  text: z.string().optional().describe('A text description or copy-pasted details of the expense.'),
  image: z
    .string()
    .optional()
    .describe(
      "An optional photo of the receipt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExpenseCategorizationInput = z.infer<typeof ExpenseCategorizationInputSchema>;

const ExpenseCategorizationOutputSchema = z.object({
  amount: z.number().optional().describe('The extracted monetary amount of the expense.'),
  date: z.string().optional().describe('The extracted date of the expense (YYYY-MM-DD).'),
  description: z.string().optional().describe('A refined description of the expense.'),
  location: z.string().optional().describe('The city and state where the expense occurred.'),
  truckStop: z.string().optional().describe("The identified truck stop name (e.g., 'Pilot', 'Loves', 'TA', 'Petro')."),
  category: z
    .string()
    .describe(
      "The categorized expense type (e.g., 'Fuel', 'Maintenance', 'Food', 'Lodging', 'Tolls', 'Insurance', 'Cash Advance', 'Other')."
    ),
  fuelDetails: z.object({
    fuelTypes: z.array(z.string()).optional().describe("List of fuel types found: 'diesel', 'def', 'reefer'."),
    diesel: z.object({
      gallons: z.number().optional(),
      pumpPrice: z.number().optional(),
      discountPrice: z.number().optional(),
    }).optional(),
    def: z.object({
      gallons: z.number().optional(),
      pumpPrice: z.number().optional(),
    }).optional(),
    reefer: z.object({
      gallons: z.number().optional(),
      pumpPrice: z.number().optional(),
      discountPrice: z.number().optional(),
    }).optional(),
  }).optional().describe("Specific details if the expense is for Fuel."),
  deductionsSuggested: z.array(z.string()).describe('A list of suggested tax deductions applicable to this expense.'),
  explanation: z
    .string()
    .describe('An explanation for the categorization and suggested deductions.'),
});
export type ExpenseCategorizationOutput = z.infer<typeof ExpenseCategorizationOutputSchema>;

export async function categorizeExpense(input: ExpenseCategorizationInput): Promise<ExpenseCategorizationOutput> {
  return expenseCategorizationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'expenseCategorizationPrompt',
  input: { schema: ExpenseCategorizationInputSchema },
  output: { schema: ExpenseCategorizationOutputSchema },
  prompt: `You are an expert financial assistant for owner-operator truckers.
Your task is to extract expense details and categorize them for tax purposes from the provided text or receipt image.

Extract:
- Amount (numeric)
- Date (YYYY-MM-DD)
- Description (what was purchased)
- Location (City, State if available)
- Truck Stop (If the receipt is from a major chain like Pilot, Flying J, Love's, TA, Petro, Speedway, etc.)
- Category (one of: Fuel, Maintenance, Tolls, Food, Insurance, Cash Advance, Other)

If the category is "Fuel", pay close attention to the breakdown:
- Look for Diesel, DEF, and Reefer fuel.
- Extract gallons and prices for each. 
- If a "Cash Price" or "Discounted Price" is shown vs a "Credit Price" or "Pump Price", extract both.
- Return the fuel types found in the fuelTypes array (diesel, def, reefer).

Suggest relevant tax deductions for owner-operators.

{{#if text}}
Input Text: {{{text}}}
{{/if}}

{{#if image}}
Receipt Image: {{media url=image}}
{{/if}}

Please extract the details and provide suggestions in JSON format.`,
});

const expenseCategorizationFlow = ai.defineFlow(
  {
    name: 'expenseCategorizationFlow',
    inputSchema: ExpenseCategorizationInputSchema,
    outputSchema: ExpenseCategorizationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
