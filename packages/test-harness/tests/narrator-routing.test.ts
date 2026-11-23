import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PlayerAgent } from '../agents/player';
import { buildFirstTurnPrompt, directedPlayer, narratorVisibleHistory } from '../session/runner';
import type { Message } from '../session/turn';
import { createInitialState } from '../session/state';

test('only public directed replies bypass the spokesperson', () => {
  const history: Message[] = [
    { role: 'player', player: 'Alex', content: 'banter', turn: 0, timestamp: 0 },
    { role: 'narrator', content: 'Who are you?', classification: 'directed-questions', turn: 1, timestamp: 1 },
    { role: 'player', player: 'Alex', content: 'I am Arthur.', turn: 1, timestamp: 2 },
    { role: 'narrator', content: 'A secret', classification: 'private-moment', turn: 2, timestamp: 3 },
    { role: 'player', player: 'Alex', content: 'private answer', turn: 2, timestamp: 4 },
    { role: 'narrator', content: 'Choose', classification: 'requires-discussion', turn: 3, timestamp: 5 },
    { role: 'player', player: 'Alex', content: 'private discussion', turn: 3, timestamp: 6 },
    { role: 'spokesperson', player: 'Alex', content: 'We choose left.', turn: 3, timestamp: 7 },
  ];
  assert.deepEqual(narratorVisibleHistory(history).map((message) => message.content), [
    'Who are you?', 'I am Arthur.', 'A secret', 'Choose', 'We choose left.',
  ]);
});

test('directed routing accepts player and unique character names, never guesses ambiguity', () => {
  const players = [{ name: 'Alex' }, { name: 'Jordan' }] as PlayerAgent[];
  const state = createInitialState();
  state.characters = [
    { odName: 'Alex', idName: 'Arthur Bell', items: [], role: 'player' },
    { odName: 'Jordan', idName: 'Clara Vale', items: [], role: 'spokesperson' },
  ];
  assert.equal(directedPlayer('alex', players, state), players[0]);
  assert.equal(directedPlayer('Arthur Bell', players, state), players[0]);
  assert.equal(directedPlayer('Arthur', players, state), players[0]);
  assert.equal(directedPlayer('Clara', players, state), players[1]);
  assert.equal(directedPlayer('Unknown', players, state), undefined);
  state.characters[1].idName = 'Arthur Vale';
  assert.equal(directedPlayer('Arthur', players, state), undefined);
});

test('opening request never certifies banter as completed setup or orders setup skipped', () => {
  const empty = buildFirstTurnPrompt([]);
  const banter = buildFirstTurnPrompt([
    { role: 'player', player: 'Alex', content: 'Ready for game night!', turn: 0, timestamp: 0 },
    { role: 'narrator', content: 'Later narration', turn: 1, timestamp: 1 },
  ]);
  for (const prompt of [empty, banter]) {
    assert.match(prompt, /Follow your setup instructions before beginning the story/);
    assert.doesNotMatch(prompt, /already completed|Do not ask|Begin the story now/);
  }
  assert.match(banter, /not confirmation that character setup is complete/);
  assert.match(banter, /Ready for game night!/);
  assert.doesNotMatch(banter, /Later narration/);
});
