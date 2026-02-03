import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  Collection,
  type Message as DiscordMessage,
  type VoiceState,
  type GuildMember,
  type Interaction,
  ChannelType,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  type VoiceConnection,
  type AudioPlayer,
} from "@discordjs/voice";
import { Readable } from "stream";
import { chatWithTools, type Message } from "../../core/brain";
import { transcribeAudio } from "../../outputs/stt";
import { textToSpeech } from "../../outputs/tts";
import {
  slashCommands,
  getCommandData,
  getCommand,
  getSession,
  addToSession,
  splitMessage,
} from "./commands";

/**
 * Discord bot configuration
 */
export interface DiscordBotConfig {
  token: string;
  clientId: string;
  guildId?: string; // Optional: for development/testing with guild-specific commands
  allowedUserIds?: string[]; // Optional: restrict to specific users
  allowedRoleIds?: string[]; // Optional: restrict to users with specific roles
  allowDMs?: boolean; // Allow direct messages
  allowChannels?: boolean; // Allow server channels
}

/**
 * Voice connection state
 */
interface VoiceState {
  connection: VoiceConnection;
  player: AudioPlayer;
  guildId: string;
  channelId: string;
}

/**
 * Discord bot session data
 */
export interface DiscordSessionData {
  messages: Message[];
  lastActivity: Date;
}

/**
 * Discord bot class
 */
export class DiscordBot {
  private client: Client;
  private config: DiscordBotConfig;
  private rest: REST;
  private voiceConnections: Map<string, VoiceState> = new Map();
  private commandCollection: Collection<string, typeof slashCommands[number]>;
  private isReady: boolean = false;

  constructor(config: DiscordBotConfig) {
    this.config = config;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
      ],
    });

    this.rest = new REST({ version: "10" }).setToken(config.token);

    // Set up command collection
    this.commandCollection = new Collection();
    for (const command of slashCommands) {
      this.commandCollection.set(command.data.name, command);
    }

    this.setupEventHandlers();
  }

  /**
   * Set up Discord event handlers
   */
  private setupEventHandlers(): void {
    // Bot ready event
    this.client.once(Events.ClientReady, (readyClient) => {
      this.isReady = true;
      console.log(`[Discord] Bot ready as ${readyClient.user.tag}`);
      console.log(
        `[Discord] Connected to ${readyClient.guilds.cache.size} guild(s)`
      );
    });

    // Slash command interaction handler
    this.client.on(Events.InteractionCreate, async (interaction) => {
      await this.handleInteraction(interaction);
    });

    // Message handler (for DMs and @mentions)
    this.client.on(Events.MessageCreate, async (message) => {
      await this.handleMessage(message);
    });

    // Voice state update handler
    this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      await this.handleVoiceStateUpdate(oldState, newState);
    });

    // Error handler
    this.client.on(Events.Error, (error) => {
      console.error("[Discord] Client error:", error);
    });

    // Warn handler
    this.client.on(Events.Warn, (warning) => {
      console.warn("[Discord] Warning:", warning);
    });
  }

  /**
   * Handle slash command interactions
   */
  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    // Check user authorization
    if (!this.isUserAuthorized(interaction.user.id, interaction.member as GuildMember | null)) {
      await interaction.reply({
        content: "You are not authorized to use this bot.",
        ephemeral: true,
      });
      return;
    }

    const command = this.commandCollection.get(interaction.commandName);
    if (!command) {
      console.warn(`[Discord] Unknown command: ${interaction.commandName}`);
      return;
    }

    // Handle voice commands specially
    if (interaction.commandName === "voice") {
      await this.handleVoiceCommand(interaction);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(
        `[Discord] Error executing command ${interaction.commandName}:`,
        error
      );
      const errorMessage = "There was an error executing this command.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }

  /**
   * Handle voice slash commands
   */
  private async handleVoiceCommand(
    interaction: Interaction
  ): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "join":
        await this.joinVoiceChannel(interaction);
        break;
      case "leave":
        await this.leaveVoiceChannel(interaction);
        break;
      case "speak":
        await this.speakInVoiceChannel(interaction);
        break;
      default:
        await interaction.reply({
          content: "Unknown voice subcommand.",
          ephemeral: true,
        });
    }
  }

  /**
   * Join a voice channel
   */
  private async joinVoiceChannel(
    interaction: Interaction
  ): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guild) {
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: "You need to be in a voice channel for me to join.",
        ephemeral: true,
      });
      return;
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer();
      connection.subscribe(player);

      // Wait for connection to be ready
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

      this.voiceConnections.set(interaction.guild.id, {
        connection,
        player,
        guildId: interaction.guild.id,
        channelId: voiceChannel.id,
      });

      await interaction.reply({
        content: `Joined ${voiceChannel.name}!`,
        ephemeral: true,
      });

      console.log(
        `[Discord] Joined voice channel: ${voiceChannel.name} in ${interaction.guild.name}`
      );
    } catch (error) {
      console.error("[Discord] Error joining voice channel:", error);
      await interaction.reply({
        content: "Failed to join the voice channel. Please try again.",
        ephemeral: true,
      });
    }
  }

  /**
   * Leave a voice channel
   */
  private async leaveVoiceChannel(
    interaction: Interaction
  ): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guild) {
      return;
    }

    const voiceState = this.voiceConnections.get(interaction.guild.id);

    if (!voiceState) {
      await interaction.reply({
        content: "I'm not in a voice channel.",
        ephemeral: true,
      });
      return;
    }

    try {
      voiceState.player.stop();
      voiceState.connection.destroy();
      this.voiceConnections.delete(interaction.guild.id);

      await interaction.reply({
        content: "Left the voice channel.",
        ephemeral: true,
      });

      console.log(
        `[Discord] Left voice channel in ${interaction.guild.name}`
      );
    } catch (error) {
      console.error("[Discord] Error leaving voice channel:", error);
      await interaction.reply({
        content: "Failed to leave the voice channel.",
        ephemeral: true,
      });
    }
  }

  /**
   * Speak text in a voice channel using TTS
   */
  private async speakInVoiceChannel(
    interaction: Interaction
  ): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guild) {
      return;
    }

    const voiceState = this.voiceConnections.get(interaction.guild.id);

    if (!voiceState) {
      await interaction.reply({
        content: "I need to be in a voice channel first. Use `/voice join`.",
        ephemeral: true,
      });
      return;
    }

    const text = interaction.options.getString("text", true);

    await interaction.deferReply({ ephemeral: true });

    try {
      const audioBuffer = await textToSpeech(text);

      if (!audioBuffer) {
        await interaction.editReply("Failed to generate speech. TTS service may be unavailable.");
        return;
      }

      // Create readable stream from buffer
      const stream = Readable.from(audioBuffer);
      const resource = createAudioResource(stream);

      voiceState.player.play(resource);

      // Wait for playback to finish
      await new Promise<void>((resolve) => {
        voiceState.player.once(AudioPlayerStatus.Idle, () => resolve());
      });

      await interaction.editReply(`Spoke: "${text}"`);

      console.log(
        `[Discord] Spoke in voice channel: "${text.substring(0, 50)}..."`
      );
    } catch (error) {
      console.error("[Discord] Error speaking in voice channel:", error);
      await interaction.editReply(
        "Failed to speak in the voice channel. Please try again."
      );
    }
  }

  /**
   * Handle incoming messages (DMs and @mentions)
   */
  private async handleMessage(message: DiscordMessage): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check if it's a DM or a mention
    const isDM = message.channel.type === ChannelType.DM;
    const isMentioned = message.mentions.has(this.client.user!.id);

    // Skip if not DM and not mentioned
    if (!isDM && !isMentioned) return;

    // Check configuration
    if (isDM && !this.config.allowDMs) return;
    if (!isDM && !this.config.allowChannels) return;

    // Check authorization
    if (!this.isUserAuthorized(message.author.id, message.member)) return;

    // Get the actual content (remove mention if present)
    let content = message.content;
    if (isMentioned) {
      content = content.replace(/<@!?\d+>/g, "").trim();
    }

    if (!content && message.attachments.size === 0) return;

    const userId = message.author.id;

    try {
      // Show typing indicator
      await message.channel.sendTyping();

      // Handle file attachments
      let processedContent = content;
      if (message.attachments.size > 0) {
        const attachmentDescriptions = await this.processAttachments(message);
        if (attachmentDescriptions.length > 0) {
          processedContent += "\n\n[Attachments:\n" + attachmentDescriptions.join("\n") + "]";
        }
      }

      addToSession(userId, { role: "user", content: processedContent });

      const response = await chatWithTools(
        getSession(userId),
        `discord:${userId}`,
        async () => {
          // Keep typing indicator alive during tool use
          await message.channel.sendTyping();
        }
      );

      addToSession(userId, { role: "assistant", content: response.content });

      // Build response with tool usage info
      let finalResponse = response.content;
      if (response.toolsUsed && response.toolsUsed.length > 0) {
        const toolList = [...new Set(response.toolsUsed)].join(", ");
        finalResponse = `*Used: ${toolList}*\n\n${response.content}`;
      }

      // Send response (handle Discord's 2000 char limit)
      if (finalResponse.length > 2000) {
        const chunks = splitMessage(finalResponse, 2000);
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(finalResponse);
      }

      console.log(
        `[Discord] Processed message from ${message.author.tag}. Tokens: ${response.inputTokens}/${response.outputTokens}` +
          (response.toolsUsed ? ` Tools: ${response.toolsUsed.join(", ")}` : "")
      );
    } catch (error) {
      console.error("[Discord] Error processing message:", error);
      await message.reply(
        "Sorry, I encountered an error processing your message. Please try again."
      );
    }
  }

  /**
   * Process message attachments
   */
  private async processAttachments(
    message: DiscordMessage
  ): Promise<string[]> {
    const descriptions: string[] = [];

    for (const [, attachment] of message.attachments) {
      const contentType = attachment.contentType || "";
      const fileName = attachment.name || "unknown";

      if (contentType.startsWith("audio/")) {
        // Handle voice/audio messages
        try {
          const response = await fetch(attachment.url);
          const audioBuffer = await response.arrayBuffer();
          const transcription = await transcribeAudio(Buffer.from(audioBuffer));

          if (transcription) {
            descriptions.push(`Audio transcription (${fileName}): "${transcription}"`);
          } else {
            descriptions.push(`Audio file: ${fileName} (could not transcribe)`);
          }
        } catch (error) {
          console.error("[Discord] Error processing audio attachment:", error);
          descriptions.push(`Audio file: ${fileName} (error processing)`);
        }
      } else if (contentType.startsWith("text/")) {
        // Handle text files
        try {
          const response = await fetch(attachment.url);
          const text = await response.text();
          const preview = text.length > 1000 ? text.substring(0, 1000) + "..." : text;
          descriptions.push(`Text file (${fileName}):\n${preview}`);
        } catch (error) {
          descriptions.push(`Text file: ${fileName} (could not read)`);
        }
      } else {
        // Other file types
        descriptions.push(
          `File: ${fileName} (${contentType || "unknown type"}, ${
            attachment.size
          } bytes)`
        );
      }
    }

    return descriptions;
  }

  /**
   * Handle voice state updates
   */
  private async handleVoiceStateUpdate(
    oldState: VoiceState,
    newState: VoiceState
  ): Promise<void> {
    // Check if the bot was disconnected
    if (
      oldState.member?.id === this.client.user?.id &&
      !newState.channelId &&
      oldState.channelId
    ) {
      // Bot was disconnected from voice
      const guildId = oldState.guild.id;
      const voiceState = this.voiceConnections.get(guildId);

      if (voiceState) {
        voiceState.player.stop();
        this.voiceConnections.delete(guildId);
        console.log(`[Discord] Bot disconnected from voice in ${oldState.guild.name}`);
      }
    }
  }

  /**
   * Check if a user is authorized to use the bot
   */
  private isUserAuthorized(
    userId: string,
    member: GuildMember | null
  ): boolean {
    // If no restrictions, allow everyone
    if (
      !this.config.allowedUserIds?.length &&
      !this.config.allowedRoleIds?.length
    ) {
      return true;
    }

    // Check user ID allowlist
    if (this.config.allowedUserIds?.includes(userId)) {
      return true;
    }

    // Check role allowlist
    if (member && this.config.allowedRoleIds?.length) {
      for (const roleId of this.config.allowedRoleIds) {
        if (member.roles.cache.has(roleId)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Register slash commands with Discord
   */
  async registerCommands(): Promise<void> {
    const commands = getCommandData();

    try {
      console.log("[Discord] Registering slash commands...");

      if (this.config.guildId) {
        // Register guild-specific commands (instant update, good for testing)
        await this.rest.put(
          Routes.applicationGuildCommands(
            this.config.clientId,
            this.config.guildId
          ),
          { body: commands }
        );
        console.log(
          `[Discord] Registered ${commands.length} guild commands for guild ${this.config.guildId}`
        );
      } else {
        // Register global commands (can take up to 1 hour to propagate)
        await this.rest.put(Routes.applicationCommands(this.config.clientId), {
          body: commands,
        });
        console.log(
          `[Discord] Registered ${commands.length} global commands`
        );
      }
    } catch (error) {
      console.error("[Discord] Error registering commands:", error);
      throw error;
    }
  }

  /**
   * Start the Discord bot
   */
  async start(): Promise<void> {
    console.log("[Discord] Starting bot...");

    // Register commands first
    await this.registerCommands();

    // Login to Discord
    await this.client.login(this.config.token);
  }

  /**
   * Stop the Discord bot
   */
  async stop(): Promise<void> {
    console.log("[Discord] Stopping bot...");

    // Disconnect all voice connections
    for (const [guildId, voiceState] of this.voiceConnections) {
      voiceState.player.stop();
      voiceState.connection.destroy();
      this.voiceConnections.delete(guildId);
    }

    // Destroy client
    this.client.destroy();
    this.isReady = false;

    console.log("[Discord] Bot stopped");
  }

  /**
   * Get the Discord client
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Check if bot is ready
   */
  ready(): boolean {
    return this.isReady;
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(channelId: string, content: string): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);
    if (channel?.isTextBased() && "send" in channel) {
      await channel.send(content);
    }
  }

  /**
   * Send a message with an embed
   */
  async sendEmbed(
    channelId: string,
    title: string,
    description: string,
    color?: number
  ): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);
    if (channel?.isTextBased() && "send" in channel) {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color || 0x5865f2)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    }
  }

  /**
   * Send a file to a channel
   */
  async sendFile(
    channelId: string,
    buffer: Buffer,
    filename: string,
    content?: string
  ): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);
    if (channel?.isTextBased() && "send" in channel) {
      const attachment = new AttachmentBuilder(buffer, { name: filename });
      await channel.send({
        content,
        files: [attachment],
      });
    }
  }
}

/**
 * Create and configure Discord bot
 */
export function createDiscordBot(config: DiscordBotConfig): DiscordBot {
  return new DiscordBot(config);
}

/**
 * Export commands module
 */
export * from "./commands";

/**
 * Default export
 */
export default {
  createDiscordBot,
  DiscordBot,
  slashCommands,
  getCommandData,
  getCommand,
};
