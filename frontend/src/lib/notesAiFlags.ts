function envBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export const notesAiFlags = {
  phaseA: envBool(process.env.NEXT_PUBLIC_FEATURE_NOTES_AI_PHASE_A, true),
  phaseB: envBool(process.env.NEXT_PUBLIC_FEATURE_NOTES_AI_PHASE_B, true),
  phaseC: envBool(process.env.NEXT_PUBLIC_FEATURE_NOTES_AI_PHASE_C, true),
  phaseD: envBool(process.env.NEXT_PUBLIC_FEATURE_NOTES_AI_PHASE_D, true),
  phaseE: envBool(process.env.NEXT_PUBLIC_FEATURE_NOTES_AI_PHASE_E, true),
  phaseF: envBool(process.env.NEXT_PUBLIC_FEATURE_NOTES_AI_PHASE_F, true),
}

