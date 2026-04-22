/**
 * Opioid Safety — Risk assessment and safe use guidance for opioid medications.
 * @module opioid-safety
 * @license GPL-3.0
 * @author OliWoods Foundation
 */
import { z } from 'zod';

export const OpioidRiskAssessmentSchema = z.object({
  userId: z.string(), assessmentDate: z.string().datetime(),
  riskLevel: z.enum(['low', 'moderate', 'high']),
  riskScore: z.number().min(0).max(100),
  factors: z.array(z.object({ factor: z.string(), present: z.boolean(), weight: z.number() })),
  recommendations: z.array(z.string()),
  naloxoneRecommended: z.boolean(),
});

export const MorphineEquivalentSchema = z.object({
  medications: z.array(z.object({ name: z.string(), dailyDose: z.number(), unit: z.string(), mmeConversionFactor: z.number(), dailyMME: z.number() })),
  totalDailyMME: z.number(), riskTier: z.enum(['standard', 'elevated', 'high-risk']),
  cdcGuidance: z.string(),
});

export type OpioidRiskAssessment = z.infer<typeof OpioidRiskAssessmentSchema>;
export type MorphineEquivalent = z.infer<typeof MorphineEquivalentSchema>;

const MME_FACTORS: Record<string, number> = {
  'codeine': 0.15, 'hydrocodone': 1, 'hydromorphone': 4, 'morphine': 1, 'oxycodone': 1.5,
  'oxymorphone': 3, 'tramadol': 0.1, 'fentanyl-patch-mcg/hr': 2.4, 'methadone-1-20mg': 4,
  'methadone-21-40mg': 8, 'methadone-41-60mg': 10, 'tapentadol': 0.4,
};

const RISK_FACTORS = [
  { factor: 'History of substance use disorder', weight: 25 },
  { factor: 'Mental health condition (depression, anxiety, PTSD)', weight: 15 },
  { factor: 'Age 18-25', weight: 10 },
  { factor: 'Concurrent benzodiazepine use', weight: 20 },
  { factor: 'Daily MME > 50', weight: 15 },
  { factor: 'Sleep apnea or respiratory condition', weight: 15 },
  { factor: 'History of overdose', weight: 30 },
  { factor: 'Living alone', weight: 5 },
];

export function assessOpioidRisk(userId: string, presentFactors: string[]): OpioidRiskAssessment {
  const factors = RISK_FACTORS.map(rf => ({
    factor: rf.factor, present: presentFactors.some(pf => pf.toLowerCase().includes(rf.factor.toLowerCase().slice(0, 15))),
    weight: rf.weight,
  }));
  const score = Math.min(100, factors.filter(f => f.present).reduce((s, f) => s + f.weight, 0));
  const riskLevel: OpioidRiskAssessment['riskLevel'] = score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low';
  const recommendations: string[] = [];
  if (score >= 25) recommendations.push('Obtain naloxone (Narcan) and train household members on use — available without prescription at most pharmacies');
  if (factors.find(f => f.factor.includes('benzodiazepine') && f.present)) recommendations.push('CRITICAL: Concurrent opioid + benzodiazepine use increases overdose risk significantly. Discuss tapering plan with provider.');
  if (score >= 50) recommendations.push('Consider non-opioid pain management alternatives (PT, CBT, nerve blocks, NSAIDS)');
  recommendations.push('Never take more than prescribed', 'Store medications locked and away from others', 'Dispose of unused opioids at a DEA take-back location (dea.gov/takebackday)');
  return OpioidRiskAssessmentSchema.parse({
    userId, assessmentDate: new Date().toISOString(), riskLevel, riskScore: score,
    factors, recommendations, naloxoneRecommended: score >= 20,
  });
}

export function calculateMME(medications: Array<{ name: string; dailyDose: number; unit: string }>): MorphineEquivalent {
  const meds = medications.map(m => {
    const factor = MME_FACTORS[m.name.toLowerCase()] || 1;
    return { ...m, mmeConversionFactor: factor, dailyMME: Math.round(m.dailyDose * factor * 10) / 10 };
  });
  const totalMME = Math.round(meds.reduce((s, m) => s + m.dailyMME, 0) * 10) / 10;
  const riskTier: MorphineEquivalent['riskTier'] = totalMME >= 90 ? 'high-risk' : totalMME >= 50 ? 'elevated' : 'standard';
  const cdcGuidance = totalMME >= 90
    ? 'CDC recommends avoiding doses >= 90 MME/day or carefully justifying the decision. Overdose risk is significantly elevated.'
    : totalMME >= 50
    ? 'CDC recommends increased caution above 50 MME/day. Consider naloxone co-prescribing and more frequent monitoring.'
    : 'Within CDC recommended range. Continue monitoring.';
  return MorphineEquivalentSchema.parse({ medications: meds, totalDailyMME: totalMME, riskTier, cdcGuidance });
}
