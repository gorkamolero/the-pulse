import 'server-only';

import { genSaltSync, hashSync } from 'bcrypt-ts';
import { and, asc, desc, eq, gt, gte, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  type Message,
  message,
  vote,
  userSettings,
  type UserSettings,
  room,
  roomPlayer,
  type Room,
  type RoomPlayer,
} from './schema';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error('Failed to get user from database');
    throw error;
  }
}

export async function createUser(email: string, password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  try {
    return await db.insert(user).values({ email, password: hash });
  } catch (error) {
    console.error('Failed to create user in database');
    throw error;
  }
}

// Fixed UUID for guest users - must exist in User table
export const GUEST_USER_ID = '00000000-0000-0000-0000-000000000000';
export const GUEST_USER_EMAIL = 'guest@pulse.local';

export async function ensureGuestUser(): Promise<string> {
  try {
    // Check if guest user exists
    const existing = await db.select().from(user).where(eq(user.id, GUEST_USER_ID));
    if (existing.length > 0) {
      return GUEST_USER_ID;
    }
    // Create guest user with fixed ID
    await db.insert(user).values({
      id: GUEST_USER_ID,
      email: GUEST_USER_EMAIL,
      password: null, // No password - can't login
    });
    return GUEST_USER_ID;
  } catch (error) {
    // If insert fails due to race condition, user already exists
    console.warn('Guest user creation race condition (expected):', error);
    return GUEST_USER_ID;
  }
}

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
    });
  } catch (error) {
    console.error('Failed to save chat in database');
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error('Failed to delete chat by id from database');
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(chat)
      .where(eq(chat.userId, id))
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    console.error('Failed to get chats by user from database');
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error('Failed to get chat by id from database');
    throw error;
  }
}

export async function saveMessages({ messages }: { messages: Array<Message> }) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    console.error('Failed to save messages in database', error);
    throw error;
  }
}

export async function updateMessageImageUrl({
  id,
  imageUrl,
}: {
  id: string;
  imageUrl: string;
}) {
  try {
    return await db
      .update(message)
      .set({ imageUrl })
      .where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to update message image URL in database', error);
    throw error;
  }
}

export async function updateMessageAudioUrl({
  id,
  audioUrl,
}: {
  id: string;
  audioUrl: string;
}) {
  try {
    return await db
      .update(message)
      .set({ audioUrl })
      .where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to update message audio URL in database', error);
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error('Failed to get messages by chat id from database', error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    console.error('Failed to upvote message in database', error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error('Failed to get votes by chat id from database', error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: 'text' | 'code' | 'image' | 'sheet';
  content: string;
  userId: string;
}) {
  try {
    return await db.insert(document).values({
      id,
      title,
      kind,
      content,
      userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to save document in database');
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      'Failed to delete documents by id after timestamp from database',
    );
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    console.error('Failed to save suggestions in database');
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    console.error(
      'Failed to get suggestions by document version from database',
    );
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    console.error(
      'Failed to delete messages by id after timestamp from database',
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}

// User Settings Queries

export async function getUserSettings(
  userId: string,
): Promise<UserSettings | null> {
  try {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    return settings ?? null;
  } catch (error) {
    console.error('Failed to get user settings from database');
    throw error;
  }
}

export async function saveUserSettings({
  userId,
  openrouterApiKey,
  aiGatewayApiKey,
}: {
  userId: string;
  openrouterApiKey?: string | null;
  aiGatewayApiKey?: string | null;
}): Promise<void> {
  try {
    const now = new Date();
    const existing = await getUserSettings(userId);

    if (existing) {
      const updates: Partial<UserSettings> = { updatedAt: now };
      if (openrouterApiKey !== undefined) {
        updates.openrouterApiKey = openrouterApiKey;
      }
      if (aiGatewayApiKey !== undefined) {
        updates.aiGatewayApiKey = aiGatewayApiKey;
      }
      await db
        .update(userSettings)
        .set(updates)
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        userId,
        openrouterApiKey: openrouterApiKey ?? null,
        aiGatewayApiKey: aiGatewayApiKey ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (error) {
    console.error('Failed to save user settings in database');
    throw error;
  }
}

export async function deleteUserApiKey(
  userId: string,
  provider: 'openrouter' | 'aiGateway',
): Promise<void> {
  try {
    const field =
      provider === 'openrouter' ? 'openrouterApiKey' : 'aiGatewayApiKey';
    await db
      .update(userSettings)
      .set({ [field]: null, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));
  } catch (error) {
    console.error('Failed to delete user API key from database');
    throw error;
  }
}

export async function startFreeStory(
  userId: string,
  storyId: string,
): Promise<void> {
  try {
    const now = new Date();
    const existing = await getUserSettings(userId);

    if (existing) {
      await db
        .update(userSettings)
        .set({ freeStoryId: storyId, updatedAt: now })
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        userId,
        freeStoryId: storyId,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (error) {
    console.error('Failed to start free story in database');
    throw error;
  }
}

export async function completeFreeStory(userId: string): Promise<void> {
  try {
    await db
      .update(userSettings)
      .set({ freeStoryUsed: true, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));
  } catch (error) {
    console.error('Failed to complete free story in database');
    throw error;
  }
}

export async function addMisuseWarning(userId: string): Promise<number> {
  try {
    const settings = await getUserSettings(userId);
    const currentWarnings = settings?.misuseWarnings ?? 0;
    const newWarnings = currentWarnings + 1;
    const shouldDegrade = newWarnings >= 2;

    if (settings) {
      await db
        .update(userSettings)
        .set({
          misuseWarnings: newWarnings,
          degradedMode: shouldDegrade,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        userId,
        misuseWarnings: newWarnings,
        degradedMode: shouldDegrade,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return newWarnings;
  } catch (error) {
    console.error('Failed to add misuse warning in database');
    throw error;
  }
}

export async function getFreeStoryStatus(userId: string): Promise<{
  hasFreeTier: boolean;
  storyInProgress: string | null;
  isDegraded: boolean;
}> {
  try {
    const settings = await getUserSettings(userId);

    if (!settings) {
      return { hasFreeTier: true, storyInProgress: null, isDegraded: false };
    }

    return {
      hasFreeTier: !settings.freeStoryUsed,
      storyInProgress: settings.freeStoryId,
      isDegraded: settings.degradedMode,
    };
  } catch (error) {
    console.error('Failed to get free story status from database');
    throw error;
  }
}

// ==================== Room Queries ====================

export async function createRoom({
  inviteCode,
  hostPlayerId,
  storyId,
}: {
  inviteCode: string;
  hostPlayerId?: string;
  storyId?: string;
}): Promise<Room> {
  try {
    const [newRoom] = await db
      .insert(room)
      .values({
        inviteCode,
        hostPlayerId: hostPlayerId ?? null,
        spokespersonPlayerId: hostPlayerId ?? null,
        status: 'lobby',
        storyId: storyId ?? null,
      })
      .returning();
    return newRoom;
  } catch (error) {
    console.error('Failed to create room in database');
    throw error;
  }
}

export async function getRoomById(id: string): Promise<Room | null> {
  try {
    const [foundRoom] = await db.select().from(room).where(eq(room.id, id));
    return foundRoom ?? null;
  } catch (error) {
    console.error('Failed to get room by id from database');
    throw error;
  }
}

export async function getRoomByInviteCode(
  inviteCode: string,
): Promise<Room | null> {
  try {
    const [foundRoom] = await db
      .select()
      .from(room)
      .where(eq(room.inviteCode, inviteCode));
    return foundRoom ?? null;
  } catch (error) {
    console.error('Failed to get room by invite code from database');
    throw error;
  }
}

export async function getRoomWithPlayers(
  id: string,
): Promise<(Room & { players: RoomPlayer[] }) | null> {
  try {
    const [foundRoom] = await db.select().from(room).where(eq(room.id, id));
    if (!foundRoom) return null;

    const players = await db
      .select()
      .from(roomPlayer)
      .where(eq(roomPlayer.roomId, id))
      .orderBy(asc(roomPlayer.joinedAt));

    return { ...foundRoom, players };
  } catch (error) {
    console.error('Failed to get room with players from database');
    throw error;
  }
}

export async function updateRoom(
  id: string,
  data: Partial<Pick<Room, 'status' | 'chatId' | 'hostPlayerId' | 'spokespersonPlayerId'>>,
): Promise<Room | null> {
  try {
    const [updated] = await db
      .update(room)
      .set(data)
      .where(eq(room.id, id))
      .returning();
    return updated ?? null;
  } catch (error) {
    console.error('Failed to update room in database');
    throw error;
  }
}

export async function addPlayerToRoom({
  roomId,
  userId,
  guestId,
  displayName,
  color,
  isHost,
}: {
  roomId: string;
  userId?: string;
  guestId?: string;
  displayName: string;
  color: string;
  isHost?: boolean;
}): Promise<RoomPlayer> {
  try {
    const [player] = await db
      .insert(roomPlayer)
      .values({
        roomId,
        userId: userId ?? null,
        guestId: guestId ?? null,
        displayName,
        color,
        isHost: isHost ?? false,
      })
      .returning();
    return player;
  } catch (error) {
    console.error('Failed to add player to room in database');
    throw error;
  }
}

export async function getPlayersByRoomId(roomId: string): Promise<RoomPlayer[]> {
  try {
    return await db
      .select()
      .from(roomPlayer)
      .where(eq(roomPlayer.roomId, roomId))
      .orderBy(asc(roomPlayer.joinedAt));
  } catch (error) {
    console.error('Failed to get players by room id from database');
    throw error;
  }
}

export async function getPlayerById(id: string): Promise<RoomPlayer | null> {
  try {
    const [player] = await db
      .select()
      .from(roomPlayer)
      .where(eq(roomPlayer.id, id));
    return player ?? null;
  } catch (error) {
    console.error('Failed to get player by id from database');
    throw error;
  }
}

export async function removePlayerFromRoom(playerId: string): Promise<void> {
  try {
    await db.delete(roomPlayer).where(eq(roomPlayer.id, playerId));
  } catch (error) {
    console.error('Failed to remove player from room in database');
    throw error;
  }
}

export async function getPlayerInRoom({
  roomId,
  userId,
  guestId,
}: {
  roomId: string;
  userId?: string;
  guestId?: string;
}): Promise<RoomPlayer | null> {
  try {
    if (userId) {
      const [player] = await db
        .select()
        .from(roomPlayer)
        .where(and(eq(roomPlayer.roomId, roomId), eq(roomPlayer.userId, userId)));
      return player ?? null;
    }
    if (guestId) {
      const [player] = await db
        .select()
        .from(roomPlayer)
        .where(and(eq(roomPlayer.roomId, roomId), eq(roomPlayer.guestId, guestId)));
      return player ?? null;
    }
    return null;
  } catch (error) {
    console.error('Failed to get player in room from database');
    throw error;
  }
}
