import { readFile, writeFile } from 'node:fs/promises';

const labels = JSON.parse(await readFile('calibration/character-creation-labels.json', 'utf8')) as {
  sessions: { sessionId: string; stack: string; expectedScoreBand: [number, number]; uncertain: boolean }[];
};
const criteria = ['agencyRespect', 'equipmentEngagement', 'npcDialogue', 'spatialConsistency',
  'characterCreation', 'invitationArchitecture', 'atmosphere', 'curiosityFollowing', 'pacingBreath',
  'declarationVsAcknowledgment', 'branchingPersistence', 'actionableVsAtmospheric'] as const;
type Evaluation = Record<(typeof criteria)[number], { score: number; notes: string; evidence: unknown[] }>;
const summaries = [];
for (const model of ['codex', 'gemini']) {
  const rows = [];
  for (const label of labels.sessions) {
    const load = async (phase: string) => JSON.parse(await readFile(`calibration/results/${phase}-${model}/${label.sessionId}.json`, 'utf8')) as Evaluation;
    const before = await load('before');
    const after = await load('after');
    const agrees = (score: number) => score >= label.expectedScoreBand[0] && score <= label.expectedScoreBand[1];
    rows.push({ ...label, before: before.characterCreation.score, after: after.characterCreation.score,
      agreementBefore: agrees(before.characterCreation.score), agreementAfter: agrees(after.characterCreation.score),
      reasonBefore: before.characterCreation.notes, reasonAfter: after.characterCreation.notes,
      criteria: Object.fromEntries(criteria.map((key) => [key, { before: before[key].score, after: after[key].score, delta: after[key].score - before[key].score }])),
    });
  }
  summaries.push({ model, agreementBefore: rows.filter((r) => r.agreementBefore).length,
    agreementAfter: rows.filter((r) => r.agreementAfter).length, count: rows.length,
    certainAgreementBefore: rows.filter((r) => !r.uncertain && r.agreementBefore).length,
    certainAgreementAfter: rows.filter((r) => !r.uncertain && r.agreementAfter).length,
    certainCount: rows.filter((r) => !r.uncertain).length,
    meanCriteria: Object.fromEntries(criteria.map((key) => {
      const mean = (phase: 'before' | 'after') => rows.reduce((sum, r) => sum + r.criteria[key][phase], 0) / rows.length;
      return [key, { before: mean('before'), after: mean('after'), delta: mean('after') - mean('before'),
        movedSessions: rows.filter((r) => r.criteria[key].delta !== 0).length }];
    })), rows,
  });
}
await writeFile('calibration/results/comparison.json', JSON.stringify(summaries, null, 2) + '\n');
for (const summary of summaries) {
  console.log(`${summary.model}: ${summary.agreementBefore}/${summary.count} -> ${summary.agreementAfter}/${summary.count}`);
  for (const row of summary.rows) console.log(`${row.sessionId} ${row.expectedScoreBand.join('-')} ${row.before} -> ${row.after}`);
  console.log(JSON.stringify(summary.meanCriteria, null, 2));
}
