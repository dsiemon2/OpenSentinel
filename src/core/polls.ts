// Cross-platform poll creation and voting system

import { randomUUID } from "crypto";

export interface PollOption {
  text: string;
  votes: Set<string>; // user IDs
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  multiSelect: boolean;
  createdBy: string;
  createdAt: Date;
  closesAt?: Date;
  closed: boolean;
  channelType: string;
  channelId: string;
  messageRef?: string; // platform message ID for updating
}

export interface PollResults {
  id: string;
  question: string;
  totalVotes: number;
  options: Array<{
    text: string;
    votes: number;
    percentage: number;
    voters: string[];
  }>;
  closed: boolean;
}

// Store polls in memory
const polls: Map<string, Poll> = new Map();

// Auto-close timers
const closeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

export class PollManager {
  createPoll(params: {
    question: string;
    options: string[];
    multiSelect?: boolean;
    duration?: number; // minutes
    channelType: string;
    channelId: string;
    createdBy: string;
  }): Poll {
    const id = randomUUID().slice(0, 8);

    const poll: Poll = {
      id,
      question: params.question,
      options: params.options.map((text) => ({
        text,
        votes: new Set(),
      })),
      multiSelect: params.multiSelect ?? false,
      createdBy: params.createdBy,
      createdAt: new Date(),
      closed: false,
      channelType: params.channelType,
      channelId: params.channelId,
    };

    if (params.duration) {
      poll.closesAt = new Date(Date.now() + params.duration * 60 * 1000);
      const timer = setTimeout(() => {
        this.closePoll(id);
      }, params.duration * 60 * 1000);
      closeTimers.set(id, timer);
    }

    polls.set(id, poll);
    return poll;
  }

  vote(
    pollId: string,
    optionIndex: number,
    userId: string
  ): { success: boolean; error?: string } {
    const poll = polls.get(pollId);
    if (!poll) return { success: false, error: "Poll not found" };
    if (poll.closed) return { success: false, error: "Poll is closed" };
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      return { success: false, error: "Invalid option index" };
    }

    // If not multi-select, remove existing votes
    if (!poll.multiSelect) {
      for (const option of poll.options) {
        option.votes.delete(userId);
      }
    }

    // Toggle vote
    const option = poll.options[optionIndex];
    if (option.votes.has(userId)) {
      option.votes.delete(userId);
    } else {
      option.votes.add(userId);
    }

    return { success: true };
  }

  closePoll(pollId: string): PollResults | null {
    const poll = polls.get(pollId);
    if (!poll) return null;

    poll.closed = true;

    // Clear auto-close timer
    const timer = closeTimers.get(pollId);
    if (timer) {
      clearTimeout(timer);
      closeTimers.delete(pollId);
    }

    return this.getPollResults(pollId);
  }

  getPollResults(pollId: string): PollResults | null {
    const poll = polls.get(pollId);
    if (!poll) return null;

    const totalVoters = new Set<string>();
    for (const option of poll.options) {
      for (const voter of option.votes) {
        totalVoters.add(voter);
      }
    }

    const totalVotes = totalVoters.size;

    return {
      id: poll.id,
      question: poll.question,
      totalVotes,
      options: poll.options.map((opt) => ({
        text: opt.text,
        votes: opt.votes.size,
        percentage: totalVotes > 0 ? Math.round((opt.votes.size / totalVotes) * 100) : 0,
        voters: [...opt.votes],
      })),
      closed: poll.closed,
    };
  }

  getPoll(pollId: string): Poll | undefined {
    return polls.get(pollId);
  }

  getActivePolls(channelId?: string): Poll[] {
    const active: Poll[] = [];
    for (const poll of polls.values()) {
      if (!poll.closed && (!channelId || poll.channelId === channelId)) {
        active.push(poll);
      }
    }
    return active;
  }

  deletePoll(pollId: string): boolean {
    const timer = closeTimers.get(pollId);
    if (timer) {
      clearTimeout(timer);
      closeTimers.delete(pollId);
    }
    return polls.delete(pollId);
  }

  formatPollMessage(pollId: string): string {
    const results = this.getPollResults(pollId);
    if (!results) return "Poll not found";

    const poll = polls.get(pollId)!;
    const lines: string[] = [];

    lines.push(`\ud83d\udcca **${results.question}**`);
    if (poll.multiSelect) lines.push("_(Multiple choices allowed)_");
    lines.push("");

    for (let i = 0; i < results.options.length; i++) {
      const opt = results.options[i];
      const bar = "\u2588".repeat(Math.max(1, Math.round(opt.percentage / 5)));
      const emoji = `${i + 1}\ufe0f\u20e3`;
      lines.push(`${emoji} ${opt.text}`);
      lines.push(`   ${bar} ${opt.votes} vote${opt.votes !== 1 ? "s" : ""} (${opt.percentage}%)`);
    }

    lines.push("");
    lines.push(`\ud83d\udc65 ${results.totalVotes} total voter${results.totalVotes !== 1 ? "s" : ""}`);

    if (results.closed) {
      lines.push("\ud83d\udd12 _Poll closed_");
    } else if (poll.closesAt) {
      const remaining = Math.max(0, Math.round((poll.closesAt.getTime() - Date.now()) / 60000));
      lines.push(`\u23f0 Closes in ${remaining} minute${remaining !== 1 ? "s" : ""}`);
    }

    return lines.join("\n");
  }
}

// Singleton
export const pollManager = new PollManager();
