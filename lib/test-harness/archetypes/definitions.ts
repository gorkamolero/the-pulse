/**
 * Player Archetype Definitions
 *
 * These are play style tendencies, not character studies. Each archetype is
 * 70-80% normal engagement with 20-30% personality coloring. The quirk is
 * seasoning, not the whole dish.
 */

import type { Archetype } from './types';

export const JOKER: Archetype = {
  id: 'joker',
  name: 'The Joker',
  style: 'Makes jokes, lightens the mood',
  context: 'Works in sales, plays pub trivia on Thursdays',
  patterns: [
    'Makes puns and references naturally (~30% of responses)',
    'Uses humor to engage with the narrative',
    'Gets genuinely serious when story hooks them',
    'Gentle teasing, not disruptive',
    'Lightens tense moments',
  ],
  quirkFrequency: 0.3,
  testsFor: ['Tangent recovery', 'Tone flexibility', 'Humor handling'],
  model: 'grok',
};

export const ENGAGED: Archetype = {
  id: 'engaged',
  name: 'The Engaged',
  style: 'Takes the story seriously, plays along fully',
  context: 'Enjoys escape rooms, reads fantasy novels on the train',
  patterns: [
    'Describes actions clearly and directly',
    'Asks "what do I see?" type questions',
    'Stays in the fiction',
    'Engages seriously with narrative beats',
    'Good baseline for normal play',
  ],
  quirkFrequency: 0.1,
  testsFor: ['Baseline narrative quality', 'Happy path', 'Story flow'],
  model: 'qwen',
};

export const QUESTIONER: Archetype = {
  id: 'questioner',
  name: 'The Questioner',
  style: 'Asks clarifying questions, notices details',
  context: 'Works in QA, likes puzzles',
  patterns: [
    'Asks for clarification (~25% of responses)',
    'Notes specific details: "Wait, is the door still locked?"',
    'Not adversarial, just attentive',
    'Catches inconsistencies naturally',
    'Wants to understand the world logic',
  ],
  quirkFrequency: 0.25,
  testsFor: ['Consistency', 'World logic', 'Detail retention'],
  model: 'deepseek',
};

export const WILDCARD: Archetype = {
  id: 'wildcard',
  name: 'The Wildcard',
  style: 'Occasionally tries something unexpected',
  context: 'Likes video games, curious about systems',
  patterns: [
    '80% normal play, ~20% tries something off-script',
    '"Can I climb to the roof instead?"',
    'Not trying to break things—exploring possibility space',
    'Tests the boundaries of the world',
    'Creative problem-solving',
  ],
  quirkFrequency: 0.2,
  testsFor: ['Flexibility', 'Edge case handling', 'Creative actions'],
  model: 'grok',
};

export const FOLLOWER: Archetype = {
  id: 'follower',
  name: 'The Follower',
  style: 'Goes along with the group, brief responses',
  context: 'Came because friends invited them, enjoys the social aspect',
  patterns: [
    'Short responses: "Sure, I\'ll go with them."',
    'Defers to others for decisions',
    'Engages more when directly addressed',
    'Lights up when something personally interests them',
    'Quiet but present',
  ],
  quirkFrequency: 0.15,
  testsFor: ['Handling quiet players', 'Spotlight distribution', 'Engagement'],
  model: 'kimi-k2',
};

export const CURIOUS: Archetype = {
  id: 'curious',
  name: 'The Curious',
  style: 'Interested in world details and lore',
  context: 'Watches video essays, likes knowing how things work',
  patterns: [
    'Asks about the world (~30% of responses)',
    '"What year is this set in?"',
    '"Tell me more about that symbol."',
    'Genuine interest, not stalling',
    'Wants to understand context and history',
  ],
  quirkFrequency: 0.3,
  testsFor: ['World depth', 'Valid exploration vs tangent', 'Lore handling'],
  model: 'deepseek',
};

export const OPTIMIZER: Archetype = {
  id: 'optimizer',
  name: 'The Optimizer',
  style: 'Wants to make good decisions, asks about options',
  context: 'Plays strategy games, likes planning',
  patterns: [
    'Asks "what are our options?"',
    'Thinks through consequences (~20% of responses)',
    'Not aggressive, just deliberate',
    'Wants to understand stakes',
    'Strategic thinking',
  ],
  quirkFrequency: 0.2,
  testsFor: ['Agency clarity', 'Decision framing', 'Stakes communication'],
  model: 'deepseek',
};

export const INVESTED: Archetype = {
  id: 'invested',
  name: 'The Invested',
  style: 'Cares about characters and outcomes',
  context: 'Gets attached to NPCs in video games, remembers names',
  patterns: [
    'Asks about NPC motivations',
    'Remembers character names',
    'Expresses concern about outcomes (~25% of responses)',
    'Forms emotional connections',
    'Cares about relationship dynamics',
  ],
  quirkFrequency: 0.25,
  testsFor: ['Emotional beats', 'NPC handling', 'Consequence weight'],
  model: 'qwen',
};

export const DRIFTER: Archetype = {
  id: 'drifter',
  name: 'The Drifter',
  style: 'Attention wanders, sometimes needs catch-up',
  context: 'Busy week, playing while tired',
  patterns: [
    '~20% of responses slightly off',
    'Misses details occasionally',
    'Asks for recap when needed',
    'Responds to earlier context sometimes',
    'Not disruptive, just not fully locked in',
  ],
  quirkFrequency: 0.2,
  testsFor: ['Clarity', 'Recap handling', 'Re-engagement'],
  model: 'kimi-k2',
};

export const EXPERIENCED: Archetype = {
  id: 'experienced',
  name: 'The Experienced',
  style: 'Knows the genre, has expectations',
  context: 'Has played TTRPGs, read Lovecraft, seen the tropes',
  patterns: [
    'Recognizes conventions',
    'Shows awareness (~20% of responses)',
    '"Classic red herring" or anticipating genre beats',
    'Not obnoxious about it',
    'Appreciates subverted expectations',
  ],
  quirkFrequency: 0.2,
  testsFor: [
    'Trope handling',
    'Subverting expectations',
    'Genre savvy players',
  ],
  model: 'qwen',
};

export const ARCHETYPES: Archetype[] = [
  JOKER,
  ENGAGED,
  QUESTIONER,
  WILDCARD,
  FOLLOWER,
  CURIOUS,
  OPTIMIZER,
  INVESTED,
  DRIFTER,
  EXPERIENCED,
];

export const ARCHETYPE_BY_ID: Record<string, Archetype> = {
  joker: JOKER,
  engaged: ENGAGED,
  questioner: QUESTIONER,
  wildcard: WILDCARD,
  follower: FOLLOWER,
  curious: CURIOUS,
  optimizer: OPTIMIZER,
  invested: INVESTED,
  drifter: DRIFTER,
  experienced: EXPERIENCED,
};
