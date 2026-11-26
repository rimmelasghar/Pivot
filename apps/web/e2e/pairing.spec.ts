import { expect, test, type Browser, type Page } from "@playwright/test";

/** Open the desktop, load the sample model and return the phone pairing URL on our base URL. */
async function openDesktop(page: Page, baseURL: string): Promise<string> {
  await page.goto("/");
  await page.getByText("or try the sample model").click();
  const link = await page.getByTestId("pair-link").getAttribute("href", { timeout: 45_000 });
  expect(link).toMatch(/\/c\/[\w-]{10}\?t=/);
  // The QR points at the public tunnel URL; tests stay on the local stack.
  const url = new URL(link!);
  return new URL(url.pathname + url.search, baseURL).toString();
}

/** A phone page whose motion comes from synthetic deviceorientation events. */
async function openPhone(browser: Browser, pairUrl: string): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  await context.addInitScript(() => {
    // Force the deviceorientation path (headless Chromium has no real sensors).
    delete (window as { RelativeOrientationSensor?: unknown }).RelativeOrientationSensor;
  });
  const phone = await context.newPage();
  await phone.goto(pairUrl);
  await phone.getByTestId("connect").click();
  return phone;
}

const tilt = (phone: Page, alpha: number, beta: number, gamma: number) =>
  phone.evaluate(
    ([alpha, beta, gamma]) =>
      window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha, beta, gamma })),
    [alpha, beta, gamma],
  );

/** The rotation the desktop is steering the model towards, as [x, y, z, w]. */
const desktopTarget = (desk: Page) =>
  desk.evaluate(() => {
    const motion = (
      window as unknown as {
        __pivot: {
          motion: { getState(): { target: { toArray(): number[] }; hasTarget: boolean } };
        };
      }
    ).__pivot.motion.getState();
    return motion.hasTarget ? motion.target.toArray() : null;
  });

async function expectTarget(desk: Page, expected: number[]) {
  await expect
    .poll(async () => {
      const q = await desktopTarget(desk);
      if (!q) return Infinity;
      // q and −q are the same rotation.
      const dot = Math.abs(q.reduce((sum, v, i) => sum + v * expected[i], 0));
      return 1 - dot;
    })
    .toBeLessThan(1e-4);
}

const DEG = Math.PI / 180;
const rotY = (deg: number) => [0, Math.sin((deg * DEG) / 2), 0, Math.cos((deg * DEG) / 2)];
const rotX = (deg: number) => [Math.sin((deg * DEG) / 2), 0, 0, Math.cos((deg * DEG) / 2)];
const IDENTITY = [0, 0, 0, 1];

test("pair a phone and rotate the model", async ({ page: desk, browser, baseURL }) => {
  const pairUrl = await openDesktop(desk, baseURL!);
  const phone = await openPhone(browser, pairUrl);

  await expect(phone.getByTestId("status-pill")).toContainText("Connected");
  await expect(desk.getByTestId("phone-connected")).toBeVisible();
  await expect(phone.getByTestId("model-name")).toHaveText("pivot-block.glb");
  await tilt(phone, 0, 0, 0);

  // First reading calibrates: the model stays put.
  await expectTarget(desk, IDENTITY);

  // Turning the phone 30° left turns the model 30° around the vertical axis.
  await tilt(phone, 30, 0, 0);
  await expectTarget(desk, rotY(30));

  // Recenter: the current pose becomes neutral.
  await phone.getByTestId("recenter").click();
  await expectTarget(desk, IDENTITY);

  // Tilt only: turning 80° left while tilting the top up 20° only tilts the model.
  await phone.getByTestId("tilt-only").check();
  await tilt(phone, 110, 20, 0);
  await expectTarget(desk, rotX(20));
});

test("a second phone is rejected while the first is connected", async ({
  page: desk,
  browser,
  baseURL,
}) => {
  const pairUrl = await openDesktop(desk, baseURL!);
  const first = await openPhone(browser, pairUrl);
  await expect(first.getByTestId("status-pill")).toContainText("Connected");

  const second = await openPhone(browser, pairUrl);
  await expect(second.getByTestId("error-screen")).toContainText("Already paired");
  await expect(first.getByTestId("status-pill")).toContainText("Connected");
});

test("an unknown session shows an error on the phone", async ({ browser, baseURL }) => {
  const phone = await openPhone(browser, new URL("/c/nosuchsess?t=x", baseURL).toString());
  await expect(phone.getByTestId("error-screen")).toContainText("Session expired");
});
