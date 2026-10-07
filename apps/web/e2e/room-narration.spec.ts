import { test, expect, type Browser, type Page } from "@playwright/test";

// Invite Rooms with a signed-in host and a guest. The host's browser runs the narrator
// agent and relays it over Liveblocks; the guest must hear the voice with the word highlight,
// read the same narration, and see the host's moves. Calls the real ElevenLabs agent.

const STORY_ID = "shadow-over-innsmouth";
const INVITE_CODE = "ACYBORG";
const PASSWORD = "TestPass123!";
const MOVE = "Two players: Ana and Leo.";

const narratorState = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __narratorState?: string | null }).__narratorState ?? null,
  );

// Narration in the story column, by message id (the thinking indicator has none)
const narrations = (page: Page) =>
  page.locator('[data-role="assistant"][data-message-id]').evaluateAll((nodes) =>
    nodes.map((n) => ({
      id: n.getAttribute("data-message-id"),
      text: (n as HTMLElement).innerText.trim(),
    })),
  );

// A signed-in host and a guest in a started room, both on the play page
async function startRoom(host: Page, browser: Browser) {
  await host.goto("/register");
  await host.fill('input[name="email"]', `room-narration-${Date.now()}@test.com`);
  await host.fill('input[name="password"]', PASSWORD);
  await host.fill('input[name="inviteCode"]', INVITE_CODE);
  await host.click('button[type="submit"]');
  await host.waitForSelector("text=Account created successfully", { timeout: 15_000 });

  const { room } = await host.evaluate(async (storyId) => {
    const res = await fetch("/api/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Host", storyId }),
    });
    return res.json();
  }, STORY_ID);
  expect(room?.id).toBeTruthy();

  // The guest joins through the invite link, in a separate browser context
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/join/${room.inviteCode}`);
  await guest.getByPlaceholder("Enter your name").fill("Guest");
  await guest.getByRole("button", { name: "Enter the Circle" }).click();
  await guest.waitForURL(/\/room\/.*\/lobby/);

  // The host starts; the guest follows into the game without reloading
  await host.goto(`/room/${room.id}/lobby`);
  await expect(host.getByText("Guest", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await host.getByRole("button", { name: "Begin the Journey" }).click();
  await host.waitForURL(/\/room\/.*\/play/, { timeout: 30_000 });
  await guest.waitForURL(/\/room\/.*\/play/, { timeout: 30_000 });

  // For the guest, the Begin click is what lets the browser play the relayed voice
  await guest.getByRole("button", { name: "Begin", exact: true }).click({ timeout: 60_000 });

  // Both are on the room connection once a whisper from the guest reaches the host
  // (the player chat drops a whisper typed before the guest's connection is up)
  const whisper = guest.getByPlaceholder("Whisper to your party...");
  await expect
    .poll(
      async () => {
        if ((await host.getByText("Can you hear it?").count()) > 0) return true;
        await whisper.fill("Can you hear it?");
        await whisper.press("Enter");
        return false;
      },
      { timeout: 30_000, intervals: [1_000] },
    )
    .toBe(true);

  return { guest, guestContext };
}

test("a guest in an Invite Room hears and reads the narration live", async ({
  page: host,
  browser,
}) => {
  test.setTimeout(240_000);
  const { guest, guestContext } = await startRoom(host, browser);

  await host.getByRole("button", { name: "Begin", exact: true }).click({ timeout: 60_000 });
  await expect.poll(() => narratorState(host), { timeout: 30_000 }).toBe("talking");
  const hostTalkingAt = Date.now();
  await expect.poll(() => narratorState(guest), { timeout: 10_000 }).toBe("talking");
  test.info().annotations.push({
    type: "relay",
    description: `guest voice started ${Date.now() - hostTalkingAt} ms after the host's`,
  });

  // The word highlight follows the relayed voice on the guest's screen
  await expect(guest.locator(".spoken-word-active").first()).toBeVisible({ timeout: 15_000 });
  await expect(guest.getByPlaceholder("Only the spokesperson can message the narrator")).toBeDisabled();

  // Same opening on both screens, same message id
  await expect.poll(async () => (await narrations(guest)).length, { timeout: 30_000 }).toBe(1);
  expect(await narrations(guest)).toEqual(await narrations(host));

  // The host's move reaches the guest, and so does the narrator's reply
  await expect.poll(() => narratorState(host), { timeout: 90_000 }).toBe(null);
  await host.getByPlaceholder("What do you do?").fill(MOVE);
  await host.keyboard.press("Enter");
  await expect(guest.locator('[data-role="user"]', { hasText: MOVE })).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => narratorState(guest), { timeout: 30_000 }).toBe("talking");
  await expect.poll(async () => (await narrations(guest)).length, { timeout: 30_000 }).toBe(2);
  expect(await narrations(guest)).toEqual(await narrations(host));

  await guestContext.close();
});

test("a guest who reloads mid-turn still gets the narration", async ({ page: host, browser }) => {
  test.setTimeout(240_000);
  const { guest, guestContext } = await startRoom(host, browser);

  await host.getByRole("button", { name: "Begin", exact: true }).click({ timeout: 60_000 });
  await expect.poll(() => narratorState(host), { timeout: 30_000 }).toBe("talking");
  await guest.reload();

  // Back before the opening was saved, the guest lands on Begin again
  const begin = guest.getByRole("button", { name: "Begin", exact: true });
  if (await begin.waitFor({ timeout: 5_000 }).then(() => true, () => false)) await begin.click();

  // From the saved game or the host's resend when the voice ends
  await expect.poll(async () => (await narrations(host)).length, { timeout: 30_000 }).toBe(1);
  const [opening] = await narrations(host);
  await expect
    .poll(async () => (await narrations(guest)).map((n) => n.id), { timeout: 90_000 })
    .toContain(opening.id);

  await guestContext.close();
});
