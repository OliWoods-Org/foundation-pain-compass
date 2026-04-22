/**
 * Self-Management — Evidence-based chronic pain self-management tools.
 * @module self-management
 * @license GPL-3.0
 * @author OliWoods Foundation
 */
import { z } from 'zod';

export const TechniqueSchema = z.object({
  id: z.string(), name: z.string(), category: z.enum(['movement', 'mindfulness', 'cbt', 'pacing', 'sleep', 'social', 'nutrition']),
  description: z.string(), evidenceLevel: z.enum(['strong', 'moderate', 'emerging']),
  duration: z.string(), frequency: z.string(),
  contraindications: z.array(z.string()), instructions: z.array(z.string()),
});

export const FlareUpPlanSchema = z.object({
  userId: z.string(), triggers: z.array(z.string()),
  earlyWarnings: z.array(z.string()),
  immediateActions: z.array(z.object({ action: z.string(), category: z.string() })),
  medicationPlan: z.array(z.object({ medication: z.string(), dose: z.string(), maxPerDay: z.number(), notes: z.string() })),
  whenToSeekHelp: z.array(z.string()),
  supportContacts: z.array(z.object({ name: z.string(), role: z.string(), phone: z.string() })),
});

export const GoalSchema = z.object({
  id: z.string().uuid(), userId: z.string(),
  goal: z.string(), category: z.enum(['function', 'activity', 'social', 'work', 'sleep', 'mood']),
  baseline: z.string(), target: z.string(), timeline: z.string(),
  steps: z.array(z.object({ step: z.string(), completed: z.boolean() })),
  progress: z.number().min(0).max(100),
});

export type Technique = z.infer<typeof TechniqueSchema>;
export type FlareUpPlan = z.infer<typeof FlareUpPlanSchema>;
export type Goal = z.infer<typeof GoalSchema>;

const TECHNIQUES: Technique[] = [
  { id: 'graded-exercise', name: 'Graded Exercise Therapy', category: 'movement', description: 'Gradually increase physical activity from a tolerable baseline using time-based (not pain-based) progression.', evidenceLevel: 'strong', duration: '10-30 min', frequency: 'Daily', contraindications: ['Acute injury', 'Unstable cardiac condition'], instructions: ['Start at 50% of your current comfortable activity level', 'Increase by 10% each week', 'Use time, not pain, as your guide', 'Rest days are part of the plan'] },
  { id: 'body-scan', name: 'Body Scan Meditation', category: 'mindfulness', description: 'Progressive attention to body sensations to reduce tension and change relationship with pain.', evidenceLevel: 'strong', duration: '10-20 min', frequency: 'Daily', contraindications: ['Active PTSD without therapist guidance'], instructions: ['Lie down or sit comfortably', 'Start at your feet and slowly move attention upward', 'Notice sensations without trying to change them', 'Breathe into areas of tension'] },
  { id: 'pacing', name: 'Activity Pacing', category: 'pacing', description: 'Break activities into manageable chunks with planned rest to prevent boom-bust cycles.', evidenceLevel: 'strong', duration: 'All day', frequency: 'Daily', contraindications: [], instructions: ['Identify your baseline tolerance for each activity', 'Set a timer and stop BEFORE pain increases', 'Take planned rest breaks (not reactive)', 'Gradually extend activity periods over weeks'] },
  { id: 'thought-record', name: 'CBT Pain Thought Record', category: 'cbt', description: 'Identify and challenge unhelpful thoughts about pain that amplify suffering.', evidenceLevel: 'strong', duration: '10 min', frequency: '3x/week', contraindications: [], instructions: ['Record the situation and pain level', 'Write the automatic thought ("I can\'t do anything")', 'Rate how much you believe it (0-100%)', 'Find evidence for and against', 'Create a balanced alternative thought'] },
  { id: 'sleep-hygiene', name: 'Pain-Specific Sleep Hygiene', category: 'sleep', description: 'Optimize sleep despite pain using environmental and behavioral strategies.', evidenceLevel: 'moderate', duration: 'Ongoing', frequency: 'Nightly', contraindications: [], instructions: ['Same bedtime/waketime every day', 'Cool, dark room (65-68F)', 'No screens 1 hour before bed', 'Pain medication timing to cover sleep onset', 'Body pillow positioning for pain relief'] },
];

export function recommendTechniques(conditions: string[], currentPainLevel: number): Technique[] {
  // During flares, prioritize passive techniques
  if (currentPainLevel >= 7) return TECHNIQUES.filter(t => ['mindfulness', 'pacing', 'sleep'].includes(t.category));
  return TECHNIQUES;
}

export function createFlareUpPlan(userId: string, triggers: string[], medications: Array<{ name: string; dose: string; maxPerDay: number }>): FlareUpPlan {
  return FlareUpPlanSchema.parse({
    userId, triggers,
    earlyWarnings: ['Increased stiffness in the morning', 'Sleep quality declining', 'Irritability or anxiety increasing', 'Doing more than planned on "good days"'],
    immediateActions: [
      { action: 'Apply ice or heat (whichever works for you) for 15-20 minutes', category: 'physical' },
      { action: 'Practice 5-minute breathing exercise', category: 'mindfulness' },
      { action: 'Reduce activity to 50% of your normal baseline', category: 'pacing' },
      { action: 'Take prescribed as-needed medication', category: 'medication' },
      { action: 'Gentle stretching or position changes every 30 minutes', category: 'movement' },
    ],
    medicationPlan: medications.map(m => ({ ...m, notes: 'Take at first sign of flare — do not wait for severe pain' })),
    whenToSeekHelp: ['Pain is 9-10/10 and not responding to any intervention', 'New neurological symptoms (weakness, numbness, bowel/bladder changes)', 'Pain is accompanied by fever', 'You are unable to perform basic self-care', 'You are having thoughts of self-harm (call 988 immediately)'],
    supportContacts: [],
  });
}

export function generateSmartGoal(category: Goal['category'], description: string): Omit<Goal, 'id' | 'userId'> {
  const templates: Record<string, { baseline: string; target: string; timeline: string; steps: string[] }> = {
    function: { baseline: 'Current functional level', target: 'Improved daily function', timeline: '8 weeks', steps: ['Establish current baseline', 'Set weekly micro-goals', 'Track progress daily', 'Adjust pace as needed'] },
    activity: { baseline: 'Current activity tolerance', target: '20% increase in activity tolerance', timeline: '6 weeks', steps: ['Measure current tolerance in minutes', 'Increase by 10% per week', 'Use pacing strategies', 'Celebrate milestones'] },
    sleep: { baseline: 'Current sleep quality', target: '6+ hours uninterrupted sleep', timeline: '4 weeks', steps: ['Implement sleep hygiene protocol', 'Consistent sleep/wake times', 'Optimize pain medication timing', 'Track sleep quality daily'] },
    mood: { baseline: 'Current mood rating', target: '30% reduction in pain-related distress', timeline: '6 weeks', steps: ['Daily mood tracking', 'Practice CBT thought records 3x/week', 'One pleasurable activity daily', 'Weekly self-compassion exercise'] },
    social: { baseline: 'Current social engagement', target: 'One social activity per week', timeline: '4 weeks', steps: ['Identify low-energy social options', 'Plan activity around best time of day', 'Communicate needs to friends/family', 'Pace social activities'] },
    work: { baseline: 'Current work capacity', target: 'Sustainable work schedule', timeline: '8 weeks', steps: ['Identify workplace accommodations needed', 'Discuss ergonomic setup', 'Plan break schedule', 'Gradual return-to-work if applicable'] },
  };
  const t = templates[category] || templates.function;
  return { goal: description, category, baseline: t.baseline, target: t.target, timeline: t.timeline, steps: t.steps.map(s => ({ step: s, completed: false })), progress: 0 };
}
