import { describe, it, expect } from "vitest";
import {
  shouldAllowUrl,
  parseGraphqlBody,
  isTrustedOrigin,
  formatUnreadCount,
  isWithinQuietHours,
} from "./utils";

describe("shouldAllowUrl", () => {
  it("allows about:blank", () => {
    expect(shouldAllowUrl("about:blank")).toEqual({ action: "allow" });
  });

  it("allows blob: URLs", () => {
    expect(
      shouldAllowUrl("blob:https://www.messenger.com/abc123")
    ).toEqual({ action: "allow" });
  });

  it("allows data: URLs", () => {
    expect(
      shouldAllowUrl("data:text/html,<h1>Hello</h1>")
    ).toEqual({ action: "allow" });
  });

  it("allows messenger.com", () => {
    expect(shouldAllowUrl("https://messenger.com")).toEqual({ action: "allow" });
    expect(shouldAllowUrl("https://www.messenger.com")).toEqual({ action: "allow" });
    expect(shouldAllowUrl("https://www.messenger.com/t/123")).toEqual({ action: "allow" });
  });

  it("allows facebook.com", () => {
    expect(shouldAllowUrl("https://facebook.com")).toEqual({ action: "allow" });
    expect(shouldAllowUrl("https://www.facebook.com")).toEqual({ action: "allow" });
    expect(shouldAllowUrl("https://l.facebook.com/redirect")).toEqual({ action: "allow" });
  });

  it("allows subdomains of messenger.com and facebook.com", () => {
    expect(shouldAllowUrl("https://static.messenger.com/assets/image.png")).toEqual({ action: "allow" });
    expect(shouldAllowUrl("https://video.facebook.com/watch")).toEqual({ action: "allow" });
  });

  it("denies external URLs", () => {
    expect(shouldAllowUrl("https://google.com")).toEqual({ action: "deny" });
    expect(shouldAllowUrl("https://example.com")).toEqual({ action: "deny" });
    expect(shouldAllowUrl("https://malicious-messenger.com")).toEqual({ action: "deny" });
  });

  it("denies invalid URLs", () => {
    expect(shouldAllowUrl("not-a-url")).toEqual({ action: "deny" });
    expect(shouldAllowUrl("")).toEqual({ action: "deny" });
  });

  it("handles http protocol", () => {
    expect(shouldAllowUrl("http://messenger.com")).toEqual({ action: "allow" });
    expect(shouldAllowUrl("http://google.com")).toEqual({ action: "deny" });
  });
});

describe("parseGraphqlBody", () => {
  it("parses URL-encoded body", () => {
    const body = "fb_api_req_friendly_name=TestQuery&doc_id=12345&variables=%7B%22id%22%3A1%7D";
    const result = parseGraphqlBody(body);
    expect(result.friendlyName).toBe("TestQuery");
    expect(result.docId).toBe("12345");
    expect(result.variablesText).toBe('{"id":1}');
  });

  it("parses JSON body", () => {
    const body = JSON.stringify({
      fb_api_req_friendly_name: "TestMutation",
      doc_id: "67890",
      variables: { user: "test" },
    });
    const result = parseGraphqlBody(body);
    expect(result.friendlyName).toBe("TestMutation");
    expect(result.docId).toBe("67890");
    expect(result.variablesText).toBe('{"user":"test"}');
  });

  it("handles empty body", () => {
    expect(parseGraphqlBody("")).toEqual({
      friendlyName: "",
      docId: "",
      variablesText: "",
      rawText: "",
    });
  });

  it("handles invalid body", () => {
    const result = parseGraphqlBody("not valid anything");
    expect(result.friendlyName).toBe("");
    expect(result.docId).toBe("");
  });
});

describe("isTrustedOrigin", () => {
  it("trusts messenger.com", () => {
    expect(isTrustedOrigin("messenger.com")).toBe(true);
    expect(isTrustedOrigin("www.messenger.com")).toBe(true);
    expect(isTrustedOrigin("static.messenger.com")).toBe(true);
  });

  it("trusts facebook.com", () => {
    expect(isTrustedOrigin("facebook.com")).toBe(true);
    expect(isTrustedOrigin("www.facebook.com")).toBe(true);
    expect(isTrustedOrigin("l.facebook.com")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isTrustedOrigin("MESSENGER.COM")).toBe(true);
    expect(isTrustedOrigin("Facebook.Com")).toBe(true);
  });

  it("rejects untrusted origins", () => {
    expect(isTrustedOrigin("google.com")).toBe(false);
    expect(isTrustedOrigin("fakemessenger.com")).toBe(false);
    expect(isTrustedOrigin("messenger.com.evil.com")).toBe(false);
  });
});

describe("formatUnreadCount", () => {
  it("returns empty string for zero or negative", () => {
    expect(formatUnreadCount(0)).toBe("");
    expect(formatUnreadCount(-1)).toBe("");
  });

  it("returns count as string for normal values", () => {
    expect(formatUnreadCount(1)).toBe("1");
    expect(formatUnreadCount(50)).toBe("50");
    expect(formatUnreadCount(99)).toBe("99");
  });

  it("returns 99+ for counts over 99", () => {
    expect(formatUnreadCount(100)).toBe("99+");
    expect(formatUnreadCount(999)).toBe("99+");
  });
});

describe("isWithinQuietHours", () => {
  it("detects time within same-day range", () => {
    // range: 09:00 - 17:00
    const at10am = new Date("2024-01-01T10:00:00");
    const at8am = new Date("2024-01-01T08:00:00");
    const at6pm = new Date("2024-01-01T18:00:00");

    expect(isWithinQuietHours("09:00", "17:00", at10am)).toBe(true);
    expect(isWithinQuietHours("09:00", "17:00", at8am)).toBe(false);
    expect(isWithinQuietHours("09:00", "17:00", at6pm)).toBe(false);
  });

  it("handles overnight range (e.g., 22:00 - 07:00)", () => {
    const at11pm = new Date("2024-01-01T23:00:00");
    const at3am = new Date("2024-01-01T03:00:00");
    const at10am = new Date("2024-01-01T10:00:00");
    const at8pm = new Date("2024-01-01T20:00:00");

    expect(isWithinQuietHours("22:00", "07:00", at11pm)).toBe(true);
    expect(isWithinQuietHours("22:00", "07:00", at3am)).toBe(true);
    expect(isWithinQuietHours("22:00", "07:00", at10am)).toBe(false);
    expect(isWithinQuietHours("22:00", "07:00", at8pm)).toBe(false);
  });

  it("handles edge cases at boundaries", () => {
    const atStart = new Date("2024-01-01T09:00:00");
    const atEnd = new Date("2024-01-01T17:00:00");

    expect(isWithinQuietHours("09:00", "17:00", atStart)).toBe(true);
    expect(isWithinQuietHours("09:00", "17:00", atEnd)).toBe(false);
  });
});
