/**
 * Pain Tracker — Multi-modal chronic pain tracking with pattern detection.
 * @module pain-tracker
 * @license GPL-3.0
 * @author OliWoods Foundation
 */
import { z } from 'zod';

export const PainEntrySchema = z.object({
  id: z.string().uuid(), userId: z.string(), timestamp: z.string().datetime(),
  intensity: z.number().int().min(0).max(10),
  locations: z.array(z.object({ bodyPart: z.string(), side: z.enum(['left', 'right', 'bilateral', 'center']), surfaceArea: z.enum(['point', 'small', 'medium', 'large']) })),
  quality: z.array(z.enum(['aching', 'burning', 'sharp', 'stabbing', 'throbbing', 'tingling', 'numbness', 'cramping', 'shooting', 'dull', 'pressure'])),
  duration: z.enum(['constant', 'intermittent', 'brief-episodes']),
  triggers: z.array(z.string()).default([]),
  relievers: z.array(z.string()).default([]),
  medications: z.array(z.object({ name: z.string(), dose: z.string(), effectiveness: z.enum(['none', 'slight', 'moderate', 'significant', 'complete']) })).default([]),
  functionalImpact: z.object({ mobility: z.number().int().min(0).max(10), sleep: z.number().int().min(0).max(10), mood: z.number().int().min(0).max(10), work: z.number().int().min(0).max(10), social: z.number().int().min(0).max(10) }),
  weather: z.object({ temperature: z.number().optional(), humidity: z.number().optional(), barometricPressure: z.number().optional() }).optional(),
  notes: z.string().optional(),
});

export const PatternAnalysisSchema = z.object({
  userId: z.string(), period: z.object({ start: z.string(), end: z.string() }),
  averageIntensity: z.number(), worstTime: z.string().optional(), bestTime: z.string().optional(),
  topTriggers: z.array(z.object({ trigger: z.string(), frequency: z.number(), avgIntensityIncrease: z.number() })),
  topRelievers: z.array(z.object({ reliever: z.string(), frequency: z.number(), avgIntensityDecrease: z.number() })),
  medicationEffectiveness: z.array(z.object({ medication: z.string(), avgEffectiveness: z.number(), usageCount: z.number() })),
  weatherCorrelation: z.object({ pressureCorrelation: z.number().optional(), humidityCorrelation: z.number().optional() }).optional(),
  flarePattern: z.string(), functionalTrend: z.string(),
});

export const ProviderReportSchema = z.object({
  userId: z.string(), generatedAt: z.string().datetime(), periodDays: z.number(),
  summary: z.string(), averagePain: z.number(), painRange: z.object({ min: z.number(), max: z.number() }),
  topLocations: z.array(z.string()), topQualities: z.array(z.string()),
  medicationLog: z.array(z.object({ name: z.string(), effectiveness: z.string(), daysUsed: z.number() })),
  functionalScores: z.record(z.string(), z.number()),
  patientConcerns: z.array(z.string()),
});

export type PainEntry = z.infer<typeof PainEntrySchema>;
export type PatternAnalysis = z.infer<typeof PatternAnalysisSchema>;
export type ProviderReport = z.infer<typeof ProviderReportSchema>;

export function analyzePainPatterns(entries: PainEntry[]): PatternAnalysis {
  if (entries.length === 0) return emptyAnalysis();
  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const avgIntensity = Math.round(entries.reduce((s, e) => s + e.intensity, 0) / entries.length * 10) / 10;

  // Time-of-day analysis
  const byHour = new Map<number, number[]>();
  for (const e of entries) { const h = new Date(e.timestamp).getHours(); if (!byHour.has(h)) byHour.set(h, []); byHour.get(h)!.push(e.intensity); }
  let worstHour = 0, bestHour = 0, worstAvg = 0, bestAvg = 10;
  for (const [h, vals] of byHour) { const avg = vals.reduce((s, v) => s + v, 0) / vals.length; if (avg > worstAvg) { worstAvg = avg; worstHour = h; } if (avg < bestAvg) { bestAvg = avg; bestHour = h; } }

  // Triggers
  const triggerCounts = new Map<string, { count: number; totalIntensity: number }>();
  for (const e of entries) for (const t of e.triggers) {
    if (!triggerCounts.has(t)) triggerCounts.set(t, { count: 0, totalIntensity: 0 });
    const tc = triggerCounts.get(t)!; tc.count++; tc.totalIntensity += e.intensity;
  }
  const topTriggers = Array.from(triggerCounts.entries()).map(([trigger, { count, totalIntensity }]) => ({
    trigger, frequency: count, avgIntensityIncrease: Math.round((totalIntensity / count - avgIntensity) * 10) / 10,
  })).sort((a, b) => b.frequency - a.frequency).slice(0, 5);

  // Relievers
  const relieverCounts = new Map<string, { count: number; totalIntensity: number }>();
  for (const e of entries) for (const r of e.relievers) {
    if (!relieverCounts.has(r)) relieverCounts.set(r, { count: 0, totalIntensity: 0 });
    const rc = relieverCounts.get(r)!; rc.count++; rc.totalIntensity += e.intensity;
  }
  const topRelievers = Array.from(relieverCounts.entries()).map(([reliever, { count, totalIntensity }]) => ({
    reliever, frequency: count, avgIntensityDecrease: Math.round((avgIntensity - totalIntensity / count) * 10) / 10,
  })).sort((a, b) => b.avgIntensityDecrease - a.avgIntensityDecrease).slice(0, 5);

  // Medication effectiveness
  const medStats = new Map<string, { total: number; count: number }>();
  const effMap = { none: 0, slight: 1, moderate: 2, significant: 3, complete: 4 };
  for (const e of entries) for (const m of e.medications) {
    if (!medStats.has(m.name)) medStats.set(m.name, { total: 0, count: 0 });
    const ms = medStats.get(m.name)!; ms.total += effMap[m.effectiveness]; ms.count++;
  }

  return PatternAnalysisSchema.parse({
    userId: entries[0].userId,
    period: { start: sorted[0].timestamp, end: sorted[sorted.length - 1].timestamp },
    averageIntensity: avgIntensity, worstTime: `${worstHour}:00`, bestTime: `${bestHour}:00`,
    topTriggers, topRelievers,
    medicationEffectiveness: Array.from(medStats.entries()).map(([medication, { total, count }]) => ({
      medication, avgEffectiveness: Math.round(total / count * 10) / 10, usageCount: count,
    })),
    flarePattern: avgIntensity > 6 ? 'Sustained high pain — consider treatment adjustment' : 'Variable pain with identifiable patterns',
    functionalTrend: 'See functional impact scores for detailed breakdown',
  });
}

export function generateProviderReport(entries: PainEntry[], periodDays: number): ProviderReport {
  const analysis = analyzePainPatterns(entries);
  const allLocations = entries.flatMap(e => e.locations.map(l => `${l.bodyPart} (${l.side})`));
  const locationCounts = new Map<string, number>();
  for (const l of allLocations) locationCounts.set(l, (locationCounts.get(l) || 0) + 1);
  const topLocations = Array.from(locationCounts.entries()).sort(([, a], [, b]) => b - a).slice(0, 3).map(([l]) => l);
  const allQualities = entries.flatMap(e => e.quality);
  const qualityCounts = new Map<string, number>();
  for (const q of allQualities) qualityCounts.set(q, (qualityCounts.get(q) || 0) + 1);
  const topQualities = Array.from(qualityCounts.entries()).sort(([, a], [, b]) => b - a).slice(0, 3).map(([q]) => q);
  const intensities = entries.map(e => e.intensity);

  return ProviderReportSchema.parse({
    userId: entries[0]?.userId || '', generatedAt: new Date().toISOString(), periodDays,
    summary: `Over the past ${periodDays} days, ${entries.length} pain entries were recorded with an average intensity of ${analysis.averageIntensity}/10. Primary pain locations: ${topLocations.join(', ')}. Pain qualities: ${topQualities.join(', ')}.`,
    averagePain: analysis.averageIntensity, painRange: { min: Math.min(...intensities), max: Math.max(...intensities) },
    topLocations, topQualities,
    medicationLog: analysis.medicationEffectiveness.map(m => ({ name: m.medication, effectiveness: m.avgEffectiveness > 2.5 ? 'Effective' : m.avgEffectiveness > 1 ? 'Partial' : 'Minimal', daysUsed: m.usageCount })),
    functionalScores: { mobility: avgField(entries, 'mobility'), sleep: avgField(entries, 'sleep'), mood: avgField(entries, 'mood'), work: avgField(entries, 'work'), social: avgField(entries, 'social') },
    patientConcerns: analysis.averageIntensity > 6 ? ['Pain consistently above 6/10 — review treatment plan'] : [],
  });
}

function avgField(entries: PainEntry[], field: keyof PainEntry['functionalImpact']): number {
  return Math.round(entries.reduce((s, e) => s + e.functionalImpact[field], 0) / entries.length * 10) / 10;
}

function emptyAnalysis(): PatternAnalysis {
  return PatternAnalysisSchema.parse({ userId: '', period: { start: '', end: '' }, averageIntensity: 0, topTriggers: [], topRelievers: [], medicationEffectiveness: [], flarePattern: 'Insufficient data', functionalTrend: 'Insufficient data' });
}
