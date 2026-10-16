import { env } from "../env";
import type { CheckResult } from "./types";

export function youtubeId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      id = m?.[2] ?? null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** ISO 8601 duration (PT2M31S) → seconds. */
export function isoDurationSeconds(iso: string): number | null {
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, d, h, mi, s] = m;
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(mi ?? 0) * 60 + Number(s ?? 0);
}

export function judgeDuration(seconds: number, privacy: string): CheckResult {
  if (privacy === "private") {
    return {
      kind: "video",
      status: "fail",
      evidence: { durationSeconds: seconds, privacyStatus: privacy },
      fixTip: "The video is private. Set it to Unlisted or Public so judges can watch it.",
    };
  }
  if (seconds < 120 || seconds > 180) {
    return {
      kind: "video",
      status: "warn",
      evidence: { durationSeconds: seconds, privacyStatus: privacy },
      fixTip: `The video is ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}; the rule is 2–3 minutes.`,
    };
  }
  return { kind: "video", status: "pass", evidence: { durationSeconds: seconds, privacyStatus: privacy } };
}

export async function checkVideo(raw: string): Promise<CheckResult> {
  if (/drive\.google\.com|docs\.google\.com/.test(raw)) {
    return {
      kind: "video",
      status: "human_check",
      evidence: { url: raw, reason: "Google Drive video length cannot be read automatically" },
      fixTip: "A judge will check the length by hand. YouTube (unlisted) is verified instantly.",
    };
  }
  const id = youtubeId(raw);
  if (!id) {
    return {
      kind: "video",
      status: "human_check",
      evidence: { url: raw, reason: "Not a recognised YouTube URL" },
      fixTip: "Use a YouTube link (unlisted is fine) so the length can be verified automatically.",
    };
  }
  if (!env.youtubeKey) {
    return { kind: "video", status: "human_check", evidence: { videoId: id, reason: "YOUTUBE_API_KEY not configured" } };
  }
  const api = new URL("https://www.googleapis.com/youtube/v3/videos");
  api.searchParams.set("part", "contentDetails,status");
  api.searchParams.set("id", id);
  api.searchParams.set("key", env.youtubeKey);
  const res = await fetch(api, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  const data = (await res.json()) as {
    items?: { contentDetails?: { duration?: string }; status?: { privacyStatus?: string } }[];
  };
  const item = data.items?.[0];
  if (!item) {
    return {
      kind: "video",
      status: "fail",
      evidence: { videoId: id, reason: "Video not found or private" },
      fixTip: "The video is private or deleted. Set it to Unlisted or Public.",
    };
  }
  const seconds = isoDurationSeconds(item.contentDetails?.duration ?? "");
  if (seconds === null) throw new Error("Unreadable duration");
  return judgeDuration(seconds, item.status?.privacyStatus ?? "unknown");
}
