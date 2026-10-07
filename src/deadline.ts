/**
 * Natural Language Deadline Parser for CEO Me
 * Handles:
 * - relative intervals: "in 30 minutes", "in 2 hours", "give me 45 minutes", "give me 3 minutes"
 * - clock times: "8pm", "8:00 PM", "tonight at 9", "9 tonight", "remind me at 7", "by 8 tonight"
 * - weekdays: "Friday at 5", "Friday at 5pm", "next Friday at 5", "Monday at 10am"
 * - relative periods with smart rollover: "tomorrow morning", "tomorrow at 9", "by midnight", "before lunch", "after lunch", "before dinner"
 * - timezone support (e.g. Africa/Lagos)
 */

export interface DeadlineParseResult {
  success: boolean;
  iso?: string;
  ambiguous?: boolean;
  clarificationPrompt?: string;
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
 * Get current year, month, day, hour, min, dayOfWeek in specified timezone
 */
function getPartsInTz(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
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
  const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() || "";

  return {
    year: find("year"),
    month: find("month"), // 1-indexed
    day: find("day"),
    weekday,
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
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const tzParts = getPartsInTz(guess, timeZone);
  const diffMs =
    Date.UTC(tzParts.year, tzParts.month - 1, tzParts.day, tzParts.hour, tzParts.minute, tzParts.second) -
    guess.getTime();

  const finalDate = new Date(guess.getTime() - diffMs);
  return finalDate.toISOString();
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Main natural deadline parser
 */
export function parseNaturalDeadline(
  rawInput: string,
  now = new Date(),
  timeZone = process.env.USER_TIMEZONE || "Africa/Lagos"
): DeadlineParseResult {
  const input = rawInput.trim().toLowerCase();

  // 1. Genuine ambiguity check
  if (
    /^(later|sometime|tomorrow sometime|sometime tomorrow|next week|eventually|soon)$/.test(input) ||
    /^(sometime later|not sure)$/.test(input)
  ) {
    return {
      success: false,
      ambiguous: true,
      clarificationPrompt: "What time should I use?"
    };
  }

  // 2. Relative minute intervals: "in 30 minutes", "give me 3 minutes", "3 mins"
  const relMinutesMatch = input.match(
    /(?:in|give me|within|another)?\s*(\d+)\s*(?:minutes|minute|mins|min)\b/
  );
  if (relMinutesMatch) {
    const minutes = parseInt(relMinutesMatch[1], 10);
    const target = new Date(now.getTime() + minutes * 60 * 1000);
    return { success: true, iso: target.toISOString() };
  }

  // Relative hour intervals: "in 2 hours", "give me another hour", "in one hour"
  const relHoursMatch = input.match(
    /(?:in|give me|within|another)?\s*(\d+|one|two|three|four)\s*(?:hours|hour|hrs|hr)\b/
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

  // Single "another hour" or "an hour"
  if (/\b(?:another|an)\s+hour\b/.test(input)) {
    const target = new Date(now.getTime() + 60 * 60 * 1000);
    return { success: true, iso: target.toISOString() };
  }

  // 3. ISO format check
  if (input.includes("t") && (input.includes("z") || input.includes("+") || input.includes("-"))) {
    const parsed = new Date(rawInput.trim());
    if (!isNaN(parsed.getTime())) {
      return { success: true, iso: parsed.toISOString() };
    }
  }

  const currentTz = getPartsInTz(now, timeZone);

  // 4. Relative meal/event periods with smart rollover if already passed today:
  // "before lunch" (12:30), "after lunch" (14:00), "before dinner" (19:00), "by midnight" (23:59)
  if (input.includes("before lunch")) {
    const targetHour = 12;
    const targetMin = 30;
    const isPast = currentTz.hour > targetHour || (currentTz.hour === targetHour && currentTz.minute >= targetMin);
    const targetDate = isPast ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : now;
    const targetTz = getPartsInTz(targetDate, timeZone);
    return {
      success: true,
      iso: makeUtcIsoFromTz(targetTz.year, targetTz.month, targetTz.day, targetHour, targetMin, timeZone)
    };
  }

  if (input.includes("after lunch")) {
    const targetHour = 14;
    const targetMin = 0;
    const isPast = currentTz.hour > targetHour || (currentTz.hour === targetHour && currentTz.minute >= targetMin);
    const targetDate = isPast ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : now;
    const targetTz = getPartsInTz(targetDate, timeZone);
    return {
      success: true,
      iso: makeUtcIsoFromTz(targetTz.year, targetTz.month, targetTz.day, targetHour, targetMin, timeZone)
    };
  }

  if (input.includes("before dinner")) {
    const targetHour = 19;
    const targetMin = 0;
    const isPast = currentTz.hour > targetHour || (currentTz.hour === targetHour && currentTz.minute >= targetMin);
    const targetDate = isPast ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : now;
    const targetTz = getPartsInTz(targetDate, timeZone);
    return {
      success: true,
      iso: makeUtcIsoFromTz(targetTz.year, targetTz.month, targetTz.day, targetHour, targetMin, timeZone)
    };
  }

  if (input.includes("midnight") || input.includes("by midnight")) {
    const isTomorrowMidnight = input.includes("tomorrow");
    const isPast = currentTz.hour >= 23 && currentTz.minute >= 59;
    const dayOffset = isTomorrowMidnight || isPast ? 1 : 0;
    const targetDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const targetTz = getPartsInTz(targetDate, timeZone);
    return {
      success: true,
      iso: makeUtcIsoFromTz(targetTz.year, targetTz.month, targetTz.day, 23, 59, timeZone)
    };
  }

  if (input.includes("tomorrow morning")) {
    const targetDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const targetTz = getPartsInTz(targetDate, timeZone);
    return {
      success: true,
      iso: makeUtcIsoFromTz(targetTz.year, targetTz.month, targetTz.day, 9, 0, timeZone)
    };
  }

  // 5. Weekdays: "Friday at 5", "Friday at 5pm", "next Friday at 5", "Monday at 9am"
  let targetWeekdayIndex = -1;
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(input)) {
      targetWeekdayIndex = i;
      break;
    }
  }

  // 6. Clock time parsing: "at 5", "5pm", "8:00 PM", "9 tonight", "tomorrow at 9"
  const isTomorrow = input.includes("tomorrow");
  const isTonight = input.includes("tonight");

  const clockRegex = /(?:at|by|until)?\s*(\b\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/;
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
      if (isTonight) {
        if (hour < 12) hour += 12;
      } else if (hour >= 1 && hour <= 6) {
        // Assume afternoon/evening (e.g. "Friday at 5" -> 17:00)
        hour += 12;
      } else if (hour >= 7 && hour <= 11) {
        if (currentTz.hour >= hour) {
          hour += 12;
        }
      }
    }

    // Determine target day
    if (targetWeekdayIndex !== -1) {
      const currentDayOfWeek = WEEKDAYS.indexOf(currentTz.weekday);
      let daysAhead = (targetWeekdayIndex - currentDayOfWeek + 7) % 7;

      const isNext = input.includes("next");
      // If same day of week, check if time has already passed or if "next" was specified
      if (daysAhead === 0) {
        const alreadyPassed = hour < currentTz.hour || (hour === currentTz.hour && minute <= currentTz.minute);
        if (alreadyPassed || isNext) {
          daysAhead = 7;
        }
      } else if (isNext && daysAhead < 7) {
        daysAhead += 7;
      }

      const targetDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
      const targetTz = getPartsInTz(targetDate, timeZone);
      const iso = makeUtcIsoFromTz(targetTz.year, targetTz.month, targetTz.day, hour, minute, timeZone);
      return { success: true, iso };
    }

    let targetDate = now;
    if (isTomorrow) {
      targetDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else {
      // If time has already passed today and not explicitly tonight, roll over to tomorrow
      const alreadyPassed = hour < currentTz.hour || (hour === currentTz.hour && minute <= currentTz.minute);
      if (alreadyPassed && !isTonight) {
        targetDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    const targetTz = getPartsInTz(targetDate, timeZone);
    const iso = makeUtcIsoFromTz(targetTz.year, targetTz.month, targetTz.day, hour, minute, timeZone);
    return { success: true, iso };
  }

  // Weekday specified with no time (e.g. "on Friday")
  if (targetWeekdayIndex !== -1) {
    const currentDayOfWeek = WEEKDAYS.indexOf(currentTz.weekday);
    let daysAhead = (targetWeekdayIndex - currentDayOfWeek + 7) % 7;
    if (daysAhead === 0) daysAhead = 7;
    const targetDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const targetTz = getPartsInTz(targetDate, timeZone);
    // Default 5:00 PM
    const iso = makeUtcIsoFromTz(targetTz.year, targetTz.month, targetTz.day, 17, 0, timeZone);
    return { success: true, iso };
  }

  return {
    success: false,
    ambiguous: true,
    clarificationPrompt: "What time should I use?"
  };
}
