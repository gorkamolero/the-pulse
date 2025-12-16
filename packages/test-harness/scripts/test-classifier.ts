#!/usr/bin/env npx tsx
/**
 * Test script for classifier discussion detection
 *
 * Run with: npx tsx lib/test-harness/scripts/test-classifier.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { classifyOutput } from '../session/classifier';

const testCases = [
  // Character creation
  {
    name: 'Character creation - who are you',
    input:
      'Who are you? Give me a brief backstory. Are you a journalist? A genealogist? A drifter?',
    expected: 'requires-discussion',
  },
  {
    name: 'Character creation - backstory',
    input: 'Tell me about yourselves. What brings you to Innsmouth?',
    expected: 'requires-discussion',
  },
  // Equipment selection
  {
    name: 'Equipment selection',
    input:
      "Now—what do you carry? Each of you, name one tool or item you've brought.",
    expected: 'requires-discussion',
  },
  // Path decisions
  {
    name: 'Path decision - which way',
    input:
      'The spiral symbols continue down the main street, but a narrow alley veers left—toward the church. The shuffling figure went right, toward the harbor. Which way?',
    expected: 'requires-discussion',
  },
  {
    name: 'Path decision - binary',
    input: 'Door A leads to the basement. Door B leads upstairs. Which way?',
    expected: 'requires-discussion',
  },
  // Accept/reject
  {
    name: 'Accept/reject offer',
    input:
      'The old woman holds out a rusted key. "Take it. Or leave, and wonder forever."',
    expected: 'requires-discussion',
  },
  // Point of no return
  {
    name: 'Point of no return - enter',
    input:
      'The key fits the lock. You can feel it waiting to turn. Do you enter?',
    expected: 'requires-discussion',
  },
  // Tactical choices
  {
    name: 'Tactical choice - up/down/hold',
    input:
      "Footsteps creak above. A trapdoor leads below. The creature's breathing grows louder. Up, down, or hold your ground?",
    expected: 'requires-discussion',
  },
  // Climactic moment
  {
    name: 'Climactic - run or stay',
    input:
      'Alma throws herself between Esther and the creature. "Run," she gasps. Do you run? Or do you stay?',
    expected: 'requires-discussion',
  },
  // Should NOT be discussion
  {
    name: 'Regular pulse - scene setting',
    input:
      'The bus rattles to a stop at the edge of Innsmouth. Salt wind cuts through the broken windows. Before you lies a town of decaying Victorian houses, their paint peeling like dead skin.',
    expected: 'pulse',
  },
  {
    name: 'Regular pulse - discovery',
    input:
      'You find a leather journal tucked behind the bookshelf. The pages are filled with strange symbols and dates going back decades.',
    expected: 'pulse',
  },
];

async function runTests() {
  console.log('🧪 Testing Classifier Discussion Detection\n');
  console.log(`${'='.repeat(60)}\n`);

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = await classifyOutput(testCase.input, {
      playerNames: ['Esther', 'Neal', 'Priscilla'],
    });

    const success = result.type === testCase.expected;
    const icon = success ? '✅' : '❌';

    console.log(`${icon} ${testCase.name}`);
    console.log(`   Input: "${testCase.input.slice(0, 60)}..."`);
    console.log(`   Expected: ${testCase.expected}`);
    console.log(
      `   Got: ${result.type} (confidence: ${result.confidence.toFixed(2)})`,
    );
    console.log(`   Reasoning: ${result.reasoning}`);
    console.log('');

    if (success) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('='.repeat(60));
  console.log(
    `\n📊 Results: ${passed}/${testCases.length} passed, ${failed} failed\n`,
  );

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
