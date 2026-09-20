export type DiffRow = {
  currentText: string | null;
  suggestedText: string | null;
  type: 'unchanged' | 'modified' | 'added' | 'removed';
};

export type AgreementDiffSummary = {
  changedBlocks: number;
  modifiedBlocks: number;
  addedBlocks: number;
  removedBlocks: number;
  totalBlocks: number;
};

export type AgreementDiffResult = {
  rows: DiffRow[];
  summary: AgreementDiffSummary;
};

type DiffOperation =
  | { type: 'unchanged'; left: string; right: string }
  | { type: 'removed'; left: string }
  | { type: 'added'; right: string };

function canonicalizeBlock(block: string): string {
  return block.replace(/\s+/g, ' ').trim();
}

export function splitAgreementBlocks(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();

  if (!normalized) {
    return [];
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.length > 0 ? blocks : [normalized];
}

function buildOperations(leftBlocks: string[], rightBlocks: string[]): DiffOperation[] {
  const leftKeys = leftBlocks.map(canonicalizeBlock);
  const rightKeys = rightBlocks.map(canonicalizeBlock);
  const dp = Array.from({ length: leftBlocks.length + 1 }, () =>
    Array<number>(rightBlocks.length + 1).fill(0),
  );

  for (let i = leftBlocks.length - 1; i >= 0; i -= 1) {
    for (let j = rightBlocks.length - 1; j >= 0; j -= 1) {
      if (leftKeys[i] === rightKeys[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const operations: DiffOperation[] = [];
  let i = 0;
  let j = 0;

  while (i < leftBlocks.length && j < rightBlocks.length) {
    if (leftKeys[i] === rightKeys[j]) {
      operations.push({
        type: 'unchanged',
        left: leftBlocks[i],
        right: rightBlocks[j],
      });
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      operations.push({ type: 'removed', left: leftBlocks[i] });
      i += 1;
    } else {
      operations.push({ type: 'added', right: rightBlocks[j] });
      j += 1;
    }
  }

  while (i < leftBlocks.length) {
    operations.push({ type: 'removed', left: leftBlocks[i] });
    i += 1;
  }

  while (j < rightBlocks.length) {
    operations.push({ type: 'added', right: rightBlocks[j] });
    j += 1;
  }

  return operations;
}

function coalesceRows(operations: DiffOperation[]): DiffRow[] {
  const rows: DiffRow[] = [];
  let cursor = 0;

  while (cursor < operations.length) {
    const operation = operations[cursor];

    if (operation.type === 'unchanged') {
      rows.push({
        currentText: operation.left,
        suggestedText: operation.right,
        type: 'unchanged',
      });
      cursor += 1;
      continue;
    }

    const removed: string[] = [];
    const added: string[] = [];

    while (cursor < operations.length && operations[cursor].type !== 'unchanged') {
      const pending = operations[cursor];
      if (pending.type === 'removed') {
        removed.push(pending.left);
      } else if (pending.type === 'added') {
        added.push(pending.right);
      }
      cursor += 1;
    }

    const paired = Math.min(removed.length, added.length);

    for (let index = 0; index < paired; index += 1) {
      rows.push({
        currentText: removed[index],
        suggestedText: added[index],
        type: 'modified',
      });
    }

    for (let index = paired; index < removed.length; index += 1) {
      rows.push({
        currentText: removed[index],
        suggestedText: null,
        type: 'removed',
      });
    }

    for (let index = paired; index < added.length; index += 1) {
      rows.push({
        currentText: null,
        suggestedText: added[index],
        type: 'added',
      });
    }
  }

  return rows;
}

export function buildAgreementDiff(
  currentContent: string,
  suggestedContent: string,
): AgreementDiffResult {
  const currentBlocks = splitAgreementBlocks(currentContent);
  const suggestedBlocks = splitAgreementBlocks(suggestedContent);
  const operations = buildOperations(currentBlocks, suggestedBlocks);
  const rows = coalesceRows(operations);

  const summary = rows.reduce<AgreementDiffSummary>(
    (accumulator, row) => {
      accumulator.totalBlocks += 1;

      if (row.type !== 'unchanged') {
        accumulator.changedBlocks += 1;
      }

      if (row.type === 'modified') {
        accumulator.modifiedBlocks += 1;
      }

      if (row.type === 'added') {
        accumulator.addedBlocks += 1;
      }

      if (row.type === 'removed') {
        accumulator.removedBlocks += 1;
      }

      return accumulator;
    },
    {
      changedBlocks: 0,
      modifiedBlocks: 0,
      addedBlocks: 0,
      removedBlocks: 0,
      totalBlocks: 0,
    },
  );

  return { rows, summary };
}
