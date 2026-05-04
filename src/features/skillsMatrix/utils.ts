export function cleanName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 16);
}

export function assessmentKey(skillId: string, participantId: string) {
  return `${skillId}:${participantId}`;
}
