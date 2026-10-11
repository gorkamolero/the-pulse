"use client";

import { useEffect, useState } from "react";
import { getLiveNarration, liveWordTimings } from "@/hooks/use-narrator-agent";
import { activeWordIndex, TimedNarration, type WordTiming } from "@/components/timed-narration";

/**
 * Narration voiced live by the narrator agent: highlights each word as the
 * streamed voice reaches it, using the character timings that came with the audio.
 */
export function LiveNarration({ messageId, text }: { messageId: string; text: string }) {
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);
  const [currentTimeMs, setCurrentTimeMs] = useState(-1);

  useEffect(() => {
    let frame = 0;
    let charsSeen = -1;
    let timings: WordTiming[] = [];
    let activeIndex = -1;

    const tick = () => {
      const live = getLiveNarration(messageId);
      if (live) {
        if (live.turn.chars.length !== charsSeen) {
          charsSeen = live.turn.chars.length;
          timings = liveWordTimings(text, live.turn);
          setWordTimings(timings);
        }

        const index = activeWordIndex(timings, live.nowMs);
        if (index !== activeIndex) {
          activeIndex = index;
          setCurrentTimeMs(index >= 0 ? live.nowMs : -1);
        }

        const lastEnd = timings.at(-1)?.endMs ?? 0;
        if (live.turn.done && live.nowMs > lastEnd + 1000) {
          setCurrentTimeMs(-1);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [messageId, text]);

  return <TimedNarration currentTimeMs={currentTimeMs} text={text} wordTimings={wordTimings} />;
}
