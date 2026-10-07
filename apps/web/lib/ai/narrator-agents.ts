/**
 * Stories narrated live by an ElevenLabs agent instead of the text model + TTS pipeline.
 * Agents are public (no auth), so the browser connects with the id alone.
 * Created with scripts/create-narrator-agent.ts; tuned with scripts/narrator-agent-config.ts.
 */
const NARRATOR_AGENTS: Record<string, string> = {
  "shadow-over-innsmouth": "agent_0801m498yyw3ey2vmx5t6hs8ynat",
  "the-hollow-choir": "agent_3501m49wjk55fhqvkg78eghydx3m",
  "whispering-pines": "agent_1001m49wjqgkfrwrg471a13htpcq",
  "siren-of-the-red-dust": "agent_1201m49wjtp4e1ssndh0rfzav9a5",
  "endless-path": "agent_4101m49wjzewet5vsqk36xnq556a",
};

export function getNarratorAgentId(storyId: string | null | undefined): string | null {
  return (storyId && NARRATOR_AGENTS[storyId]) || null;
}
