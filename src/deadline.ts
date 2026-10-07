/**
 * Natural Language Deadline Parser for CEO Me
 * Handles:
 * - relative intervals: "in 30 minutes", "in 2 hours", "give me 45 minutes", "give me 3 minutes"
 * - clock times: "8pm", "8:00 PM", "tonight at 9", "9 tonight", "remind me at 7", "by 8 tonight"
 * - relative periods: "tomorrow morning", "tomorrow at 9", "Friday at 5", "by midnight", "before lunch"
 * - timezone support (e.g. Africa/Lagos)
 */

export interface DeadlineParseResult {
  success: boolean;
  iso?: string;
  ambiguous?: boolean;
  clarificationPrompt?: string;
}

interface TimeParts {
  hours: number;
  minutes: number;
}

/**
 * Returns user-facing local time string formatted in target timezone
 */
export function formatDeadline(isoUtc: string, timeZone = "Africa/Lagos"): string {
  try {
    const date = new Date(isoUtc);
    return date.toLocaleTimeString("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return isoUtc;
  }
}

/**
 * Format date + time for display
 */
export function formatDeadlineFull(isoUtc: string, timeZone = "Africa/Lagos"): string {
  try {
    const date = new Date(isoUtc);
    const timeStr = date.toLocaleTimeString("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
    const dateStr = date.toLocaleDateString("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric"
    });
    return `${timeStr} (${dateStr})`;
  } catch {
    return isoUtc;
  }
}

/**
 * Get current year, month, day, hour, min in specified timezone
 */
function getPartsInTz(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const find = (type: string) => {
    const val = parts.find((p) => p.type === type)?.value;
    return val ? parseInt(val, 10) : 0;
  };

  return {
    year: find("year"),
    month: find("month"), // 1-indexed
    day: find("day"),
    hour: find("hour"),
    minute: find("minute"),
    second: find("second")
  };
}

/**
 * Convert local time in a timezone to UTC ISO string
 */
function makeUtcIsoFromTz(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): string {
  // We can calculate offset by comparing UTC representation
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const tzParts = getPartsInTz(guess, timeZone);
  const diffMs =
    Date.UTC(tzParts.year, tzParts.month - 1, tzParts.day, tzParts.hour, tzParts.minute, tzParts.second) -
    guess.getTime();

  const finalDate = new Date(guess.getTime() - diffMs);
  return finalDate.toISOString();
}

/**
 * Main parser
 */
export function parseNaturalDeadline(
  rawInput: string,
  now = new Date(),
  timeZone = process.env.USER_TIMEZONE || "Africa/Lagos"
): DeadlineParseResult {
  const input = rawInput.trim().toLowerCase();

  // 1. Check for genuine ambiguity first
  if (
    /^(later|sometime|tomorrow sometime|sometime tomorrow|next week|eventually|soon)$/.test(
      input
    ) ||
    /^(sometime later|not sure)$/.test(input)
  ) {
    return {
      success: false,
      ambiguous: true,
      clarificationPrompt: "What time should I use?"
    };
  }

  // 2. Relative minute / hour intervals:
  // e.g., "in 30 minutes", "in 30 mins", "give me 30 minutes", "give me 3 mins", "in two hours", "in 1 hour"
  const relMinutesMatch = input.match(
    /(?:in|give me|within)?\s*(\d+)\s*(?:minutes|minute|mins|min)\b/
  );
  if (relMinutesMatch) {
    const minutes = parseInt(relMinutesMatch[1], 10);
    const target = new Date(now.getTime() + minutes * 60 * 1000);
    return { success: true, iso: target.toISOString() };
  }

  const relHoursMatch = input.match(
    /(?:in|give me|within)?\s*(\d+|one|two|three|four)\s*(?:hours|hour|hrs|hr)\b/
  );
  if (relHoursMatch) {
    let hours = parseInt(relHoursMatch[1], 10);
    if (isNaN(hours)) {
      const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };
      hours = words[relHoursMatch[1]] || 1;
    }
    const target = new Date(now.getTime() + hours * 60 * 60 * 1000);
    return { success: true, iso: target.toISOString() };
  }

  // 3. ISO format check (e.g. 2026-10-06T21:00:00+01:00)
  if (input.includes("t") && (input.includes("z") || input.includes("+") || input.includes("-"))) {
    const parsed = new Date(rawInput.trim());
    if (!isNaN(parsed.getTime())) {
      return { success: true, iso: parsed.toISOString() };
    }
  }

  const currentTz = getPartsInTz(now, timeZone);

  // 4. Midnight
  if (input.includes("midnight") || input.includes("by midnight")) {
    const isTomorrowMidnight = input.includes("tomorrow");
    let targetDay = currentTz.day;
    let targetMonth = currentTz.month;
    let targetYear = currentTz.year;

    if (isTomorrowMidnight || currentTz.hour >= 23) {
      targetDay += 1;
    }
    return {
      success: true,
      iso: makeUtcIsoFromTz(targetYear, targetMonth, targetDay, 23, 59, timeZone)
    };
  }

  // 5. Before lunch / after lunch / before dinner
  if (input.includes("before lunch")) {
    // 12:30 PM
    return {
      success: true,
      iso: makeUtcIsoFromTz(currentTz.year, currentTz.month, currentTz.day, 12, 30, timeZone)
    };
  }

  if (input.includes("after lunch")) {
    // 2:00 PM
    return {
      success: true,
      iso: makeUtcIsoFromTz(currentTz.year, currentTz.month, currentTz.day, 14, 0, timeZone)
    };
  }

  if (input.includes("before dinner")) {
    // 7:00 PM
    return {
      success: true,
      iso: makeUtcIsoFromTz(currentTz.year, currentTz.month, currentTz.day, 19, 0, timeZone)
    };
  }

  // 6. "tomorrow morning"
  if (input.includes("tomorrow morning")) {
    const targetDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowTz = getPartsInTz(targetDate, timeZone);
    return {
      success: true,
      iso: makeUtcIsoFromTz(tomorrowTz.year, tomorrowTz.month, tomorrowTz.day, 9, 0, timeZone)
    };
  }

  // 7. Parse clock times:
  // e.g.: "8pm", "8:00 PM", "tonight at 9", "9 tonight", "remind me at 7", "by 8 tonight", "at 9"
  // "tomorrow at 9", "tomorrow 9am", "friday at 5"
  const isTomorrow = input.includes("tomorrow");
  const isTonight = input.includes("tonight");

  // Regex to detect hour and optional minutes and am/pm
  const clockRegex =
    /(?:at|by|until)?\s*(\b\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/;
  const match = input.match(clockRegex);

  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3];

    if (ampm === "pm" && hour < 12) {
      hour += 12;
    } else if (ampm === "am" && hour === 12) {
      hour = 0;
    } else if (!ampm) {
      // No am/pm specified
      if (isTonight) {
        if (hour < 12) hour += 12;
      } else if (hour >= 1 && hour <= 6) {
        // Business hours / typical afternoon assumption (e.g. 5 -> 17:00)
        hour += 12;
      } else if (hour >= 7 && hour <= 11) {
        // If current hour is past this in morning, assume evening
        if (currentTz.hour >= hour) {
          hour += 12;
        }
      }
    }

    let targetYear = currentTz.year;
    let targetMonth = currentTz.month;
    let targetDay = currentTz.day;

    if (isTomorrow) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowTz = getPartsInTz(tomorrow, timeZone);
      targetYear = tomorrowTz.year;
      targetMonth = tomorrowTz.month;
      targetDay = tomorrowTz.day;
    } else {
      // If time has already passed today and wasn't marked tomorrow, maybe tomorrow?
      if (!isTonight && (hour < currentTz.hour || (hour === currentTz.hour && minute <= currentTz.minute))) {
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowTz = getPartsInTz(tomorrow, timeZone);
        targetYear = tomorrowTz.year;
        targetMonth = tomorrowTz.month;
        targetDay = tomorrowTz.day;
      }
    }

    const iso = makeUtcIsoFromTz(targetYear, targetMonth, targetDay, hour, minute, timeZone);
    return { success: true, iso };
  }

  return {
    success: false,
    ambiguous: true,
    clarificationPrompt: "What time should I use?"
  };
}
