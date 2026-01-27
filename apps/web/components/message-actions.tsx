import type { LegacyMessage } from "@/lib/types/message";
import { toast } from "sonner";

import { ClockRewind } from "./icons";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { memo } from "react";
import { deleteTrailingMessages } from "@/app/(chat)/actions";
import { AudioPlayer } from "./audio-player";

export function PureMessageActions({
  chatId,
  message,
  isLoading,
  autoplay
}: {
  chatId: string;
  message: LegacyMessage;
  isLoading: boolean;
  autoplay?: boolean
}) {
  if (isLoading) return null;

  if (message.role === "user") {
    return (
      <TooltipProvider delayDuration={0}>
        <div className="flex flex-row gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="py-1 px-2 h-fit text-muted-foreground"
                variant="outline"
                onClick={async () => {
                  const confirmed = window.confirm(
                    "Are you sure you want to revert to this message? All messages after this one will be deleted."
                  );

                  if (confirmed) {
                    const revert = deleteTrailingMessages({ id: message.id });

                    toast.promise(revert, {
                      loading: "Reverting to previous state...",
                      success: () => {
                        window.location.reload();
                        return "Successfully reverted to previous state!";
                      },
                      error: "Failed to revert to previous state.",
                    });
                  }
                }}
              >
                <ClockRewind />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Revert to this message</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <AudioPlayer content={message.content as string} chatId={chatId} autoplay={autoplay} id={message.id} />
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;

    return true;
  }
);
