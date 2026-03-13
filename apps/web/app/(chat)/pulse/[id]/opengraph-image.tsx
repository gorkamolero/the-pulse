import { ImageResponse } from 'next/og';
import { getChatById, getMessagesByChatId } from '@/lib/db/queries';
import { getStoryById } from '@pulse/core/ai/stories';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

// Story taglines for the share card
const STORY_TAGLINES: Record<string, string[]> = {
  'shadow-over-innsmouth': [
    'Something ancient stirs beneath the waves.',
    'The sea keeps its secrets — and its prey.',
    'Not all who enter Innsmouth leave unchanged.',
  ],
  'the-hollow-choir': [
    'The song never truly ends.',
    'In the flooded city, the music remembers.',
    'Some melodies reach beyond the grave.',
  ],
  'whispering-pines': [
    'The forest watches. The forest waits.',
    'Cabin fever never felt so fatal.',
    'The pines have stood for centuries. You have not.',
  ],
  'siren-of-the-red-dust': [
    'Mars keeps its colonists. One way or another.',
    'The dust whispers names.',
    'Out here, no one hears you go mad.',
  ],
  'endless-path': [
    'Every step leads deeper.',
    'The path has no end. Only travelers.',
    'You chose this road. Did you?',
  ],
};

function getTagline(storyId: string, pulseCount: number): string {
  const taglines = STORY_TAGLINES[storyId] ?? ['A story you will not forget.'];
  return taglines[pulseCount % taglines.length];
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch chat and story data
  const chatData = await getChatById({ id }).catch(() => null);
  const storyId = chatData?.storyId ?? 'shadow-over-innsmouth';
  const story = getStoryById(storyId);
  const storyTitle = story?.title ?? 'The Pulse';
  const accentHex = story?.theme?.accentHex ?? '#4A9B8C';
  const soloMode = chatData?.soloMode ?? true;

  // Count pulses (assistant messages)
  const messages = await getMessagesByChatId({ id }).catch(() => []);
  const pulseCount = messages.filter((m) => m.role === 'assistant').length;

  const tagline = getTagline(storyId, pulseCount);
  const sessionLabel = soloMode ? 'Solo Session' : 'Group Session';
  const pulsesLabel = pulseCount === 1 ? '1 pulse' : `${pulseCount} pulses`;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0A0A0F',
        fontFamily: 'serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Atmospheric gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accentHex}22 0%, transparent 70%)`,
        }}
      />

      {/* Top accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: accentHex,
        }}
      />

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          flex: 1,
          padding: '72px 80px',
          position: 'relative',
        }}
      >
        {/* Brand */}
        <div
          style={{
            fontSize: 18,
            letterSpacing: '0.2em',
            color: accentHex,
            textTransform: 'uppercase',
            marginBottom: 32,
            opacity: 0.9,
          }}
        >
          THE PULSE
        </div>

        {/* Story title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: '#F5F0E8',
            lineHeight: 1.1,
            marginBottom: 24,
            maxWidth: 900,
          }}
        >
          {storyTitle}
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            color: '#C8BFB0',
            fontStyle: 'italic',
            marginBottom: 48,
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          {tagline}
        </div>

        {/* Session stats */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              padding: '10px 20px',
              backgroundColor: `${accentHex}22`,
              border: `1px solid ${accentHex}55`,
              borderRadius: 6,
              color: accentHex,
              fontSize: 15,
              letterSpacing: '0.05em',
            }}
          >
            {sessionLabel}
          </div>
          {pulseCount > 0 && (
            <div
              style={{
                padding: '10px 20px',
                backgroundColor: '#FFFFFF0A',
                border: '1px solid #FFFFFF18',
                borderRadius: 6,
                color: '#C8BFB0',
                fontSize: 15,
                letterSpacing: '0.05em',
              }}
            >
              {pulsesLabel}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: CTA */}
      <div
        style={{
          padding: '24px 80px',
          borderTop: '1px solid #FFFFFF12',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <div
          style={{
            fontSize: 18,
            color: '#6B6560',
            letterSpacing: '0.05em',
          }}
        >
          AI-powered interactive fiction
        </div>
        <div
          style={{
            fontSize: 18,
            color: accentHex,
            letterSpacing: '0.05em',
          }}
        >
          thepulse.app/pulse/{id.slice(0, 8)}…
        </div>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
