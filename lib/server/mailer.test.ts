jest.mock("nodemailer");

/**
 * mailer.ts caches its transporter in a module-level variable, so each test
 * needs a fresh module instance - otherwise a transporter created by an
 * earlier test would leak into a later one and hide bugs in the "throws
 * when unconfigured" / per-call config paths.
 *
 * jest.resetModules() clears the require cache, but a `nodemailer` reference
 * captured at the top of this file (before any reset) would then be a
 * *different* mock instance from the one the freshly re-required `./mailer`
 * uses internally - so both `nodemailer` and `./mailer` are re-required
 * together, from the same post-reset registry generation, via plain
 * require() (not a dynamic import()) so there's no additional ESM/CJS
 * interop ambiguity about which object is "the" mock.
 */
function freshMailer() {
  jest.resetModules();
  const freshNodemailer = require("nodemailer") as jest.Mocked<typeof import("nodemailer")>;
  const mailerModule = require("./mailer") as typeof import("./mailer");
  return { sendMail: mailerModule.sendMail, nodemailer: freshNodemailer };
}

describe("mailer", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_FROM;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("throws if SMTP_HOST, SMTP_USER, or SMTP_PASSWORD is not configured", async () => {
    const { sendMail, nodemailer } = freshMailer();
    await expect(sendMail({ to: "a@b.com", subject: "s", html: "<p>h</p>" })).rejects.toThrow(
      "SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be set to send email"
    );
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it("throws if only SMTP_HOST is set", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    const { sendMail } = freshMailer();
    await expect(sendMail({ to: "a@b.com", subject: "s", html: "<p>h</p>" })).rejects.toThrow(
      /SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be set/
    );
  });

  it("uses STARTTLS (secure:false) on the default port 587 when SMTP_PORT is unset", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASSWORD = "secret";
    const { sendMail, nodemailer } = freshMailer();
    const sendMailMock = jest.fn().mockResolvedValue(undefined);
    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock } as any);

    await sendMail({ to: "recipient@example.com", subject: "Hi", html: "<p>hi</p>" });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: { user: "user@example.com", pass: "secret" },
    });
    expect(sendMailMock).toHaveBeenCalledWith({
      from: "user@example.com",
      to: "recipient@example.com",
      subject: "Hi",
      html: "<p>hi</p>",
    });
  });

  it("uses implicit TLS (secure:true) on port 465", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASSWORD = "secret";
    const { sendMail, nodemailer } = freshMailer();
    nodemailer.createTransport.mockReturnValue({
      sendMail: jest.fn().mockResolvedValue(undefined),
    } as any);

    await sendMail({ to: "r@example.com", subject: "s", html: "h" });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true })
    );
  });

  it("uses STARTTLS (secure:false) on a non-465 explicit port", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "25";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASSWORD = "secret";
    const { sendMail, nodemailer } = freshMailer();
    nodemailer.createTransport.mockReturnValue({
      sendMail: jest.fn().mockResolvedValue(undefined),
    } as any);

    await sendMail({ to: "r@example.com", subject: "s", html: "h" });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 25, secure: false })
    );
  });

  it("prefers SMTP_FROM over SMTP_USER for the From header when both are set", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASSWORD = "secret";
    process.env.SMTP_FROM = "Voyagr <noreply@voyagr.app>";
    const { sendMail, nodemailer } = freshMailer();
    const sendMailMock = jest.fn().mockResolvedValue(undefined);
    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock } as any);

    await sendMail({ to: "r@example.com", subject: "s", html: "h" });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Voyagr <noreply@voyagr.app>" })
    );
  });

  it("falls back to SMTP_USER for the From header when SMTP_FROM is unset", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASSWORD = "secret";
    const { sendMail, nodemailer } = freshMailer();
    const sendMailMock = jest.fn().mockResolvedValue(undefined);
    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock } as any);

    await sendMail({ to: "r@example.com", subject: "s", html: "h" });

    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ from: "user@example.com" }));
  });

  it("reuses a single cached transport across multiple sendMail calls", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASSWORD = "secret";
    const { sendMail, nodemailer } = freshMailer();
    nodemailer.createTransport.mockReturnValue({
      sendMail: jest.fn().mockResolvedValue(undefined),
    } as any);

    await sendMail({ to: "a@example.com", subject: "s1", html: "h1" });
    await sendMail({ to: "b@example.com", subject: "s2", html: "h2" });

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
  });

  it("propagates a transport-level send failure to the caller", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASSWORD = "secret";
    const { sendMail, nodemailer } = freshMailer();
    nodemailer.createTransport.mockReturnValue({
      sendMail: jest.fn().mockRejectedValue(new Error("SMTP down")),
    } as any);

    await expect(sendMail({ to: "r@example.com", subject: "s", html: "h" })).rejects.toThrow(
      "SMTP down"
    );
  });
});
