/**
 * Stories narrated live by an ElevenLabs agent instead of the text model + TTS pipeline.
 * Agents are public (no auth), so the browser connects with the id alone.
 * Created with scripts/create-narrator-agent.ts; tuned with scripts/narrator-agent-config.ts.
 */
const NARRATOR_AGENTS: Record<string, { solo: string; group: string }> = {
  "shadow-over-innsmouth": {
    solo: "agent_0801m498yyw3ey2vmx5t6hs8ynat",
    group: "agent_7201m4btya9ef3pte07m37epee9f",
  },
  "the-hollow-choir": {
    solo: "agent_3501m49wjk55fhqvkg78eghydx3m",
    group: "agent_5801m4btyq5aedzaqxj1je75tkkp",
  },
  "whispering-pines": {
    solo: "agent_1001m49wjqgkfrwrg471a13htpcq",
    group: "agent_0401m4btyvedfs8rert3kbke67f0",
  },
  "siren-of-the-red-dust": {
    solo: "agent_1201m49wjtp4e1ssndh0rfzav9a5",
    group: "agent_1501m4btz1adepdrp3sx8696q374",
  },
  "endless-path": {
    solo: "agent_4101m49wjzewet5vsqk36xnq556a",
    group: "agent_4501m4btz6rdfvfa56wh4k1333mj",
  },
};

/** The agent narrating a story; group play gets the narrator that sets up players first */
export function getNarratorAgentId(storyId: string | null | undefined, solo = true): string | null {
  const agents = storyId ? NARRATOR_AGENTS[storyId] : undefined;
  return (agents && (solo ? agents.solo : agents.group)) || null;
}
