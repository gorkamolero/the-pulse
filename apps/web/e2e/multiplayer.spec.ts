import { test, expect, type Browser, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:7272";
const INVITE_CODES = ["ACYBORG", "CYBERYOGIN", "RTT"];
const PASSWORD = "TestPass123!";
const STORY_ID = "shadow-over-innsmouth";

// Helper to generate unique emails
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@test.com`;
}

// Invite codes are shown as ABCD-EFGH
function formatted(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// Rooms need a signed-in host: register a fresh account on this page
async function registerHost(page: Page, prefix: string, inviteCode = INVITE_CODES[0]): Promise<void> {
  await page.goto(`${BASE_URL}/register`);
  await page.fill('input[name="email"]', uniqueEmail(prefix));
  await page.fill('input[name="password"]', PASSWORD);
  await page.fill('input[name="inviteCode"]', inviteCode);
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Account created successfully", { timeout: 15000 });
}

// Create a room via API as the signed-in host
async function createRoom(
  page: Page,
  displayName: string,
  storyId?: string
): Promise<{ roomId: string; inviteCode: string; playerId: string }> {
  const response = await page.evaluate(
    async ({ name, storyId }) => {
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, storyId }),
      });
      return res.json();
    },
    { name: displayName, storyId }
  );

  if (!response.room || !response.player) {
    throw new Error(`Failed to create room: ${JSON.stringify(response)}`);
  }

  return {
    roomId: response.room.id,
    inviteCode: response.room.inviteCode,
    playerId: response.player.id,
  };
}

// A second player joins through the invite link, in a separate browser context
async function joinAsGuest(browser: Browser, inviteCode: string, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/join/${inviteCode}`);
  await page.getByPlaceholder("Enter your name").fill(name);
  await page.getByRole("button", { name: "Enter the Circle" }).click();
  await page.waitForURL(/\/room\/.*\/lobby/);
  await expect(page.getByRole("heading", { name: "Gathering" })).toBeVisible();
  return { context, page };
}

// Helper to start game via API
async function startGame(page: Page, roomId: string): Promise<void> {
  await page.evaluate(async (roomId) => {
    await fetch(`/api/room/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "playing" }),
    });
  }, roomId);
}

test.describe("Multiplayer Room Feature", () => {
  test.describe("Room Creation", () => {
    test("should create a room via API and get invite code", async ({ page }) => {
      await registerHost(page, "roomcreate");

      const room = await createRoom(page, "TestHost");

      expect(room.roomId).toBeTruthy();
      expect(room.inviteCode).toMatch(/^[A-Z0-9]{8}$/);
      expect(room.playerId).toBeTruthy();
    });

    test("should display lobby page with host controls", async ({ page }) => {
      await registerHost(page, "lobbytest");
      const room = await createRoom(page, "LobbyTestHost");
      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);

      await expect(page.getByRole("heading", { name: "Gathering" })).toBeVisible();
      await expect(page.getByText("LobbyTestHost").first()).toBeVisible();
      await expect(page.getByText("You guide this session")).toBeVisible();
      await expect(page.getByRole("button", { name: "Begin the Journey" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Summon Others" })).toBeVisible();
    });
  });

  test.describe("Join Flow", () => {
    test("should show error for invalid invite code", async ({ page }) => {
      await page.goto(`${BASE_URL}/join/INVALID1`);

      // Invalid code (contains excluded characters)
      await expect(page.getByRole("heading", { name: "Path Unavailable" })).toBeVisible();
    });

    test("should show join form for valid invite code format", async ({ page, browser }) => {
      await registerHost(page, "jointest");
      const room = await createRoom(page, "JoinTestHost");

      // A fresh context, as the invited player would arrive
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await page2.goto(`${BASE_URL}/join/${room.inviteCode}`);

      await expect(page2.getByRole("heading", { name: "Join the Journey" })).toBeVisible();
      await expect(page2.getByText(formatted(room.inviteCode))).toBeVisible();
      await expect(page2.getByPlaceholder("Enter your name")).toBeVisible();
      await expect(page2.getByRole("button", { name: "Enter the Circle" })).toBeVisible();

      await context2.close();
    });

    test("should join room and redirect to lobby", async ({ page, browser }) => {
      await registerHost(page, "hostforjoin");
      const room = await createRoom(page, "HostForJoin");
      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);

      const guest = await joinAsGuest(browser, room.inviteCode, "Player2");

      // The host's lobby shows the new player without a reload
      await expect(page.getByText("Player2").first()).toBeVisible({ timeout: 10000 });

      await guest.context.close();
    });
  });

  test.describe("Lobby Functionality", () => {
    test("should show invite modal with code and link", async ({ page }) => {
      await registerHost(page, "invitetest");
      const room = await createRoom(page, "InviteTestHost");
      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);

      await page.getByRole("button", { name: "Summon Others" }).click();

      await expect(page.getByRole("heading", { name: "Summon Travelers" })).toBeVisible();
      await expect(page.getByText(formatted(room.inviteCode))).toBeVisible();
      await expect(page.getByText("Direct Passage")).toBeVisible();
    });

    test("should allow host to change spokesperson", async ({ page, browser }) => {
      await registerHost(page, "spokeshost");
      const room = await createRoom(page, "SpokesHost");
      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);

      const guest = await joinAsGuest(browser, room.inviteCode, "SpokesPlayer2");
      await expect(page.getByText("SpokesPlayer2").first()).toBeVisible({ timeout: 10000 });

      // Spokesperson dropdown (a select): pick Player2
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "SpokesPlayer2" }).click();

      await expect(page.getByRole("combobox")).toContainText("SpokesPlayer2");

      await guest.context.close();
    });
  });

  test.describe("Game Play (Authenticated)", () => {
    test("should start game and show play page with chat", async ({ page }) => {
      await registerHost(page, "playtest", INVITE_CODES[0]);
      const room = await createRoom(page, "AuthHost", STORY_ID);

      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);
      await expect(page.getByRole("heading", { name: "Gathering" })).toBeVisible();
      await page.getByRole("button", { name: "Begin the Journey" }).click();

      await page.waitForURL(/\/room\/.*\/play/, { timeout: 15000 });
      await expect(page.getByText("You speak for the party")).toBeVisible({ timeout: 10000 });
    });

    test("should show player chat sidebar", async ({ page }) => {
      await registerHost(page, "sidebartest", INVITE_CODES[1]);
      const room = await createRoom(page, "SidebarHost", STORY_ID);
      await startGame(page, room.roomId);

      await page.goto(`${BASE_URL}/room/${room.roomId}/play`);

      await expect(page.getByText("Hidden from the narrator")).toBeVisible({ timeout: 10000 });
      await expect(page.getByPlaceholder("Whisper to your party...")).toBeVisible();
    });

    test("spokesperson input should be enabled", async ({ page }) => {
      await registerHost(page, "inputtest", INVITE_CODES[2]);
      const room = await createRoom(page, "InputHost", STORY_ID);
      await startGame(page, room.roomId);

      await page.goto(`${BASE_URL}/room/${room.roomId}/play`);
      await expect(page.getByText("You speak for the party")).toBeVisible({ timeout: 10000 });

      // A room goes straight to Begin; then the spokesperson can type moves
      await page.getByRole("button", { name: "Begin", exact: true }).click({ timeout: 30000 });
      await expect(page.getByPlaceholder("What do you do?")).toBeEnabled();
    });
  });

  test.describe("Multiplayer Synchronization", () => {
    test("both players should see each other in lobby", async ({ page, browser }) => {
      await registerHost(page, "synchost");
      const room = await createRoom(page, "SyncHost");
      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);

      const guest = await joinAsGuest(browser, room.inviteCode, "SyncPlayer2");

      for (const p of [page, guest.page]) {
        await expect(p.getByText("SyncHost").first()).toBeVisible({ timeout: 10000 });
        await expect(p.getByText("SyncPlayer2").first()).toBeVisible({ timeout: 10000 });
      }

      await guest.context.close();
    });

    test("non-spokesperson should see spokesperson indicator", async ({ page, browser }) => {
      await registerHost(page, "disabledhost");
      const room = await createRoom(page, "DisabledHost", STORY_ID);
      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);

      const guest = await joinAsGuest(browser, room.inviteCode, "DisabledPlayer2");
      await expect(page.getByText("DisabledPlayer2").first()).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: "Begin the Journey" }).click();
      await page.waitForURL(/\/room\/.*\/play/);

      // The waiting player follows the host into the game on their own
      await guest.page.waitForURL(/\/room\/.*\/play/, { timeout: 15000 });
      await expect(guest.page.getByText("speaks for the party")).toBeVisible({ timeout: 10000 });
      await expect(guest.page.getByText("Hidden from the narrator")).toBeVisible();

      await guest.context.close();
    });
  });
});
