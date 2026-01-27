import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:7272";
const INVITE_CODES = ["ACYBORG", "CYBERYOGIN", "RTT"];

// Helper to generate unique emails
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@test.com`;
}

// Helper to register a user
async function registerUser(
  page: Page,
  email: string,
  password: string,
  inviteCode: string
): Promise<void> {
  await page.goto(`${BASE_URL}/register`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="inviteCode"]', inviteCode);
  await page.click('button[type="submit"]');
  // Wait for success toast and redirect to home (story selection)
  await page.waitForSelector('text=Account created successfully', { timeout: 10000 });
  // Wait a moment for the redirect to complete
  await page.waitForTimeout(1000);
}

// Helper to login a user
async function loginUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(welcome|pulse)/);
}

// Helper to create a room via API
async function createRoom(
  page: Page,
  displayName: string
): Promise<{ roomId: string; inviteCode: string; playerId: string; guestId: string | null }> {
  // First check if there's an existing guest-id cookie
  const cookies = await page.context().cookies();
  const existingGuestId = cookies.find(c => c.name === "guest-id")?.value;

  const response = await page.evaluate(async ({ name, guestId }) => {
    const res = await fetch("/api/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name, guestId }),
    });
    return res.json();
  }, { name: displayName, guestId: existingGuestId });

  // Validate response has required fields
  if (!response.room || !response.player) {
    throw new Error(`Failed to create room: ${JSON.stringify(response)}`);
  }

  // If a new guestId was created, set it as a cookie
  const newGuestId = response.player.guestId;
  if (newGuestId && newGuestId !== existingGuestId) {
    await page.context().addCookies([{
      name: "guest-id",
      value: newGuestId,
      domain: "localhost",
      path: "/",
    }]);
  }

  return {
    roomId: response.room.id,
    inviteCode: response.room.inviteCode,
    playerId: response.player.id,
    guestId: newGuestId || null,
  };
}

// Helper to start game via API
async function startGame(
  page: Page,
  roomId: string,
  guestId?: string
): Promise<void> {
  await page.evaluate(
    async ({ roomId, guestId }) => {
      await fetch(`/api/room/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "playing", guestId }),
      });
    },
    { roomId, guestId }
  );
}

test.describe("Multiplayer Room Feature", () => {
  test.describe("Room Creation", () => {
    test("should create a room via API and get invite code", async ({ page }) => {
      await page.goto(BASE_URL);

      const room = await createRoom(page, "TestHost");

      expect(room.roomId).toBeTruthy();
      expect(room.inviteCode).toMatch(/^[A-Z0-9]{8}$/);
      expect(room.playerId).toBeTruthy();
    });

    test("should display lobby page with host controls", async ({ page }) => {
      await page.goto(BASE_URL);

      const room = await createRoom(page, "LobbyTestHost");
      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);

      // Verify lobby elements
      await expect(page.getByRole("heading", { name: "Game Lobby" })).toBeVisible();
      await expect(page.getByText("Players (1)")).toBeVisible();
      // Use more specific selector - check the player list item
      await expect(page.getByRole("listitem").filter({ hasText: "LobbyTestHost" })).toBeVisible();
      await expect(page.getByText("Host Controls")).toBeVisible();
      await expect(page.getByRole("button", { name: "Start Game" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Invite Players" })).toBeVisible();
    });
  });

  test.describe("Join Flow", () => {
    test("should show error for invalid invite code", async ({ page }) => {
      await page.goto(`${BASE_URL}/join/INVALID1`);

      // Should show error (invalid code contains excluded characters)
      await expect(page.locator("text=Unable to Join")).toBeVisible();
    });

    test("should show join form for valid invite code format", async ({ page }) => {
      // First create a room to get a valid code
      await page.goto(BASE_URL);
      const room = await createRoom(page, "JoinTestHost");

      // Open new page/context to simulate second player
      await page.goto(`${BASE_URL}/join/${room.inviteCode}`);

      // Should show join form
      await expect(page.getByRole("heading", { name: "Join Game" })).toBeVisible();
      await expect(page.locator(`text=${room.inviteCode.slice(0, 4)}-${room.inviteCode.slice(4)}`)).toBeVisible();
      await expect(page.locator('input[placeholder="Enter your name"]')).toBeVisible();
      await expect(page.locator("button:has-text('Join Game')")).toBeVisible();
    });

    test("should join room and redirect to lobby", async ({ page, browser }) => {
      // Create room with first page
      await page.goto(BASE_URL);
      const room = await createRoom(page, "HostForJoin");

      // Create new context for second player (separate cookies!)
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await page2.goto(`${BASE_URL}/join/${room.inviteCode}`);

      // Fill name and join
      await page2.fill('input[placeholder="Enter your name"]', "Player2");
      await page2.getByRole("button", { name: "Join Game" }).click();

      // Should redirect to lobby
      await page2.waitForURL(/\/room\/.*\/lobby/);
      await expect(page2.getByRole("heading", { name: "Game Lobby" })).toBeVisible();

      // Refresh host page to see updated player count
      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);
      await expect(page.getByText("Players (2)")).toBeVisible({ timeout: 10000 });

      await context2.close();
    });
  });

  test.describe("Lobby Functionality", () => {
    test("should show invite modal with code and link", async ({ page }) => {
      await page.goto(BASE_URL);
      const room = await createRoom(page, "InviteTestHost");
      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);

      // Click invite button
      await page.getByRole("button", { name: "Invite Players" }).click();

      // Modal should appear with invite code - check for the heading specifically
      await expect(page.getByRole("heading", { name: "Invite Players" })).toBeVisible();
      await expect(page.getByText(`${room.inviteCode.slice(0, 4)}-${room.inviteCode.slice(4)}`)).toBeVisible();
      await expect(page.getByText("Or share link")).toBeVisible();
    });

    test("should allow host to change spokesperson", async ({ page, browser }) => {
      // Create room and add second player
      await page.goto(BASE_URL);
      const room = await createRoom(page, "SpokesHost");

      // Create new context for second player (separate cookies!)
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await page2.goto(`${BASE_URL}/join/${room.inviteCode}`);
      await page2.fill('input[placeholder="Enter your name"]', "SpokesPlayer2");
      await page2.getByRole("button", { name: "Join Game" }).click();
      await page2.waitForURL(/\/room\/.*\/lobby/);

      // Wait for page2 to finish loading
      await expect(page2.getByRole("heading", { name: "Game Lobby" })).toBeVisible();

      // Go to lobby as host and verify 2 players
      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);
      await expect(page.getByText("Players (2)")).toBeVisible({ timeout: 10000 });

      // Open spokesperson dropdown (it's a select) and select Player2
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "SpokesPlayer2" }).click();

      // Verify the selection shows in the dropdown
      await expect(page.getByRole("combobox")).toContainText("SpokesPlayer2");

      await context2.close();
    });
  });

  test.describe("Game Play (Authenticated)", () => {
    test("should start game and show play page with chat", async ({ page }) => {
      // Register user first
      const email = uniqueEmail("playtest");
      const password = "TestPass123!";
      await registerUser(page, email, password, INVITE_CODES[0]);

      // Create room (as authenticated user)
      const room = await createRoom(page, "AuthHost");

      // Go to lobby and start game
      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);
      await expect(page.getByRole("heading", { name: "Game Lobby" })).toBeVisible();
      await page.getByRole("button", { name: "Start Game" }).click();

      // Should redirect to play page
      await page.waitForURL(/\/room\/.*\/play/, { timeout: 15000 });

      // Verify play page elements
      await expect(page.getByText("You are the spokesperson")).toBeVisible({ timeout: 10000 });
    });

    test("should show player chat sidebar", async ({ page }) => {
      // Register user
      const email = uniqueEmail("sidebartest");
      const password = "TestPass123!";
      await registerUser(page, email, password, INVITE_CODES[1]);

      // Create room and start game
      const room = await createRoom(page, "SidebarHost");
      await startGame(page, room.roomId, room.guestId ?? undefined);

      // Navigate to play page
      await page.goto(`${BASE_URL}/room/${room.roomId}/play`);

      // Check for player chat sidebar
      await expect(page.getByText("Player Chat")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Chat with your party")).toBeVisible();
    });

    test("spokesperson input should be enabled", async ({ page }) => {
      // Register user
      const email = uniqueEmail("inputtest");
      const password = "TestPass123!";
      await registerUser(page, email, password, INVITE_CODES[2]);

      // Create room and start game
      const room = await createRoom(page, "InputHost");
      await startGame(page, room.roomId, room.guestId ?? undefined);

      // Navigate to play page
      await page.goto(`${BASE_URL}/room/${room.roomId}/play`);

      // Verify spokesperson indicator is visible
      await expect(page.getByText("You are the spokesperson")).toBeVisible({ timeout: 10000 });

      // Verify the player chat sidebar is visible
      await expect(page.getByText("Player Chat")).toBeVisible();
    });
  });

  test.describe("Multiplayer Synchronization", () => {
    test("both players should see each other in lobby", async ({ page, browser }) => {
      // Use guest flow (faster than registration)
      await page.goto(BASE_URL);
      const room = await createRoom(page, "SyncHost");

      // Create new context for second player (separate cookies!)
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await page2.goto(`${BASE_URL}/join/${room.inviteCode}`);
      await page2.fill('input[placeholder="Enter your name"]', "SyncPlayer2");
      await page2.getByRole("button", { name: "Join Game" }).click();
      await page2.waitForURL(/\/room\/.*\/lobby/);
      await expect(page2.getByRole("heading", { name: "Game Lobby" })).toBeVisible();

      // Both should see 2 players
      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);
      await expect(page.getByText("Players (2)")).toBeVisible({ timeout: 10000 });
      await expect(page2.getByText("Players (2)")).toBeVisible({ timeout: 10000 });

      // Both should see both player names in the player list
      await expect(page.getByRole("listitem").filter({ hasText: "SyncHost" })).toBeVisible();
      await expect(page.getByRole("listitem").filter({ hasText: "SyncPlayer2" })).toBeVisible();
      await expect(page2.getByRole("listitem").filter({ hasText: "SyncHost" })).toBeVisible();
      await expect(page2.getByRole("listitem").filter({ hasText: "SyncPlayer2" })).toBeVisible();

      await context2.close();
    });

    test("non-spokesperson should see spokesperson indicator", async ({ page, browser }) => {
      // Register host (needed for game start - at least one auth user required)
      const hostEmail = uniqueEmail("disabledhost");
      const password = "TestPass123!";
      await registerUser(page, hostEmail, password, INVITE_CODES[0]);

      // Create room
      const room = await createRoom(page, "DisabledHost");

      // Create new context for second player (separate cookies!)
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await page2.goto(`${BASE_URL}/join/${room.inviteCode}`);
      await page2.fill('input[placeholder="Enter your name"]', "DisabledPlayer2");
      await page2.getByRole("button", { name: "Join Game" }).click();
      await page2.waitForURL(/\/room\/.*\/lobby/);
      await expect(page2.getByRole("heading", { name: "Game Lobby" })).toBeVisible();

      // Start game from host
      await page.goto(`${BASE_URL}/room/${room.roomId}/lobby`);
      await expect(page.getByText("Players (2)")).toBeVisible({ timeout: 10000 });
      await page.getByRole("button", { name: "Start Game" }).click();
      await page.waitForURL(/\/room\/.*\/play/);

      // Player 2 navigates to play
      await page2.goto(`${BASE_URL}/room/${room.roomId}/play`);

      // Player 2 should see "X is speaking" not "You are the spokesperson"
      await expect(page2.getByText("is speaking")).toBeVisible({ timeout: 10000 });

      // Player 2 should also see the player chat sidebar
      await expect(page2.getByText("Player Chat")).toBeVisible();

      await context2.close();
    });
  });
});
