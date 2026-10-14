/**
 * Shop business-hours rules shared by the server, the shop desktop app, and customer surfaces.
 *
 * Times are stored canonically as 24-hour "HH:mm" (sortable, unambiguous) and shown to people in
 * 12-hour form ("9:30 PM"). A day is either closed, open 24 hours, or open from `opensAt` to
 * `closesAt`; a closing time earlier than the opening time means the shop closes after midnight.
 */

export const SHOP_TIME_ZONE = "Asia/Kolkata";

export type BusinessHourRule = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  isOpen24Hours: boolean;
};

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MINUTES_PER_DAY = 24 * 60;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * Accepts "21:30", "9:30 PM", "9 pm", "09:30 a.m." and returns canonical "HH:mm", or null.
 */
export function parseTimeInput(value: string): string | null {
  const text = value.trim();
  const twentyFour = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(text);
  if (twentyFour) {
    return `${pad(Number(twentyFour[1]))}:${twentyFour[2]}`;
  }

  const twelve = /^(0?[1-9]|1[0-2])(?::([0-5]\d))?\s*([ap])\.?\s*m?\.?$/i.exec(text);
  if (!twelve) {
    return null;
  }
  const hour12 = Number(twelve[1]);
  const minute = twelve[2] ?? "00";
  const isPm = twelve[3].toLowerCase() === "p";
  const hour24 = (hour12 % 12) + (isPm ? 12 : 0);
  return `${pad(hour24)}:${minute}`;
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function minutesToTime(minutes: number) {
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

/** "21:05" -> "9:05 PM", "00:00" -> "12:00 AM". */
export function formatTime12h(value: string) {
  const minutes = timeToMinutes(value);
  if (!Number.isFinite(minutes)) {
    return value;
  }
  const hour24 = Math.floor(minutes / 60);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${pad(minutes % 60)} ${hour24 < 12 ? "AM" : "PM"}`;
}

/** Closing at or before opening means the shop stays open past midnight. */
export function closesNextDay(hour: Pick<BusinessHourRule, "opensAt" | "closesAt">) {
  return timeToMinutes(hour.closesAt) < timeToMinutes(hour.opensAt);
}

/** Returns a reason the day's hours are unusable, or null when they are valid. */
export function businessHourProblem(hour: BusinessHourRule): string | null {
  if (hour.isClosed || hour.isOpen24Hours) {
    return null;
  }
  if (hour.opensAt === hour.closesAt) {
    return "opening and closing time can't be the same. Turn on Open 24 hours instead.";
  }
  return null;
}

/** "9:00 AM – 9:00 PM", "6:00 PM – 2:00 AM (next day)", "Open 24 hours", or "Closed". */
export function describeBusinessHour(hour: BusinessHourRule | undefined) {
  if (!hour || hour.isClosed) {
    return "Closed";
  }
  if (hour.isOpen24Hours) {
    return "Open 24 hours";
  }
  const range = `${formatTime12h(hour.opensAt)} – ${formatTime12h(hour.closesAt)}`;
  // Closing exactly at midnight reads naturally without the suffix.
  return closesNextDay(hour) && hour.closesAt !== "00:00" ? `${range} (next day)` : range;
}

/** The shop-local weekday (0 = Sunday) and minute of day for an instant. */
export function shopClock(instant: Date, timeZone = SHOP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return {
    dayOfWeek: SHORT_WEEKDAYS.indexOf(weekday as (typeof SHORT_WEEKDAYS)[number]),
    minuteOfDay: hour * 60 + minute,
  };
}

function dayRule(hours: BusinessHourRule[], dayOfWeek: number) {
  return hours.find((entry) => entry.dayOfWeek === ((dayOfWeek % 7) + 7) % 7);
}

function isUsable(hour: BusinessHourRule | undefined): hour is BusinessHourRule {
  return Boolean(hour) && !hour!.isClosed && businessHourProblem(hour!) === null;
}

/**
 * Where the shop is in its schedule at a shop-local day and minute: the closing time when open
 * (null while open around the clock), and nothing when closed.
 */
function openWindow(hours: BusinessHourRule[], dayOfWeek: number, minuteOfDay: number) {
  const today = dayRule(hours, dayOfWeek);
  if (isUsable(today)) {
    if (today.isOpen24Hours) {
      return { open: true as const, closesAt: null };
    }
    const opens = timeToMinutes(today.opensAt);
    const closes = timeToMinutes(today.closesAt);
    if (closesNextDay(today) ? minuteOfDay >= opens : minuteOfDay >= opens && minuteOfDay < closes) {
      return { open: true as const, closesAt: today.closesAt };
    }
  }

  // Late hours from the previous day that run past midnight.
  const yesterday = dayRule(hours, dayOfWeek - 1);
  if (isUsable(yesterday) && !yesterday.isOpen24Hours && closesNextDay(yesterday)) {
    if (minuteOfDay < timeToMinutes(yesterday.closesAt)) {
      return { open: true as const, closesAt: yesterday.closesAt };
    }
  }
  return { open: false as const, closesAt: null };
}

export function isOpenAt(hours: BusinessHourRule[], dayOfWeek: number, minuteOfDay: number) {
  return openWindow(hours, dayOfWeek, minuteOfDay).open;
}

/** "Open 24 hours", "Open until 9:00 PM", "Opens at 9:00 AM", "Opens Monday at 9:00 AM", "Closed". */
export function describeOpenStatus(hours: BusinessHourRule[], dayOfWeek: number, minuteOfDay: number) {
  const current = openWindow(hours, dayOfWeek, minuteOfDay);
  if (current.open) {
    return current.closesAt ? `Open until ${formatTime12h(current.closesAt)}` : "Open 24 hours";
  }

  const today = dayRule(hours, dayOfWeek);
  if (isUsable(today) && !today.isOpen24Hours && timeToMinutes(today.opensAt) > minuteOfDay) {
    return `Opens at ${formatTime12h(today.opensAt)}`;
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = dayRule(hours, dayOfWeek + offset);
    if (!isUsable(day)) {
      continue;
    }
    const when = offset === 1 ? "tomorrow" : WEEKDAY_NAMES[day.dayOfWeek];
    return `Opens ${when} at ${formatTime12h(day.isOpen24Hours ? "00:00" : day.opensAt)}`;
  }
  return "Closed";
}

/** Everything a customer-facing surface needs to show the shop's hours, computed in shop time. */
export function summarizeBusinessHours(
  hours: BusinessHourRule[],
  instant: Date,
  timeZone = SHOP_TIME_ZONE,
) {
  const { dayOfWeek, minuteOfDay } = shopClock(instant, timeZone);
  return {
    openNow: dayOfWeek >= 0 && isOpenAt(hours, dayOfWeek, minuteOfDay),
    openStatusLabel: dayOfWeek >= 0 ? describeOpenStatus(hours, dayOfWeek, minuteOfDay) : "Closed",
    todayHoursLabel: describeBusinessHour(dayRule(hours, dayOfWeek)),
    isOpen24x7:
      hours.length === 7 && hours.every((hour) => !hour.isClosed && hour.isOpen24Hours),
  };
}

export function weekdayName(dayOfWeek: number) {
  return WEEKDAY_NAMES[((dayOfWeek % 7) + 7) % 7];
}
