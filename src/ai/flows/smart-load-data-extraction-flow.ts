'use server';
/**
 * @fileOverview A Genkit flow that extracts load details from a text description or a photo.
 *
 * - extractLoadDetails - A function that handles the load detail extraction process.
 * - SmartLoadDataExtractionInput - The input type for the extractLoadDetails function.
 * - SmartLoadDataExtractionOutput - The return type for the extractLoadDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SmartLoadDataExtractionInputSchema = z.object({
  loadDescription: z.string().optional().describe('A text description of the trucking load.'),
  loadPhoto: z
    .string()
    .optional()
    .describe(
      "An optional photo of the load confirmation, rate con, or BOL, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type SmartLoadDataExtractionInput = z.infer<typeof SmartLoadDataExtractionInputSchema>;

const SmartLoadDataExtractionOutputSchema = z.object({
  loadNumber: z.string().optional().describe('The load number, PRO number, bill number, order number, or trip number found in the document.'),
  origin: z.string().describe('The starting location of the load (city, state).'),
  destination: z.string().describe('The ending location of the load (city, state).'),
  mileage: z
    .coerce.number()
    .optional()
    .describe('The total mileage for the load. If not explicitly mentioned, assume 0.'),
  rate: z
    .coerce.number()
    .optional()
    .describe('The numerical rate value found in the document. If the document mentions "Base", "Base Rate", or "Linehaul Base", set this field to that numerical value.'),
  rateType: z
    .enum(['flat', 'per_mile', 'percentage'])
    .optional()
    .describe('The type of rate.'),
  startDate: z
    .string()
    .optional()
    .describe('The pickup start date in YYYY-MM-DD format.'),
  startTime: z
    .string()
    .optional()
    .describe('The pickup time in HH:MM (24-hour) format if mentioned.'),
  endDate: z
    .string()
    .optional()
    .describe('The delivery end date in YYYY-MM-DD format.'),
  endTime: z
    .string()
    .optional()
    .describe('The delivery time in HH:MM (24-hour) format if mentioned.'),
  fsc: z.coerce.number().optional().describe('Fuel surcharge (FSC) fee or amount if mentioned.'),
  tarp: z.coerce.number().optional().describe('Tarp fee if mentioned.'),
  detention: z.coerce.number().optional().describe('Detention fee if mentioned.'),
  layover: z.coerce.number().optional().describe('Layover fee if mentioned.'),
  loadingUnloading: z.coerce.number().optional().describe('Loading or unloading fee if mentioned.'),
  stopOff: z.coerce.number().optional().describe('Stop-off fee if mentioned.'),
  stops: z.array(z.object({
    location: z.string().describe('The location of the stop (city, state).'),
    date: z.string().optional().describe('The date of the stop in YYYY-MM-DD format.'),
    time: z.string().optional().describe('The time of the stop in HH:MM format.'),
    isPickup: z.boolean().describe('Whether this is a pickup stop.')
  })).optional().describe('Any intermediate pickup or delivery stops found in the document.'),
});
export type SmartLoadDataExtractionOutput = z.infer<typeof SmartLoadDataExtractionOutputSchema>;

export async function extractLoadDetails(
  input: SmartLoadDataExtractionInput
): Promise<SmartLoadDataExtractionOutput> {
  return smartLoadDataExtractionFlow(input);
}

const smartLoadDataExtractionPrompt = ai.definePrompt({
  name: 'smartLoadDataExtractionPrompt',
  input: {schema: SmartLoadDataExtractionInputSchema},
  output: {schema: SmartLoadDataExtractionOutputSchema},
  prompt: `You are an AI assistant specialized in extracting trucking load details, bill numbers, dates, times, and accessorial charges from rate confirmations and bills of lading.

Extract all available information with high accuracy:
- Bill Number / Load Number (CRITICAL: For Landstar loads, the load number is always the Bill Number. Look for "Bill #", "Bill of Lading", "BOL #", "Load #", "Trip #").
- Origin (city, state)
- Destination (city, state)
- Mileage (numeric value)
- Rate (numerical value, USD). If the document mentions "Base", "Base Rate", or "Linehaul Base", extract that numerical value.
- Rate Type (flat, per_mile, or percentage)
- Start Date (YYYY-MM-DD) and Start Time (HH:MM in 24hr format) for pickup.
- End Date (YYYY-MM-DD) and End Time (HH:MM in 24hr format) for delivery.
- Accessorial Fees (numerical values in USD):
  * FSC (Fuel Surcharge)
  * Tarp (Tarp fee)
  * Detention (Detention fee)
  * Layover (Layover fee)
  * LoadingUnloading (Lumper / Loading / Unloading fee)
  * StopOff (Stop-off fee)
- Stops (Extract all intermediate pickup and delivery locations, dates, and times as stops).

If a piece of information is not explicitly mentioned, provide 0 for numbers or empty string for dates/times.

{{#if loadDescription}}
Load Description: {{{loadDescription}}}
{{/if}}

{{#if loadPhoto}}
Load Photo: {{media url=loadPhoto}}
{{/if}}`,
});

const smartLoadDataExtractionFlow = ai.defineFlow(
  {
    name: 'smartLoadDataExtractionFlow',
    inputSchema: SmartLoadDataExtractionInputSchema,
    outputSchema: SmartLoadDataExtractionOutputSchema,
  },
  async input => {
    const {output} = await smartLoadDataExtractionPrompt(input);
    return output!;
  }
);
