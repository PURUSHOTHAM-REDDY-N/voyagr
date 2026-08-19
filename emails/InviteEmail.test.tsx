/**
 * Rendered directly via react-dom/server rather than @react-email/render -
 * the latter's Node implementation uses a dynamic import() this project's
 * Jest transform can't execute (see lib/server/expenseNotifications.test.ts
 * for the same finding). react-dom/server is what @react-email/render calls
 * into under the hood, so this still exercises the component's real output,
 * just without the extra pretty-printing/doctype layer on top.
 */
import { renderToStaticMarkup } from "react-dom/server";
import InviteEmail from "./InviteEmail";

describe("InviteEmail", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.HOSTING_URL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("includes the project name in the preview text and invitation message", () => {
    const html = renderToStaticMarkup(
      InviteEmail({ inviteLink: "https://voyagr.app/join/abc", projectName: "Lisbon Trip" })
    );
    expect(html).toContain("You&#x27;ve been invited to join Lisbon Trip on Voyagr!");
    expect(html).toContain("Lisbon Trip");
  });

  it("points the join button at the supplied invite link", () => {
    const html = renderToStaticMarkup(
      InviteEmail({ inviteLink: "https://voyagr.app/join/xyz123", projectName: "Rome Trip" })
    );
    expect(html).toContain('href="https://voyagr.app/join/xyz123"');
  });

  it("falls back to the default hosting URL for the 'Get Started' link when HOSTING_URL is unset", () => {
    const html = renderToStaticMarkup(
      InviteEmail({ inviteLink: "https://voyagr.app/join/abc", projectName: "Lisbon Trip" })
    );
    expect(html).toContain('href="https://travelplannerai.site"');
  });

  it("uses the configured HOSTING_URL for the 'Get Started' link when set", () => {
    process.env.HOSTING_URL = "https://staging.voyagr.app";
    const html = renderToStaticMarkup(
      InviteEmail({ inviteLink: "https://voyagr.app/join/abc", projectName: "Lisbon Trip" })
    );
    expect(html).toContain('href="https://staging.voyagr.app"');
  });

  it("renders distinct output for different projects/links (not a cached/static template)", () => {
    const first = renderToStaticMarkup(
      InviteEmail({ inviteLink: "https://voyagr.app/join/aaa", projectName: "Tokyo Trip" })
    );
    const second = renderToStaticMarkup(
      InviteEmail({ inviteLink: "https://voyagr.app/join/bbb", projectName: "Cairo Trip" })
    );
    expect(first).not.toEqual(second);
    expect(first).toContain("Tokyo Trip");
    expect(second).toContain("Cairo Trip");
  });
});
