import { expect, test, type Page } from "@playwright/test";

type ViewportScenario = {
  name: string;
  width: number;
  height: number;
};

const viewports: ViewportScenario[] = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1366x768", width: 1366, height: 768 },
];

async function mockApi(page: Page): Promise<void> {
  let turn = 0;

  await page.route("**/api/client", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "demo-client",
        displayName: "Demo Client",
        theme: {},
        allowedLocations: ["pashokje"],
        landing: {
          title: "Welkom bij onze AI-assistent",
          researchNote: "Dit is een testomgeving.",
          privacyNote: "We bewaren geen persoonsgegevens.",
          startLabel: "Start assistent",
          presets: [],
        },
      }),
    });
  });

  await page.route("**/api/chat", async (route) => {
    const request = route.request();
    const payload = request.postDataJSON() as {
      current_answer?: string;
    };
    const answer = (payload.current_answer ?? "").toLowerCase();

    if (answer.includes("error")) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Simulatiefout voor UI test." }),
      });
      return;
    }

    turn += 1;
    if (turn === 1) {
      await route.fulfill({
        status: 200,
        headers: { "X-Pixie-Chat-Contract": "chat-v1.1.0" },
        contentType: "application/json",
        body: JSON.stringify({
          type: "answer",
          text: "Dank je wel, dit geeft al een duidelijk beeld naar wat je zoekt:",
          summary: "Je zoekt een jeans met rechte fit en medium wash.",
          follow_up_question: "Zou je deze assistent opnieuw gebruiken?",
          quick_replies: [
            { label: "Ja", value: "yes" },
            { label: "Nee", value: "no" },
          ],
          conversation_id: "session-1",
          state: {
            phase: "awaiting_feedback",
            feedback_status: "pending",
          },
        }),
      });
      return;
    }

    const accepted = answer.includes("yes") || answer.includes("ja");
    await route.fulfill({
      status: 200,
      headers: { "X-Pixie-Chat-Contract": "chat-v1.1.0" },
      contentType: "application/json",
      body: JSON.stringify(
        accepted
          ? {
              type: "summary",
              text: "Bedankt voor je feedback.",
              summary: "Je zoekt een jeans met rechte fit en medium wash.",
              conversation_id: "session-1",
              state: {
                phase: "completed",
                feedback_status: "yes",
              },
            }
          : {
              type: "answer",
              text: "Kun je kiezen tussen ja of nee?",
              summary: "Je zoekt een jeans met rechte fit en medium wash.",
              follow_up_question: "Zou je deze assistent opnieuw gebruiken?",
              quick_replies: [
                { label: "Ja", value: "yes" },
                { label: "Nee", value: "no" },
              ],
              conversation_id: "session-1",
              state: {
                phase: "awaiting_feedback",
                feedback_status: "pending",
              },
            },
      ),
    });
  });
}

for (const viewport of viewports) {
  test(`responsive smoke flow ${viewport.name}`, async ({ page }) => {
    await mockApi(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto("/?location=pashokje");
    await expect(page.getByText("Welkom bij onze AI-assistent")).toBeVisible();
    await expect(page).toHaveScreenshot(`landing-${viewport.name}.png`);

    await page.getByRole("button", { name: "Start assistent" }).click();
    await page.getByPlaceholder("Typ je bericht").fill("Ik zoek een jeans");
    await page.getByRole("button", { name: "Versturen" }).click();

    await expect(page.getByText("Je zoekt een jeans met rechte fit en medium wash.")).toBeVisible();
    await expect(page.getByText("Zou je deze assistent opnieuw gebruiken?")).toBeVisible();
    await expect(page.getByLabel("Snelle antwoordopties")).toBeVisible();
    await expect(page).toHaveScreenshot(`chat-feedback-${viewport.name}.png`);

    await page.getByRole("button", { name: "Ja" }).click();
    await expect(page.getByText("Bedankt voor je feedback.")).toBeVisible();
  });
}

test("invalid location state is shown on startup", async ({ page }) => {
  await mockApi(page);
  await page.goto("/?location=maan");

  await expect(page.getByText("Deze chatlink is ongeldig.")).toBeVisible();
  await expect(page.getByText("De locatieparameter in de URL is ongeldig.")).toBeVisible();
});

test("error feedback is rendered when chat request fails", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?location=pashokje");
  await page.getByRole("button", { name: "Start assistent" }).click();
  await page.getByPlaceholder("Typ je bericht").fill("error");
  await page.getByRole("button", { name: "Versturen" }).click();

  await expect(page.getByRole("alert")).toContainText("Simulatiefout voor UI test.");
});
