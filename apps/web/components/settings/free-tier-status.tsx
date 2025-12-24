'use client';

type FreeTierStatusProps = {
  freeStoryUsed: boolean;
  freeStoryId: string | null;
  isDegraded: boolean;
  misuseWarnings: number;
  hasApiKey: boolean;
};

export function FreeTierStatus({
  freeStoryUsed,
  freeStoryId,
  isDegraded,
  misuseWarnings,
  hasApiKey,
}: FreeTierStatusProps) {
  if (hasApiKey) {
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
        <h3 className="font-medium text-green-600 dark:text-green-400">
          Full Access
        </h3>
        <p className="text-sm text-muted-foreground">
          You're using your own API key. Unlimited stories available.
        </p>
      </div>
    );
  }

  if (isDegraded) {
    return (
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
        <h3 className="font-medium text-yellow-600 dark:text-yellow-400">
          Limited Mode
        </h3>
        <p className="text-sm text-muted-foreground">
          Your account is in limited mode due to usage outside story gameplay.
          You can still play, but with a simpler AI model. Add your own API key
          for full features.
        </p>
      </div>
    );
  }

  if (freeStoryUsed) {
    return (
      <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-4">
        <h3 className="font-medium text-orange-600 dark:text-orange-400">
          Free Story Used
        </h3>
        <p className="text-sm text-muted-foreground">
          You've completed your free story. Add your own API key to continue
          playing unlimited stories.
        </p>
      </div>
    );
  }

  if (freeStoryId) {
    return (
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
        <h3 className="font-medium text-blue-600 dark:text-blue-400">
          Story in Progress
        </h3>
        <p className="text-sm text-muted-foreground">
          You have a free story in progress. Complete it to try the full
          experience, or add your API key for unlimited access.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
      <h3 className="font-medium text-primary">Free Story Available</h3>
      <p className="text-sm text-muted-foreground">
        You have 1 free story to experience The Pulse. Start playing anytime!
        For unlimited stories, add your own API key below.
      </p>
    </div>
  );
}
