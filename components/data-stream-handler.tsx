'use client';

import type { Suggestion } from '@/lib/db/schema';

export type DataStreamDelta = {
  type:
    | 'text-delta'
    | 'code-delta'
    | 'sheet-delta'
    | 'image-delta'
    | 'title'
    | 'id'
    | 'suggestion'
    | 'clear'
    | 'finish'
    | 'kind';
  content: string | Suggestion;
};

export function DataStreamHandler({ id }: { id: string }) {
  // TODO: Re-implement data streaming for AI SDK v5
  // In v5, custom data streaming works differently - it's now part of message parts
  // with type: 'data'. This needs to be refactored to work with the new API.
  // For now, this component is disabled to allow the build to complete.

  return null;
}
