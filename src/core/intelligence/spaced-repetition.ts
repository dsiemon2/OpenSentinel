/**
 * Spaced Repetition System (SM-2 Algorithm)
 *
 * Optimizes memory retention by scheduling reviews at increasing intervals.
 * Used for:
 * - Remembering user preferences / facts
 * - Reinforcing important information from conversations
 * - Flashcard-like learning for any domain
 *
 * Based on SuperMemo SM-2 algorithm by Piotr Wozniak.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface ReviewItem {
  id: string;
  /** The content to be remembered */
  front: string;
  /** The answer / detail */
  back: string;
  /** Category / topic tag */
  category?: string;
  /** SM-2: ease factor (default 2.5, range 1.3-2.5) */
  easeFactor: number;
  /** SM-2: number of consecutive correct reviews */
  repetitions: number;
  /** SM-2: current interval in days */
  interval: number;
  /** Next scheduled review date */
  nextReview: Date;
  /** When this item was created */
  createdAt: Date;
  /** Last review date */
  lastReviewed: Date | null;
  /** Total times reviewed */
  totalReviews: number;
  /** User ID */
  userId: string;
}

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;
// 0 = complete blackout
// 1 = incorrect, but remembered upon seeing answer
// 2 = incorrect, but answer seemed easy to recall
// 3 = correct with serious difficulty
// 4 = correct after hesitation
// 5 = perfect, instant recall

export interface ReviewResult {
  item: ReviewItem;
  previousInterval: number;
  newInterval: number;
  nextReview: Date;
}

export interface ReviewStats {
  totalItems: number;
  dueNow: number;
  dueToday: number;
  averageEaseFactor: number;
  masteredCount: number; // interval > 21 days
  learningCount: number; // interval <= 21 days
  categories: Record<string, number>;
}

// ─── In-Memory Store ────────────────────────────────────────────────

const items = new Map<string, ReviewItem>();
let idCounter = 0;

function generateId(): string {
  return `sr-${++idCounter}-${Date.now().toString(36)}`;
}

// ─── SM-2 Core Algorithm ────────────────────────────────────────────

/**
 * Calculate the next interval and ease factor based on review quality.
 */
function sm2(
  quality: ReviewQuality,
  repetitions: number,
  easeFactor: number,
  interval: number
): { repetitions: number; easeFactor: number; interval: number } {
  let newReps = repetitions;
  let newEF = easeFactor;
  let newInterval = interval;

  if (quality >= 3) {
    // Correct response
    if (newReps === 0) {
      newInterval = 1;
    } else if (newReps === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    newReps += 1;
  } else {
    // Incorrect → reset
    newReps = 0;
    newInterval = 1;
  }

  // Update ease factor
  newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEF = Math.max(1.3, newEF); // Floor at 1.3

  return { repetitions: newReps, easeFactor: newEF, interval: newInterval };
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Add a new item to the spaced repetition system.
 */
export function addItem(
  userId: string,
  front: string,
  back: string,
  category?: string
): ReviewItem {
  const id = generateId();
  const item: ReviewItem = {
    id,
    front,
    back,
    category,
    easeFactor: 2.5,
    repetitions: 0,
    interval: 0,
    nextReview: new Date(), // due immediately
    createdAt: new Date(),
    lastReviewed: null,
    totalReviews: 0,
    userId,
  };
  items.set(id, item);
  return item;
}

/**
 * Record a review result and schedule the next one.
 */
export function reviewItem(itemId: string, quality: ReviewQuality): ReviewResult | null {
  const item = items.get(itemId);
  if (!item) return null;

  const previousInterval = item.interval;

  const { repetitions, easeFactor, interval } = sm2(
    quality,
    item.repetitions,
    item.easeFactor,
    item.interval
  );

  item.repetitions = repetitions;
  item.easeFactor = easeFactor;
  item.interval = interval;
  item.lastReviewed = new Date();
  item.totalReviews++;

  // Schedule next review
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);
  item.nextReview = nextReview;

  return {
    item,
    previousInterval,
    newInterval: interval,
    nextReview,
  };
}

/**
 * Get items due for review.
 */
export function getDueItems(userId: string, limit: number = 20): ReviewItem[] {
  const now = new Date();
  return Array.from(items.values())
    .filter((item) => item.userId === userId && item.nextReview <= now)
    .sort((a, b) => a.nextReview.getTime() - b.nextReview.getTime())
    .slice(0, limit);
}

/**
 * Get all items for a user.
 */
export function getUserItems(userId: string, category?: string): ReviewItem[] {
  return Array.from(items.values())
    .filter((item) => item.userId === userId && (!category || item.category === category))
    .sort((a, b) => a.nextReview.getTime() - b.nextReview.getTime());
}

/**
 * Get review statistics for a user.
 */
export function getStats(userId: string): ReviewStats {
  const userItems = Array.from(items.values()).filter((i) => i.userId === userId);
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const categories: Record<string, number> = {};
  let totalEF = 0;
  let mastered = 0;

  for (const item of userItems) {
    totalEF += item.easeFactor;
    if (item.interval > 21) mastered++;
    if (item.category) {
      categories[item.category] = (categories[item.category] || 0) + 1;
    }
  }

  return {
    totalItems: userItems.length,
    dueNow: userItems.filter((i) => i.nextReview <= now).length,
    dueToday: userItems.filter((i) => i.nextReview <= endOfDay).length,
    averageEaseFactor: userItems.length > 0 ? totalEF / userItems.length : 2.5,
    masteredCount: mastered,
    learningCount: userItems.length - mastered,
    categories,
  };
}

/**
 * Delete an item.
 */
export function deleteItem(itemId: string): boolean {
  return items.delete(itemId);
}

/**
 * Get a specific item by ID.
 */
export function getItem(itemId: string): ReviewItem | null {
  return items.get(itemId) || null;
}

export default {
  addItem,
  reviewItem,
  getDueItems,
  getUserItems,
  getStats,
  deleteItem,
  getItem,
};
