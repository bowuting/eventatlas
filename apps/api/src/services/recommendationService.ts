import {
  listOrganizerRatingStatsByWallets,
  listRecommendationCandidatesByWallet,
  listUserAttendanceHistoryByWallet
} from "../storage/postgres.js";
import type {
  OrganizerRatingStatItem,
  RecommendationCandidateItem,
  RecommendationItem,
  UserAttendanceHistoryItem
} from "../types/domain.js";

type RecommendationContext = {
  categoryCount: Map<string, number>;
  tagCount: Map<string, number>;
  maxCategoryCount: number;
  maxTagCount: number;
  history: UserAttendanceHistoryItem[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h =
    s1 * s1 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function buildContext(history: UserAttendanceHistoryItem[]): RecommendationContext {
  const categoryCount = new Map<string, number>();
  const tagCount = new Map<string, number>();

  for (const item of history) {
    categoryCount.set(item.category, (categoryCount.get(item.category) ?? 0) + 1);
    for (const tag of item.tags) {
      if (!tag) {
        continue;
      }
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }

  let maxCategoryCount = 1;
  for (const value of categoryCount.values()) {
    maxCategoryCount = Math.max(maxCategoryCount, value);
  }

  let maxTagCount = 1;
  for (const value of tagCount.values()) {
    maxTagCount = Math.max(maxTagCount, value);
  }

  return {
    categoryCount,
    tagCount,
    maxCategoryCount,
    maxTagCount,
    history
  };
}

function getCategoryScore(candidate: RecommendationCandidateItem, context: RecommendationContext) {
  if (context.history.length === 0) {
    return 0.45;
  }
  const count = context.categoryCount.get(candidate.category) ?? 0;
  return clamp(count / context.maxCategoryCount, 0, 1);
}

function getTagScore(candidate: RecommendationCandidateItem, context: RecommendationContext) {
  if (context.history.length === 0) {
    return 0.35;
  }
  if (candidate.tags.length === 0) {
    return 0;
  }
  const matchedWeight = candidate.tags.reduce(
    (sum, tag) => sum + (context.tagCount.get(tag) ?? 0),
    0
  );
  return clamp(matchedWeight / (candidate.tags.length * context.maxTagCount), 0, 1);
}

function getLocationScore(candidate: RecommendationCandidateItem, context: RecommendationContext) {
  if (context.history.length === 0) {
    return 0.4;
  }

  let minDistanceKm = Number.POSITIVE_INFINITY;
  for (const item of context.history) {
    const distance = haversineDistanceKm(candidate.lat, candidate.lng, item.lat, item.lng);
    minDistanceKm = Math.min(minDistanceKm, distance);
  }

  if (minDistanceKm <= 8) {
    return 1;
  }
  if (minDistanceKm <= 30) {
    return 0.85;
  }
  if (minDistanceKm <= 80) {
    return 0.7;
  }
  if (minDistanceKm <= 200) {
    return 0.5;
  }
  if (minDistanceKm <= 500) {
    return 0.3;
  }
  return 0.15;
}

function getFreshnessScore(candidate: RecommendationCandidateItem) {
  const diffMs = new Date(candidate.startAt).getTime() - Date.now();
  const daysUntilStart = diffMs / (24 * 60 * 60 * 1000);

  if (daysUntilStart <= 1) {
    return 1;
  }
  if (daysUntilStart <= 7) {
    return 0.9;
  }
  if (daysUntilStart <= 30) {
    return 0.75;
  }
  if (daysUntilStart <= 90) {
    return 0.55;
  }
  return 0.35;
}

function getPopularityBase(candidate: RecommendationCandidateItem) {
  const weighted = candidate.recentOrderCount * 0.7 + candidate.confirmedCheckinCount * 0.3;
  return Math.log1p(weighted);
}

function getOrganizerScore(stat?: OrganizerRatingStatItem) {
  if (!stat || stat.reviewCount <= 0 || typeof stat.averageRating !== "number") {
    return 0.45;
  }

  const ratingScore = clamp(stat.averageRating / 5, 0, 1);
  const confidence = clamp(Math.log1p(stat.reviewCount) / Math.log1p(40), 0, 1);
  return clamp(ratingScore * (0.6 + confidence * 0.4), 0, 1);
}

function buildReasons(input: {
  candidate: RecommendationCandidateItem;
  context: RecommendationContext;
  categoryScore: number;
  tagScore: number;
  locationScore: number;
  organizerStat?: OrganizerRatingStatItem;
  popularityScore: number;
  freshnessScore: number;
}) {
  const reasons: string[] = [];

  if (input.context.history.length > 0 && input.categoryScore >= 0.8) {
    reasons.push(`匹配你常参加的${input.candidate.category}活动`);
  }

  if (input.tagScore >= 0.4 && input.candidate.tags.length > 0) {
    const hitTags = input.candidate.tags.filter((tag) => (input.context.tagCount.get(tag) ?? 0) > 0);
    if (hitTags.length > 0) {
      reasons.push(`标签匹配：${hitTags.slice(0, 2).join(" / ")}`);
    }
  }

  if (input.locationScore >= 0.8) {
    reasons.push("地点接近你近期参加活动的区域");
  } else if (input.locationScore >= 0.5) {
    reasons.push("地点在你常参与活动的城市圈");
  }

  const organizerStat = input.organizerStat;
  if (
    organizerStat &&
    organizerStat.reviewCount >= 3 &&
    typeof organizerStat.averageRating === "number" &&
    organizerStat.averageRating >= 4
  ) {
    reasons.push(`组织者历史评分 ${organizerStat.averageRating.toFixed(1)} 分`);
  }

  if (input.popularityScore >= 0.7) {
    reasons.push("近期参与热度较高");
  }

  if (input.freshnessScore >= 0.9) {
    reasons.push("活动即将开始");
  }

  if (reasons.length === 0) {
    reasons.push("基于你的 Attendance Proof 记录综合推荐");
  }

  return reasons.slice(0, 3);
}

export async function getUserRecommendations(userWallet: string, limit = 8): Promise<RecommendationItem[]> {
  const safeLimit = Math.max(1, Math.min(limit, 20));
  const candidateLimit = Math.max(safeLimit * 4, 40);

  const [history, candidates] = await Promise.all([
    listUserAttendanceHistoryByWallet(userWallet, 150),
    listRecommendationCandidatesByWallet(userWallet, candidateLimit)
  ]);

  if (candidates.length === 0) {
    return [];
  }

  const organizerWallets = Array.from(new Set(candidates.map((item) => item.organizerWallet)));
  const organizerStats = await listOrganizerRatingStatsByWallets(organizerWallets);
  const organizerStatMap = new Map<string, OrganizerRatingStatItem>(
    organizerStats.map((item) => [item.organizerWallet, item])
  );
  const context = buildContext(history);

  const popularityBaseByEventId = new Map<number, number>();
  let maxPopularityBase = 1;
  for (const candidate of candidates) {
    const base = getPopularityBase(candidate);
    popularityBaseByEventId.set(candidate.eventId, base);
    maxPopularityBase = Math.max(maxPopularityBase, base);
  }

  const scored = candidates.map((candidate) => {
    const categoryScore = getCategoryScore(candidate, context);
    const tagScore = getTagScore(candidate, context);
    const locationScore = getLocationScore(candidate, context);
    const organizerStat = organizerStatMap.get(candidate.organizerWallet);
    const organizerScore = getOrganizerScore(organizerStat);
    const popularityScore = clamp(
      (popularityBaseByEventId.get(candidate.eventId) ?? 0) / maxPopularityBase,
      0,
      1
    );
    const freshnessScore = getFreshnessScore(candidate);

    const score =
      categoryScore * 0.28 +
      tagScore * 0.18 +
      locationScore * 0.2 +
      organizerScore * 0.16 +
      popularityScore * 0.12 +
      freshnessScore * 0.06;

    return {
      eventId: candidate.eventId,
      startAt: candidate.startAt,
      score: Math.round(clamp(score, 0, 1) * 1000) / 10,
      reasons: buildReasons({
        candidate,
        context,
        categoryScore,
        tagScore,
        locationScore,
        organizerStat,
        popularityScore,
        freshnessScore
      })
    };
  });

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    })
    .slice(0, safeLimit)
    .map(({ eventId, score, reasons }) => ({ eventId, score, reasons }));
}
