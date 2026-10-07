#!/usr/bin/env npx tsx
/**
 * Talk to a narrator agent over its conversation WebSocket with typed turns,
 * print what it says and save the audio of each agent turn.
 *
 * Usage:
 *   npx tsx scripts/test-narrator-agent.ts <agent-id> [--key-from <project dir>] [--out <dir>] [turn...]
 */

import { config as loadEnv, parse as parseEnv } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import WebSocket from "ws";

for (const envFile of [".env.local", "../../.env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
}

const args = process.argv.slice(2);
const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const keyFrom = flag("--key-from");
const outDir = resolve(process.cwd(), flag("--out") ?? "agent-test");
const positional = args.filter((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"));
const [agentId, ...turns] = positional;

if (keyFrom) {
  for (const envFile of [".env.local", ".env", "api/.env"]) {
    const envPath = resolve(process.cwd(), keyFrom, envFile);
    const key = existsSync(envPath) ? parseEnv(readFileSync(envPath)).ELEVENLABS_API_KEY : undefined;
    if (key) {
      process.env.ELEVENLABS_API_KEY = key;
      break;
    }
  }
}

// Seconds of silence from the agent before the next typed turn is sent
const TURN_GAP_MS = 4000;

async function main() {
  if (!agentId) {
    throw new Error("Pass an agent id");
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const signed = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
    { headers: { "xi-api-key": apiKey } }
  );
  if (!signed.ok) {
    throw new Error(`Signed URL failed (${signed.status}): ${await signed.text()}`);
  }
  const { signed_url } = (await signed.json()) as { signed_url: string };

  mkdirSync(outDir, { recursive: true });
  const ws = new WebSocket(signed_url);
  const pending = [...(turns.length ? turns : ["I'm ready."])];
  let turn = 0;
  let audio: Buffer[] = [];
  let format = "pcm_16000";
  let lastAudioAt = 0;
  let firstAudioAfterSend = 0;
  let sentAt = 0;

  const saveTurn = () => {
    if (audio.length === 0) {
      return;
    }
    const file = resolve(outDir, `turn-${turn}.${format.startsWith("pcm") ? "pcm" : "bin"}`);
    writeFileSync(file, Buffer.concat(audio));
    console.log(`  saved ${file} (${format})`);
    audio = [];
    turn++;
  };

  const timer = setInterval(() => {
    if (lastAudioAt && Date.now() - lastAudioAt > TURN_GAP_MS) {
      lastAudioAt = 0;
      saveTurn();
      const next = pending.shift();
      if (next === undefined) {
        clearInterval(timer);
        ws.close();
        return;
      }
      console.log(`PLAYER: ${next}`);
      sentAt = Date.now();
      firstAudioAfterSend = 0;
      ws.send(JSON.stringify({ type: "user_message", text: next }));
    }
  }, 250);

  ws.on("open", () => {
    ws.send(JSON.stringify({ type: "conversation_initiation_client_data" }));
  });

  ws.on("message", (data: Buffer) => {
    const event = JSON.parse(data.toString());
    switch (event.type) {
      case "conversation_initiation_metadata":
        format = event.conversation_initiation_metadata_event?.agent_output_audio_format ?? format;
        console.log(`connected, conversation ${event.conversation_initiation_metadata_event?.conversation_id}, audio ${format}`);
        break;
      case "agent_response":
        console.log(`NARRATOR: ${event.agent_response_event?.agent_response}`);
        break;
      case "audio":
        if (sentAt && !firstAudioAfterSend) {
          firstAudioAfterSend = Date.now();
          console.log(`  first audio ${firstAudioAfterSend - sentAt} ms after the player's turn`);
        }
        audio.push(Buffer.from(event.audio_event?.audio_base_64 ?? "", "base64"));
        lastAudioAt = Date.now();
        if (sentAt) {
          const bytes = audio.reduce((n, b) => n + b.length, 0);
          process.stdout.write(`\r  t+${Date.now() - sentAt} ms: ${(bytes / 32000).toFixed(1)} s of audio received   `);
        }
        break;
      case "ping":
        ws.send(JSON.stringify({ type: "pong", event_id: event.ping_event?.event_id }));
        break;
      case "error":
        console.error("agent error:", JSON.stringify(event));
        break;
    }
  });

  ws.on("close", (code, reason) => {
    clearInterval(timer);
    saveTurn();
    console.log(`closed (${code}) ${reason.toString()}`);
  });

  ws.on("error", (error) => {
    console.error(error.message);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
