// pure utility functions for testing

export type WindowOpenAction = { action: "allow" } | { action: "deny" };

// checks if a URL should be allowed to open within the app
export function shouldAllowUrl(url: string): WindowOpenAction {
  // allow about:blank (often used for popups)
  if (url === "about:blank") return { action: "allow" };

  try {
    const u = new URL(url);
    const protocol = u.protocol;

    // allow blob: and data: URLs (used for video playback, media, etc)
    if (protocol === "blob:" || protocol === "data:") {
      return { action: "allow" };
    }

    const hostname = u.hostname.toLowerCase();

    // allow all subdomains of messenger.com and facebook.com
    if (
      (protocol === "http:" || protocol === "https:") &&
      (hostname === "messenger.com" ||
        hostname.endsWith(".messenger.com") ||
        hostname === "facebook.com" ||
        hostname.endsWith(".facebook.com"))
    ) {
      return { action: "allow" };
    }
  } catch {
    // invalid URL, fall through to deny
  }

  return { action: "deny" };
}

// parses graphql request body to extract friendly name and doc id
export function parseGraphqlBody(body: string) {
  const result = {
    friendlyName: "",
    docId: "",
    variablesText: "",
    rawText: body || "",
  };

  if (!body || typeof body !== "string") return result;

  // try URL-encoded format first
  const params = new URLSearchParams(body);
  const friendlyFromParams = params.get("fb_api_req_friendly_name");
  const docIdFromParams = params.get("doc_id");

  if (friendlyFromParams || docIdFromParams) {
    result.friendlyName = friendlyFromParams || "";
    result.docId = docIdFromParams || "";
    result.variablesText = params.get("variables") || "";
    return result;
  }

  // try JSON format
  try {
    const json = JSON.parse(body);
    result.friendlyName = json.fb_api_req_friendly_name || "";
    result.docId = json.doc_id || "";
    result.variablesText =
      typeof json.variables === "string"
        ? json.variables
        : JSON.stringify(json.variables || "");
  } catch {
    // neither URL-encoded nor JSON
  }

  return result;
}

// checks if a hostname is a trusted messenger/facebook origin
export function isTrustedOrigin(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "messenger.com" ||
    h.endsWith(".messenger.com") ||
    h === "facebook.com" ||
    h.endsWith(".facebook.com")
  );
}

// formats unread count for display (e.g., "99+" for large numbers)
export function formatUnreadCount(count: number): string {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  return String(count);
}

// checks if current time is within quiet hours
export function isWithinQuietHours(
  start: string,
  end: string,
  now: Date = new Date()
): boolean {
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // handle overnight ranges (e.g., 22:00 - 07:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}
