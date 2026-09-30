import { test, expect } from '@playwright/test';

const FIXTURE_URL = '/e2e/fixtures/login-screen/index.html';

test.describe('Evasive Button Plugin (v-evade) - Login Screen E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(FIXTURE_URL);
        await expect(page.getByTestId('login-card')).toBeVisible();
    });

    test('renders login screen with evasive button active initially when fields are empty', async ({ page }) => {
        const button = page.getByTestId('login-button');
        const evadeStatus = page.getByTestId('evade-status');
        const count = page.getByTestId('evade-count');

        await expect(button).toBeVisible();
        await expect(button).toHaveText('Sign In');
        await expect(evadeStatus).toHaveText('Evading ⚡');
        await expect(count).toHaveText('0');
        await expect(button).toHaveClass(/is-settled/);
    });

    test('button moves away when cursor approaches incomplete form', async ({ page }) => {
        const button = page.getByTestId('login-button');
        const before = await button.boundingBox();
        expect(before).not.toBeNull();

        // Move mouse near the button (approaching from the left edge)
        await page.mouse.move(before.x - 30, before.y + before.height / 2);

        // Move closer into trigger proximity
        await page.mouse.move(before.x - 5, before.y + before.height / 2, { steps: 5 });

        // Wait for evasion event update
        await expect(page.getByTestId('evade-count')).not.toHaveText('0');

        const after = await button.boundingBox();
        expect(after).not.toBeNull();

        // The button must have moved in position
        const movedX = Math.abs(after.x - before.x);
        const movedY = Math.abs(after.y - before.y);
        expect(movedX + movedY).toBeGreaterThan(15);

        // State class becomes is-evading
        await expect(button).toHaveClass(/is-evading/);
    });

    test('intercepts mouse click and prevents form submission when form is incomplete', async ({ page }) => {
        const button = page.getByTestId('login-button');
        const success = page.getByTestId('success-message');

        const box = await button.boundingBox();
        // Try clicking by snapping mouse onto button and clicking
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

        // Form submission should NOT have succeeded
        await expect(success).not.toBeVisible();
        // Evasion counter should have triggered
        await expect(page.getByTestId('evade-count')).not.toHaveText('0');
    });

    test('filling all fields stops evasion, smoothly returns button home, and allows login', async ({ page }) => {
        const button = page.getByTestId('login-button');
        const usernameInput = page.getByTestId('username-input');
        const passwordInput = page.getByTestId('password-input');
        const success = page.getByTestId('success-message');
        const evadeStatus = page.getByTestId('evade-status');

        const initialBox = await button.boundingBox();

        // 1. Try to hover/click while empty -> button evades
        await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2, { steps: 3 });
        await expect(page.getByTestId('evade-count')).not.toHaveText('0');
        await page.waitForTimeout(200);

        // Button is displaced
        const displacedBox = await button.boundingBox();
        expect(Math.abs(displacedBox.x - initialBox.x) + Math.abs(displacedBox.y - initialBox.y)).toBeGreaterThan(15);

        // 2. Now fill in valid credentials
        await usernameInput.fill('alice');
        await passwordInput.fill('supersecret');

        // Form becomes valid -> evasion mode stops!
        await expect(evadeStatus).toHaveText('Settled');
        await expect(page.getByTestId('taunt-message')).toContainText('Form completed');

        // Wait for smooth return transition to complete
        await page.waitForTimeout(320);

        // Button is back at settled state and class is-settled
        await expect(button).toHaveClass(/is-settled/);
        await expect(button).toHaveAttribute('data-valid');

        // Button returned to natural origin (translate 0px, 0px)
        const transform = await button.evaluate(el => el.style.transform);
        expect(transform).toBe('translate(0px, 0px)');

        // Centered inside arena
        const settledBox = await button.boundingBox();
        expect(settledBox).not.toBeNull();
        const arenaBox = await page.getByTestId('button-arena').boundingBox();
        expect(arenaBox).not.toBeNull();
        const settledCenterY = settledBox.y + settledBox.height / 2;
        const arenaCenterY = arenaBox.y + arenaBox.height / 2;
        expect(Math.abs(settledCenterY - arenaCenterY)).toBeLessThanOrEqual(2);

        // 3. User can now click the button normally
        await button.click();

        // Authentication succeeds!
        await expect(success).toBeVisible();
        await expect(success).toContainText('Authentication successful');
    });

    test('stays constrained within its arena boundaries and maxRadius during evasion', async ({ page }) => {
        const button = page.getByTestId('login-button');
        const arena = page.getByTestId('button-arena');
        const arenaBox = await arena.boundingBox();
        expect(arenaBox).not.toBeNull();

        const initialBox = await button.boundingBox();

        // Push button around multiple times
        for (let i = 0; i < 5; i++) {
            const btnBox = await button.boundingBox();
            await page.mouse.move(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2, { steps: 3 });
            await page.waitForTimeout(140);

            const currBtnBox = await button.boundingBox();
            // Verify button is inside arena
            expect(currBtnBox.x).toBeGreaterThanOrEqual(arenaBox.x - 5);
            expect(currBtnBox.x + currBtnBox.width).toBeLessThanOrEqual(arenaBox.x + arenaBox.width + 5);
            expect(currBtnBox.y).toBeGreaterThanOrEqual(arenaBox.y - 5);
            expect(currBtnBox.y + currBtnBox.height).toBeLessThanOrEqual(arenaBox.y + arenaBox.height + 5);

            // Verify button stays within maxRadius (160px from initial center)
            const distFromHome = Math.hypot(
                (currBtnBox.x + currBtnBox.width / 2) - (initialBox.x + initialBox.width / 2),
                (currBtnBox.y + currBtnBox.height / 2) - (initialBox.y + initialBox.height / 2)
            );
            expect(distFromHome).toBeLessThanOrEqual(165);
        }
    });

    test('disabling evasion toggle allows regular mouse click and form submission', async ({ page }) => {
        const toggle = page.getByTestId('evade-toggle');
        const button = page.getByTestId('login-button');
        const success = page.getByTestId('success-message');

        // Uncheck evasion mode
        await toggle.uncheck();
        await expect(page.getByTestId('evade-status')).toHaveText('Settled');

        // Click button normally
        await button.click();

        // Success message shows up
        await expect(success).toBeVisible();
        await expect(success).toContainText('Authentication successful');
    });

    test('supports keyboard navigation submission while evasion is active', async ({ page }) => {
        const passwordInput = page.getByTestId('password-input');
        const success = page.getByTestId('success-message');

        // Fill credentials via keyboard
        await page.getByTestId('username-input').fill('admin');
        await passwordInput.fill('secret123');

        // Focus password input and hit Tab to reach login button
        await passwordInput.focus();
        await page.keyboard.press('Tab'); // focus login button directly from password input

        // Press Enter to submit via keyboard
        await page.keyboard.press('Enter');

        // Keyboard submission succeeds!
        await expect(success).toBeVisible();
        await expect(success).toContainText('Authentication successful');
    });

    test('chasing button into boundaries escapes fluidly without getting stuck', async ({ page }) => {
        const button = page.getByTestId('login-button');

        let prevBox = await button.boundingBox();
        expect(prevBox).not.toBeNull();

        // Chase the button 6 times in quick succession
        for (let i = 0; i < 6; i++) {
            await page.mouse.move(prevBox.x + prevBox.width / 2, prevBox.y + prevBox.height / 2, { steps: 2 });
            await page.waitForTimeout(160);

            const newBox = await button.boundingBox();
            expect(newBox).not.toBeNull();

            // The button must NOT get stuck
            const distMoved = Math.hypot(newBox.x - prevBox.x, newBox.y - prevBox.y);
            expect(distMoved).toBeGreaterThanOrEqual(10);

            prevBox = newBox;
        }
    });

    test('button text remains strictly fixed and does not change when moving mouse around a settled button', async ({ page }) => {
        const toggle = page.getByTestId('evade-toggle');
        const button = page.getByTestId('login-button');

        // Fix button in place by disabling evasion
        await toggle.uncheck();
        await expect(button).toHaveText('Sign In');

        const box = await button.boundingBox();
        expect(box).not.toBeNull();

        // Move mouse all around and directly over the button
        await page.mouse.move(box.x - 20, box.y + box.height / 2);
        await page.mouse.move(box.x + box.width / 2, box.y - 20);
        await page.mouse.move(box.x + box.width + 20, box.y + box.height / 2);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height + 20);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

        // Text must remain completely fixed as "Sign In"
        await expect(button).toHaveText('Sign In');
    });

    test('movement-based restriction checkbox constrains button within 90px leash', async ({ page }) => {
        const movementToggle = page.getByTestId('movement-limit-toggle');
        const button = page.getByTestId('login-button');

        // Enable movement limit
        await movementToggle.check();
        const initialBox = await button.boundingBox();

        // Chase the button around
        for (let i = 0; i < 4; i++) {
            const btnBox = await button.boundingBox();
            await page.mouse.move(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2, { steps: 3 });
            await page.waitForTimeout(140);

            const currBtnBox = await button.boundingBox();
            const distFromHome = Math.hypot(
                (currBtnBox.x + currBtnBox.width / 2) - (initialBox.x + initialBox.width / 2),
                (currBtnBox.y + currBtnBox.height / 2) - (initialBox.y + initialBox.height / 2)
            );
            // Must stay within 90px leash (with 5px rounding margin)
            expect(distFromHome).toBeLessThanOrEqual(95);
        }
    });

    test('credentials restriction checkbox toggles evasion requirement and auto-fill button works', async ({ page }) => {
        const credsToggle = page.getByTestId('require-creds-toggle');
        const button = page.getByTestId('login-button');
        const autoFillBtn = page.locator('button:has-text("Auto-fill Valid")');
        const success = page.getByTestId('success-message');

        // Initially credentials are required, so button evades
        await expect(page.getByTestId('evade-status')).toHaveText('Evading ⚡');

        // Uncheck the credentials requirement scenario
        await credsToggle.uncheck();
        await expect(page.getByTestId('evade-status')).toHaveText('Settled');
        await expect(button).toHaveText('Sign In');

        // Button can be clicked directly without filling credentials
        await button.click();
        await expect(success).toBeVisible();

        // Re-check requirement -> button is evasive again if credentials empty
        await page.reload();
        await expect(page.getByTestId('evade-status')).toHaveText('Evading ⚡');

        // Click auto-fill button to complete fields in one click
        await autoFillBtn.click();
        await expect(page.getByTestId('username-input')).toHaveValue('alice');
        await expect(page.getByTestId('password-input')).toHaveValue('supersecret');
        await expect(page.getByTestId('evade-status')).toHaveText('Settled');
        await expect(button).toHaveText('Sign In Now ✨');

        // Text remains strictly fixed as "Sign In Now ✨" when moving cursor around it
        const box = await button.boundingBox();
        await page.mouse.move(box.x - 10, box.y + box.height / 2);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await expect(button).toHaveText('Sign In Now ✨');
    });

    test('time-based restriction checkbox activates 5-second duration limit badge', async ({ page }) => {
        const timeToggle = page.getByTestId('time-limit-toggle');
        const badge = page.locator('.scenario-group:has-text("Time-Based Restriction") .badge');

        await expect(badge).toHaveText('Off');
        await timeToggle.check();
        await expect(badge).toHaveText('duration: 5s');
        await timeToggle.uncheck();
        await expect(badge).toHaveText('Off');
    });

    test('time-based restriction starts countdown on evade, surrenders after 5s, and allows login', async ({ page }) => {
        const timeToggle = page.getByTestId('time-limit-toggle');
        const button = page.getByTestId('login-button');
        const timerDisplay = page.getByTestId('timer-display');
        const retryBtn = page.getByTestId('retry-time-btn');
        const success = page.getByTestId('success-message');

        // 1. Enable time limit
        await timeToggle.check();
        await expect(timerDisplay).toHaveText('5.0s left');

        // 2. Trigger first evade by approaching button
        const box = await button.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });

        // Timer starts ticking down
        await expect(timerDisplay).not.toHaveText('5.0s left');

        // 3. Wait for the 5-second duration to expire
        await page.waitForTimeout(5300);

        // 4. Button has surrendered!
        await expect(button).toHaveText('Fine, Sign In! 🏳️');
        await expect(page.getByTestId('button-state')).toHaveText('gaveup');
        await expect(timerDisplay).toContainText('Gave Up');

        // 5. Button is back home at (0, 0) and can now be clicked
        const transform = await button.evaluate(el => el.style.transform);
        expect(transform).toBe('translate(0px, 0px)');

        await button.click();
        await expect(success).toBeVisible();

        // 6. Test Retry button resets the challenge
        await retryBtn.click();
        await expect(timerDisplay).toHaveText('5.0s left');
        await expect(button).toHaveText('Sign In');
        await expect(page.getByTestId('button-state')).toHaveText('settled');
    });
});
