import sdk from "matrix-js-sdk";
import { chatWithTools, type Message } from "../../core/brain";

/**
 * Matrix bot configuration
 */
export interface MatrixBotConfig {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  allowedRoomIds?: string[];
  autoJoin?: boolean;
  e2eEnabled?: boolean;
}

/**
 * Matrix bot class — connects to a Matrix homeserver and responds to messages
 * using the OpenSentinel brain (chatWithTools).
 */
export class MatrixBot {
  private client: any;
  private sessions: Map<string, Array<{ role: string; content: string }>> =
    new Map();
  private maxSessionMessages: number = 20;

  private homeserverUrl: string;
  private accessToken: string;
  private userId: string;
  private allowedRoomIds?: string[];
  private autoJoin: boolean;
  private e2eEnabled: boolean;

  constructor(config: MatrixBotConfig) {
    this.homeserverUrl = config.homeserverUrl;
    this.accessToken = config.accessToken;
    this.userId = config.userId;
    this.allowedRoomIds = config.allowedRoomIds;
    this.autoJoin = config.autoJoin ?? false;
    this.e2eEnabled = config.e2eEnabled ?? false;
  }

  /**
   * Start the Matrix bot — creates the client, registers event listeners,
   * and begins syncing with the homeserver.
   */
  async start(): Promise<void> {
    console.log("[Matrix] Starting bot...");

    this.client = sdk.createClient({
      baseUrl: this.homeserverUrl,
      accessToken: this.accessToken,
      userId: this.userId,
    });

    // Handle incoming room timeline events (messages)
    this.client.on("Room.timeline", async (event: any, room: any) => {
      try {
        // Only handle m.room.message events
        if (event.getType() !== "m.room.message") return;

        const sender: string = event.getSender();
        const roomId: string = room.roomId;

        // Ignore our own messages
        if (sender === this.userId) return;

        const content = event.getContent();

        // Ignore non-text messages (images, files, etc.)
        if (!content || content.msgtype !== "m.text") return;

        const body: string = content.body;
        if (!body || !body.trim()) return;

        // Check if room is in the allowed list (if configured)
        if (
          this.allowedRoomIds &&
          this.allowedRoomIds.length > 0 &&
          !this.allowedRoomIds.includes(roomId)
        ) {
          return;
        }

        // Only respond if the bot is mentioned or if it's a DM
        const mentioned = this.isMentioned(body);
        const dm = this.isDM(roomId);

        if (!mentioned && !dm) return;

        // Set typing indicator to show we're processing
        try {
          await this.client.sendTyping(roomId, true, 30000);
        } catch (err) {
          console.warn("[Matrix] Failed to set typing indicator:", err);
        }

        // Process the message and get a response
        const response = await this.processMessage(roomId, sender, body);

        // Clear typing indicator
        try {
          await this.client.sendTyping(roomId, false, 0);
        } catch (err) {
          console.warn("[Matrix] Failed to clear typing indicator:", err);
        }

        // Send the response, splitting if necessary
        await this.sendMessage(roomId, response);

        console.log(
          `[Matrix] Processed message from ${sender} in room ${roomId}`
        );
      } catch (error) {
        console.error("[Matrix] Error handling Room.timeline event:", error);

        // Attempt to clear typing indicator on error
        try {
          await this.client.sendTyping(room.roomId, false, 0);
        } catch {
          // Ignore typing indicator cleanup errors
        }

        // Attempt to send error message to the room
        try {
          await this.client.sendEvent(
            room.roomId,
            "m.room.message",
            {
              msgtype: "m.text",
              body: "Sorry, I encountered an error processing your message. Please try again.",
            },
            ""
          );
        } catch (sendError) {
          console.error("[Matrix] Failed to send error message:", sendError);
        }
      }
    });

    // Handle room membership events (auto-join invites)
    this.client.on(
      "RoomMember.membership",
      async (event: any, member: any) => {
        try {
          if (
            this.autoJoin &&
            member.membership === "invite" &&
            member.userId === this.userId
          ) {
            const roomId = member.roomId;
            console.log(`[Matrix] Auto-joining room: ${roomId}`);

            await this.client.joinRoom(roomId);
            console.log(`[Matrix] Successfully joined room: ${roomId}`);
          }
        } catch (error) {
          console.error("[Matrix] Error handling membership event:", error);
        }
      }
    );

    // Start the client with a limited initial sync
    await this.client.startClient({ initialSyncLimit: 10 });

    console.log(`[Matrix] Bot started as ${this.userId}`);
  }

  /**
   * Stop the Matrix bot and disconnect from the homeserver.
   */
  async stop(): Promise<void> {
    console.log("[Matrix] Stopping bot...");

    if (this.client) {
      this.client.stopClient();
    }

    console.log("[Matrix] Bot stopped");
  }

  /**
   * Process an incoming message: manage session history, call chatWithTools,
   * and return the response text.
   */
  private async processMessage(
    roomId: string,
    sender: string,
    body: string
  ): Promise<string> {
    // Get or create the session for this room
    let session = this.sessions.get(roomId);
    if (!session) {
      session = [];
      this.sessions.set(roomId, session);
    }

    // Add the user message to the session
    session.push({ role: "user", content: body });

    // Trim session to the max allowed messages
    if (session.length > this.maxSessionMessages) {
      session.splice(0, session.length - this.maxSessionMessages);
    }

    try {
      // Call chatWithTools with the session messages
      const response = await chatWithTools(
        session as Message[],
        `matrix:${sender}`,
        async () => {
          // Refresh typing indicator during tool use
          try {
            await this.client.sendTyping(roomId, true, 30000);
          } catch {
            // Ignore typing indicator errors during tool use
          }
        }
      );

      // Add the assistant response to the session
      session.push({ role: "assistant", content: response.content });

      // Trim session again if needed
      if (session.length > this.maxSessionMessages) {
        session.splice(0, session.length - this.maxSessionMessages);
      }

      // Build response with tool usage info
      let finalResponse = response.content;
      if (response.toolsUsed && response.toolsUsed.length > 0) {
        const toolList = [...new Set(response.toolsUsed)].join(", ");
        finalResponse = `[Used: ${toolList}]\n\n${response.content}`;
      }

      console.log(
        `[Matrix] Response generated. Tokens: ${response.inputTokens}/${response.outputTokens}` +
          (response.toolsUsed
            ? ` Tools: ${response.toolsUsed.join(", ")}`
            : "")
      );

      return finalResponse;
    } catch (error) {
      console.error("[Matrix] Error calling chatWithTools:", error);
      return "Sorry, I encountered an error processing your message. Please try again.";
    }
  }

  /**
   * Send a message to a room, splitting into multiple messages if the text
   * exceeds 4000 characters.
   */
  private async sendMessage(roomId: string, text: string): Promise<void> {
    const MAX_LENGTH = 4000;

    if (text.length <= MAX_LENGTH) {
      await this.client.sendEvent(
        roomId,
        "m.room.message",
        {
          msgtype: "m.text",
          body: text,
        },
        ""
      );
    } else {
      // Split into chunks at line boundaries when possible
      const chunks: string[] = [];
      let remaining = text;

      while (remaining.length > 0) {
        if (remaining.length <= MAX_LENGTH) {
          chunks.push(remaining);
          break;
        }

        // Try to split at a newline near the limit
        let splitIndex = remaining.lastIndexOf("\n", MAX_LENGTH);
        if (splitIndex === -1 || splitIndex < MAX_LENGTH * 0.5) {
          // If no good newline break, try a space
          splitIndex = remaining.lastIndexOf(" ", MAX_LENGTH);
        }
        if (splitIndex === -1 || splitIndex < MAX_LENGTH * 0.5) {
          // Hard split as a last resort
          splitIndex = MAX_LENGTH;
        }

        chunks.push(remaining.substring(0, splitIndex));
        remaining = remaining.substring(splitIndex).trimStart();
      }

      for (const chunk of chunks) {
        await this.client.sendEvent(
          roomId,
          "m.room.message",
          {
            msgtype: "m.text",
            body: chunk,
          },
          ""
        );
      }

      console.log(
        `[Matrix] Split long message into ${chunks.length} chunks for room ${roomId}`
      );
    }
  }

  /**
   * Check if the bot is mentioned in the message body.
   * Looks for the bot's full userId (e.g. @bot:matrix.org) or the localpart
   * (e.g. bot).
   */
  private isMentioned(body: string): boolean {
    const lowerBody = body.toLowerCase();

    // Check for full userId mention (e.g. @opensentinel:matrix.org)
    if (lowerBody.includes(this.userId.toLowerCase())) {
      return true;
    }

    // Check for localpart mention (e.g. opensentinel)
    // userId format is @localpart:server
    const localpart = this.userId.split(":")[0]?.replace("@", "");
    if (localpart && lowerBody.includes(localpart.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Check if a room is a direct message (has exactly 2 joined members).
   */
  private isDM(roomId: string): boolean {
    try {
      const room = this.client.getRoom(roomId);
      if (!room) return false;

      const members = room.getJoinedMembers();
      return members && members.length === 2;
    } catch (error) {
      console.error("[Matrix] Error checking if room is DM:", error);
      return false;
    }
  }
}

/**
 * Create and configure a Matrix bot
 */
export function createMatrixBot(config: MatrixBotConfig): MatrixBot {
  return new MatrixBot(config);
}

/**
 * Default export
 */
export default {
  createMatrixBot,
  MatrixBot,
};
