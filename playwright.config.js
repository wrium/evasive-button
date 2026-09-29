import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e/tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5185',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    webServer: {
        command: './node_modules/.bin/vite --port 5185 --strictPort',
        url: 'http://localhost:5185/e2e/fixtures/login-screen/index.html',
        reuseExistingServer: !process.env.CI,
    },
});
