import { atomWithStorage } from "jotai/utils";

// Atom to control the expansion state of reasoning in messages
export const showReasoningAtom = atomWithStorage("reasoningExpanded", false);
