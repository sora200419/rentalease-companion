import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AgreementPreferences } from '@prisma/client';
import { z } from 'zod';
import { buildWizardPolicyBlock } from './wizardFormatters';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
export const GEMINI_MODEL = 'gemini-2.5-flash';

// Upper bound on the agreement text we send to Gemini. A typical Malaysian
// residential tenancy agreement is 8-15 KB; 50 KB is generous headroom while
// capping abuse / runaway prompts. Truncating client-side before sending also
// avoids paying for tokens we don't intend to use.
const MAX_AGREEMENT_CHARS_FOR_GEMINI = 50_000;

function truncateForModel(content: string): string {
  if (content.length <= MAX_AGREEMENT_CHARS_FOR_GEMINI) return content;
  return (
    content.slice(0, MAX_AGREEMENT_CHARS_FOR_GEMINI) +
    '\n[... truncated to protect token budget ...]'
  );
}

export interface TenancyForAgreement {
  id: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: unknown;
  depositAmount: unknown;
  leasePartyType?: 'INDIVIDUAL' | 'CORPORATE';
  companyName?: string | null;
  authorizedSignatoryName?: string | null;
  authorizedSignatoryRole?: string | null;
  property: {
    address: string;
    city: string;
    state: string;
    postcode: string;
    type: string;
  };
  room: {
    label: string;
    bathrooms: number;
    roomType: string;
    bathroomType: string;
    furnishing: string;
    maxOccupants: number;
    wifiIncluded: boolean;
    waterIncluded: boolean;
    electricIncluded: boolean;
    genderPreference: string;
    sizeSqFt: number | null;
    notes: string | null;
  };
  tenant: {
    name: string;
    email: string;
    phone?: string | null;
    icNumber?: string | null;
  };
  companyRegistrationNo?: string | null;
  authorizedSignatoryIC?: string | null;
  landlord: {
    name: string;
    email: string;
    phone?: string | null;
    icNumber?: string | null;
  };
  negotiationContext?: string | null;
  coTenants?: { name: string; icNumber?: string | null }[];
  corporateOccupants?: { name: string; roleLabel?: string | null }[];
}

export interface GeneratedAgreement {
  rawContent: string;
  plainLanguageSummary: string;
  redFlags: string;
}

export interface AgreementAnalysis {
  plainLanguageSummary: string;
  redFlags: string;
}

export interface TranslatedOutputs {
  plainLanguageSummaryMs: string;
  redFlagsMs: string;
}

function cleanGeminiJson(text: string): string {
  let s = text.trim();
  // Strip markdown code fences that occasionally leak through even with responseMimeType
  s = s.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```\s*$/, '');
  // Replace illegal JSON control characters (U+0000–U+001F except tab \x09,
  // newline \x0A, carriage-return \x0D) with a space to prevent parse errors
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
  return s;
}

function normalizeStringContent(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeStringContent(item))
      .filter(Boolean)
      .join('\n\n');
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const normalized = normalizeStringContent(item);
        if (!normalized) return '';
        return `${key.replace(/_/g, ' ')}: ${normalized}`;
      })
      .filter(Boolean)
      .join('\n\n');
  }

  return '';
}

function formatRoomType(rt: string): string {
  const map: Record<string, string> = {
    MASTER: 'master room',
    MEDIUM: 'medium-sized room',
    SMALL: 'small/single room',
    STUDIO: 'studio unit',
    ENTIRE_UNIT: 'entire residential unit',
  };
  return map[rt] ?? rt.toLowerCase().replace(/_/g, ' ');
}

function formatBathroomType(bt: string): string {
  return bt === 'ATTACHED' ? 'private attached bathroom' : 'shared bathroom';
}

function formatFurnishing(f: string): string {
  const map: Record<string, string> = {
    FULLY_FURNISHED:
      'fully furnished (includes bed, wardrobe, air conditioning, desk, and standard appliances)',
    PARTIALLY_FURNISHED:
      'partially furnished (wardrobe and/or fan/air conditioning provided; other items by tenant)',
    UNFURNISHED: 'unfurnished (empty room - tenant provides all furniture)',
  };
  return map[f] ?? f.toLowerCase().replace(/_/g, ' ');
}

function formatGenderPreference(g: string): string {
  const map: Record<string, string> = {
    ANY: 'open to any gender',
    MALE_ONLY: 'male occupants only',
    FEMALE_ONLY: 'female occupants only',
  };
  return map[g] ?? g.toLowerCase().replace(/_/g, ' ');
}

function buildUtilitiesClause(
  wifi: boolean,
  water: boolean,
  electric: boolean,
): string {
  const included: string[] = [];
  const excluded: string[] = [];

  if (wifi) included.push('internet/WiFi');
  else excluded.push('internet/WiFi');

  if (water) included.push('water');
  else excluded.push('water');

  if (electric) included.push('electricity');
  else excluded.push('electricity');

  const parts: string[] = [];
  if (included.length > 0) {
    parts.push(
      `The following utilities are included in the monthly rent: ${included.join(', ')}.`,
    );
  }
  if (excluded.length > 0) {
    parts.push(
      `The following utilities are NOT included and shall be paid separately by the Tenant: ${excluded.join(', ')}.`,
    );
  }
  return parts.join(' ');
}

const redFlagSchema = z.object({
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  clause: z.string(),
  issue: z.string(),
  recommendation: z.string(),
});

export async function generateTenancyAgreement(
  tenancy: TenancyForAgreement,
  preferences?: AgreementPreferences | null,
): Promise<GeneratedAgreement> {
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 16384,
    },
  });

  const startDate = new Date(tenancy.startDate).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const endDate = new Date(tenancy.endDate).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const monthlyRent = Number(tenancy.monthlyRent).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
  });
  const deposit = Number(tenancy.depositAmount).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
  });
  const durationMonths = Math.round(
    (new Date(tenancy.endDate).getTime() -
      new Date(tenancy.startDate).getTime()) /
      (1000 * 60 * 60 * 24 * 30.44),
  );

  const utilitiesClause = buildUtilitiesClause(
    tenancy.room.wifiIncluded,
    tenancy.room.waterIncluded,
    tenancy.room.electricIncluded,
  );

  const maskIc = (ic?: string | null) =>
    ic ? `****-**-${ic.slice(-4)}` : 'Not provided';

  const formatLegalIdentity = (value?: string | null) =>
    value?.trim() ? value.trim() : 'Not provided';

  const individualIdentityBlock = `
FINAL PARTY IDENTITY DETAILS
- Landlord Name: ${tenancy.landlord.name}
- Landlord Email: ${tenancy.landlord.email}
- Landlord Phone: ${tenancy.landlord.phone ?? 'Not provided'}
- Landlord IC/NRIC Number: ${formatLegalIdentity(tenancy.landlord.icNumber)}
- Tenant Name: ${tenancy.tenant.name}
- Tenant Email: ${tenancy.tenant.email}
- Tenant Phone: ${tenancy.tenant.phone ?? 'Not provided'}
- Tenant IC/NRIC Number: ${formatLegalIdentity(tenancy.tenant.icNumber)}
`;

  const corporateIdentityBlock =
    tenancy.leasePartyType === 'CORPORATE'
      ? `
CORPORATE PARTY IDENTITY DETAILS
- Company Name: ${tenancy.companyName ?? 'Not provided'}
- Company Registration Number: ${tenancy.companyRegistrationNo ?? 'Not provided'}
- Authorized Signatory Name: ${tenancy.authorizedSignatoryName ?? tenancy.tenant.name}
- Authorized Signatory Role: ${tenancy.authorizedSignatoryRole ?? 'Not provided'}
- Authorized Signatory IC/NRIC Number: ${formatLegalIdentity(tenancy.authorizedSignatoryIC ?? tenancy.tenant.icNumber)}
- Authorized Signatory Email: ${tenancy.tenant.email}
`
      : '';

  const coTenantsBlock =
    tenancy.coTenants && tenancy.coTenants.length > 0
      ? `
ADDITIONAL OCCUPANTS
The following persons will reside in the unit as co-occupants under the primary tenant's tenancy. They are NOT separate parties to this agreement but MUST be named in the Permitted Use and Occupancy clause:
${tenancy.coTenants.map((ct) => `- ${ct.name} (IC: ${maskIc(ct.icNumber)})`).join('\n')}
`
      : '';

  const corporateLeasePartyBlock =
    tenancy.leasePartyType === 'CORPORATE'
      ? `
CORPORATE LEASE PARTY
- Lease Party Type: Corporate / Employer tenancy
- Company Name: ${tenancy.companyName ?? 'Not provided'}
- Authorized Signatory: ${tenancy.authorizedSignatoryName ?? tenancy.tenant.name}${tenancy.authorizedSignatoryRole ? ` (${tenancy.authorizedSignatoryRole})` : ''}
- Occupant Roster:
${
  (tenancy.corporateOccupants ?? []).length > 0
    ? tenancy
        .corporateOccupants!.map(
          (occupant) =>
            `  - ${occupant.name}${occupant.roleLabel ? ` (${occupant.roleLabel})` : ''}`,
        )
        .join('\n')
    : '  - No occupants listed yet'
}
The agreement must clearly distinguish the corporate lease party / authorized signatory from the staff or occupants staying in the room or unit.
`
      : '';

  const optionalRoomDetails: string[] = [];
  if (tenancy.room.sizeSqFt) {
    optionalRoomDetails.push(
      `- Room Size: approximately ${tenancy.room.sizeSqFt} sq ft`,
    );
  }
  if (tenancy.room.notes) {
    optionalRoomDetails.push(`- Additional Room Notes: ${tenancy.room.notes}`);
  }

  const negotiationBlock = tenancy.negotiationContext
    ? `
IMPORTANT - TENANT-REQUESTED CHANGES:
The tenant has reviewed the previous draft and requested the following changes.
Incorporate these into the revised agreement where legally reasonable:
<TENANT_NOTES>
${tenancy.negotiationContext}
</TENANT_NOTES>
`
    : '';

  const wizardPolicyBlock = preferences
    ? buildWizardPolicyBlock(preferences)
    : '';

  const prompt = `
You are a Malaysian legal document assistant specialising in residential tenancy agreements.
${negotiationBlock}
Generate a complete residential tenancy agreement using the following details.
${wizardPolicyBlock}
All clauses must reflect Malaysian law (Contracts Act 1950, Distress Act 1951, NLC 1965, PDPA 2010).

PROPERTY DETAILS
- Property Address: ${tenancy.property.address}, ${tenancy.property.city}, ${tenancy.property.state} ${tenancy.property.postcode}
- Property Type: ${tenancy.property.type}

RENTED UNIT DETAILS
- Unit Description: ${tenancy.room.label} (${formatRoomType(tenancy.room.roomType)})
- Bathroom: ${formatBathroomType(tenancy.room.bathroomType)} (${tenancy.room.bathrooms} bathroom${tenancy.room.bathrooms > 1 ? 's' : ''})
- Furnishing Level: ${formatFurnishing(tenancy.room.furnishing)}
- Maximum Occupants Permitted: ${tenancy.room.maxOccupants} person${tenancy.room.maxOccupants > 1 ? 's' : ''}
- Gender Restriction: ${formatGenderPreference(tenancy.room.genderPreference)}
${optionalRoomDetails.join('\n')}

UTILITIES AND SERVICES
${utilitiesClause}
The agreement MUST include a dedicated Utilities clause that clearly states which utilities are included in rent and which the Tenant is responsible for. Do not leave this ambiguous.

${individualIdentityBlock}
${corporateIdentityBlock}
${coTenantsBlock}
${corporateLeasePartyBlock}
The rawContent must include a dedicated "Parties and Identity Details" section using the full identity details provided above. Do not mask IC/NRIC numbers in rawContent. Do not repeat full IC/NRIC numbers in plainLanguageSummary or redFlags unless legally necessary.

FINANCIAL TERMS
- Tenancy Start Date: ${startDate}
- Tenancy End Date: ${endDate}
- Duration: ${durationMonths} months
- Monthly Rent: RM ${monthlyRent}
- Security Deposit: RM ${deposit}

REQUIRED CLAUSES
The agreement must include all of the following sections. Write each as a numbered clause:
1. Parties and Property Description
2. Tenancy Period
3. Monthly Rent and Payment Terms
4. Security Deposit and Conditions for Refund
5. Utilities and Services (reflecting the utilities clause above explicitly)
6. Furnishing Inventory Acknowledgement (reflecting the furnishing level above)
7. Permitted Use and Occupancy Limits (reflecting maximum occupants above)
8. Subletting and Transfer Prohibition
9. Maintenance and Repairs
10. Landlord's Right of Entry and Inspection
11. Termination and Notice Period
12. Reinstatement Obligations
13. Governing Law and Dispute Resolution
14. Entire Agreement and Amendments
15. Signature Block (with space for date, signature, and IC/NRIC number for both parties)

Respond ONLY with a valid JSON object containing exactly these three keys:
{
  "rawContent": "<full formal tenancy agreement text>",
  "plainLanguageSummary": "<plain language explanation of each clause>",
  "redFlags": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "clause": "<clause name or number>",
      "issue": "<what the potential problem is>",
      "recommendation": "<what to do about it>"
    }
  ]
}

For "rawContent": Write a complete, professional Malaysian residential tenancy agreement incorporating ALL details above. The furnishing level, utilities, occupancy limit, and bathroom type must appear explicitly in the relevant clauses - do not omit them.

For "plainLanguageSummary": For each numbered clause, write 2-3 sentences in plain English explaining what it means for a layperson tenant or landlord in Malaysia.

For "redFlags": Analyse the agreement and identify clauses that could disadvantage either party or create legal ambiguity under Malaysian law. Pay particular attention to: deposit refund conditions, utility responsibility ambiguity, occupancy limit enforcement, and subletting prohibition scope. Return as a JSON array (can be empty []).
`;

  const geminiResponseSchema = z.object({
    rawContent: z.string().min(200, 'Agreement content is too short'),
    plainLanguageSummary: z.string().min(50, 'Summary is too short'),
    redFlags: z.array(redFlagSchema),
  });

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const raw = JSON.parse(cleanGeminiJson(text));
    const normalizedRaw = {
      ...raw,
      rawContent: normalizeStringContent(raw.rawContent),
      plainLanguageSummary: normalizeStringContent(raw.plainLanguageSummary),
    };
    const validated = geminiResponseSchema.parse(normalizedRaw);

    return {
      rawContent: validated.rawContent,
      plainLanguageSummary: validated.plainLanguageSummary,
      redFlags: JSON.stringify(validated.redFlags),
    };
  } catch (error) {
    console.error('Gemini generation error:', error);
    throw new Error('Failed to generate agreement. Please try again.');
  }
}

export async function analyzeAgreementContent(
  rawContent: string,
): Promise<AgreementAnalysis> {
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const prompt = `
You are a Malaysian legal document assistant specialising in residential tenancy agreements.

Review the agreement below and produce:
1. A plain-language summary of each numbered clause.
2. A red-flag analysis focused on legal ambiguity, unfair terms, and risky clauses.

Respond ONLY with a valid JSON object containing exactly these two keys:
{
  "plainLanguageSummary": "<plain language explanation of each clause>",
  "redFlags": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "clause": "<clause name or number>",
      "issue": "<what the potential problem is>",
      "recommendation": "<what to do about it>"
    }
  ]
}

For "plainLanguageSummary": For each numbered clause, write 2-3 sentences in plain English explaining what it means for a layperson tenant or landlord in Malaysia.

For "redFlags": Analyse the agreement and identify clauses that could disadvantage either party or create legal ambiguity under Malaysian law. Pay particular attention to: deposit refund conditions, utility responsibility ambiguity, occupancy limit enforcement, subletting prohibition scope, termination penalties, and notice requirements. Return as a JSON array (can be empty []).

AGREEMENT:
${truncateForModel(rawContent)}
`;

  const analysisSchema = z.object({
    plainLanguageSummary: z.string().min(50, 'Summary is too short'),
    redFlags: z.array(redFlagSchema),
  });

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const raw = JSON.parse(cleanGeminiJson(text));
    const normalizedRaw = {
      ...raw,
      plainLanguageSummary: normalizeStringContent(raw.plainLanguageSummary),
    };
    const validated = analysisSchema.parse(normalizedRaw);

    return {
      plainLanguageSummary: validated.plainLanguageSummary,
      redFlags: JSON.stringify(validated.redFlags),
    };
  } catch (error) {
    console.error('Gemini agreement analysis error:', error);
    throw new Error('Failed to refresh AI analysis.');
  }
}

export async function translateAgreementOutputs(
  plainLanguageSummary: string,
  redFlagsJson: string,
): Promise<TranslatedOutputs> {
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = `
You are a professional translator specialising in legal and property documents.
Translate the following Malaysian residential tenancy agreement summaries from
English into formal Bahasa Malaysia (Malay). Use terminology appropriate for
legal and property contexts in Malaysia.

DO NOT translate the agreement body itself - only the plain-language summary
and red flag explanations are needed.

PLAIN LANGUAGE SUMMARY (English):
${plainLanguageSummary}

RED FLAGS (English JSON):
${redFlagsJson}

Respond ONLY with a valid JSON object containing exactly these two keys:
{
  "plainLanguageSummaryMs": "<full Malay translation of the plain language summary>",
  "redFlagsMs": [
    {
      "severity": "<same as original>",
      "clause": "<same as original - keep in English>",
      "issue": "<Malay translation of the issue>",
      "recommendation": "<Malay translation of the recommendation>"
    }
  ]
}
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(cleanGeminiJson(text));

    if (!parsed.plainLanguageSummaryMs || !Array.isArray(parsed.redFlagsMs)) {
      throw new Error('Translation response missing required fields');
    }

    return {
      plainLanguageSummaryMs: parsed.plainLanguageSummaryMs,
      redFlagsMs: JSON.stringify(parsed.redFlagsMs),
    };
  } catch (error) {
    console.error('Gemini translation error:', error);
    throw new Error('Failed to translate agreement outputs.');
  }
}

export interface ExtractedTerms {
  startDate: string | null; // ISO YYYY-MM-DD or null if AI couldn't determine
  endDate: string | null;
  monthlyRent: number | null; // plain number in RM, or null
  depositAmount: number | null; // plain number in RM, or null
}

/**
 * Reads a tenancy agreement's raw text and extracts the four key operational
 * terms. Uses a small Gemini call (maxOutputTokens: 256) since the output is
 * just a tiny JSON object.
 *
 * Returns null for any field the model cannot determine with confidence.
 * The caller is responsible for falling back to current system values when null.
 */
export async function extractAgreementTerms(
  rawContent: string,
): Promise<ExtractedTerms> {
  // No maxOutputTokens: gemini-2.5-flash is a thinking model whose thinking tokens are
  // concatenated with the output by getText(). A tight cap causes the thinking content
  // to bleed into the JSON response, producing malformed output. Omitting the cap
  // (consistent with all other Gemini calls in this file) lets the model complete cleanly.
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const prompt = `You are a legal document parser for Malaysian tenancy agreements.
Extract the following key terms from the agreement text below.
Return a single JSON object with exactly these four keys:
  "startDate"     — tenancy commencement date as "YYYY-MM-DD", or null
  "endDate"       — tenancy expiry date as "YYYY-MM-DD", or null
  "monthlyRent"   — monthly rent amount as a plain number (no RM symbol), or null
  "depositAmount" — security deposit amount as a plain number (no RM symbol), or null

Rules:
- Return ONLY the JSON object. No explanation, no markdown fences.
- Dates MUST be in YYYY-MM-DD format (e.g. "2026-06-01").
- Amounts MUST be plain numbers (e.g. 1500.00, not "RM 1,500").
- If you cannot determine a value with confidence, return null for that key.

Agreement text:
${truncateForModel(rawContent)}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(cleanGeminiJson(text));
  } catch (parseErr) {
    // If Gemini returns malformed JSON (e.g. thinking-part bleed-through), log for
    // diagnostics and fall through with an empty object — all fields return null and
    // the UI shows "AI couldn't determine — verify" labels on each field.
    console.warn(
      '[extractAgreementTerms] JSON parse failed. Raw response:',
      text,
    );
    console.warn('[extractAgreementTerms] Parse error:', parseErr);
  }

  return {
    startDate:
      typeof parsed.startDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate)
        ? parsed.startDate
        : null,
    endDate:
      typeof parsed.endDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.endDate)
        ? parsed.endDate
        : null,
    monthlyRent:
      typeof parsed.monthlyRent === 'number' && parsed.monthlyRent > 0
        ? parsed.monthlyRent
        : null,
    depositAmount:
      typeof parsed.depositAmount === 'number' && parsed.depositAmount >= 0
        ? parsed.depositAmount
        : null,
  };
}
