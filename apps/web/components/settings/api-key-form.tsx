'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type ApiKeyFormProps = {
  provider: 'openrouter' | 'aiGateway';
  label: string;
  description: string;
  placeholder: string;
  helpUrl: string;
  currentKeyMask?: string | null;
  onSaved: () => void;
};

export function ApiKeyForm({
  provider,
  label,
  description,
  placeholder,
  helpUrl,
  currentKeyMask,
  onSaved,
}: ApiKeyFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setIsValidating(true);
    try {
      const response = await fetch('/api/settings/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, provider }),
      });

      const data = await response.json();

      if (data.valid) {
        toast.success('API key is valid!');
      } else {
        toast.error(data.message || 'Invalid API key');
      }
    } catch {
      toast.error('Failed to validate API key');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setIsSaving(true);
    try {
      const body =
        provider === 'openrouter'
          ? { openrouterApiKey: apiKey }
          : { aiGatewayApiKey: apiKey };

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success('API key saved!');
        setApiKey('');
        onSaved();
      } else {
        const text = await response.text();
        toast.error(text || 'Failed to save API key');
      }
    } catch {
      toast.error('Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/settings?provider=${provider}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('API key removed');
        onSaved();
      } else {
        toast.error('Failed to remove API key');
      }
    } catch {
      toast.error('Failed to remove API key');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <Label htmlFor={`${provider}-key`} className="text-base font-medium">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {currentKeyMask && (
        <div className="flex items-center gap-2 rounded bg-muted p-2 text-sm">
          <span className="font-mono">{currentKeyMask}</span>
          <span className="text-muted-foreground">(saved)</span>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          id={`${provider}-key`}
          type="password"
          placeholder={placeholder}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="font-mono"
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleValidate}
          disabled={isValidating || !apiKey.trim()}
        >
          {isValidating ? 'Validating...' : 'Test Key'}
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !apiKey.trim()}
        >
          {isSaving ? 'Saving...' : 'Save Key'}
        </Button>
        {currentKeyMask && (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Removing...' : 'Remove'}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Get your API key from{' '}
        <a
          href={helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          {provider === 'openrouter' ? 'OpenRouter' : 'Vercel AI Gateway'}
        </a>
      </p>
    </div>
  );
}
