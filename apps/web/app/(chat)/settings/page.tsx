'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiKeyForm } from '@/components/settings/api-key-form';
import { FreeTierStatus } from '@/components/settings/free-tier-status';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon } from 'lucide-react';

type Settings = {
  hasOpenrouterKey: boolean;
  openrouterKeyMask: string | null;
  hasAiGatewayKey: boolean;
  aiGatewayKeyMask: string | null;
  freeStoryUsed: boolean;
  freeStoryId: string | null;
  isDegraded: boolean;
  misuseWarnings: number;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  const hasAnyApiKey =
    settings?.hasOpenrouterKey || settings?.hasAiGatewayKey;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ChevronLeftIcon className="mr-1 h-4 w-4" />
            Back to Chat
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your API keys and manage your account
        </p>
      </div>

      <div className="space-y-8">
        {/* Free Tier Status */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Account Status</h2>
          <FreeTierStatus
            freeStoryUsed={settings?.freeStoryUsed ?? false}
            freeStoryId={settings?.freeStoryId ?? null}
            isDegraded={settings?.isDegraded ?? false}
            misuseWarnings={settings?.misuseWarnings ?? 0}
            hasApiKey={hasAnyApiKey ?? false}
          />
        </section>

        {/* API Keys */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">API Keys</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Add your own API keys to unlock unlimited stories. Your keys are
            encrypted and stored securely.
          </p>

          <div className="space-y-4">
            <ApiKeyForm
              provider="aiGateway"
              label="Vercel AI Gateway"
              description="Use Vercel's AI Gateway for multi-model access"
              placeholder="vck_..."
              helpUrl="https://vercel.com/docs/ai-gateway"
              currentKeyMask={settings?.aiGatewayKeyMask}
              onSaved={fetchSettings}
            />

            <ApiKeyForm
              provider="openrouter"
              label="OpenRouter"
              description="Access 100+ models through OpenRouter"
              placeholder="sk-or-..."
              helpUrl="https://openrouter.ai/keys"
              currentKeyMask={settings?.openrouterKeyMask}
              onSaved={fetchSettings}
            />
          </div>
        </section>

        {/* Help Section */}
        <section className="rounded-lg border bg-muted/50 p-4">
          <h3 className="font-medium">Need help?</h3>
          <p className="text-sm text-muted-foreground">
            If you're having issues with your API keys or account, please reach
            out to us.
          </p>
        </section>
      </div>
      </div>
    </div>
  );
}
