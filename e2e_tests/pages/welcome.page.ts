import { Page } from "@playwright/test";

export default class WelcomePage {
    constructor(private page: Page) { }

    private elements = {
        welcomeCard: '//*[@data-testid="welcome-card"]',
        addServiceButton: '//*[@data-testid="welcome-card-add-service"]',
        dismissButton: '//*[@data-testid="welcome-card-dismiss"]',
        startTourButton: '//*[@data-testid="welcome-card-start-tour"]',
        tourPopover: '//*[@class="reactour__popover"]',
        updates: '//*[@data-testid="update-modal-go-to-updates-button"]',
    };

    getLocator = (elementKey: keyof typeof this.elements) => {
        return this.page.locator(this.elements[elementKey]);
    };

    // mock api for fresh install
    async mockFreshInstall(data: Record<string, any>) {
        await this.page.route('**/v1/users/me', route => {
            const method = route.request().method();

            if (method === 'GET') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(data),
                });
            }

            if (method === 'PUT') {
                const payload = route.request().postDataJSON();
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(payload),
                });
            }

            return route.continue();
        });
    }

    // mock no services
    async mockNoServices() {
        await this.page.route('**/v1/inventory/services', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    "mysql": [],
                    "mongodb": [],
                    "postgresql": [],
                    "proxysql": [],
                    "haproxy": [],
                    "external": [],
                    "valkey": []
                })
            })
        })
    }

    // mock api for update available
    async mockUpdateAvailable() {
        await this.page.route('**/v1/server/updates?force=true', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    installed: {
                        version: '3.6.0',
                        full_version: '3.6.0',
                        timestamp: "2025-12-10T00:00:00Z"
                    },
                    latest: {
                        version: '3.7.0',
                        tag: '3.7.0',
                        timestamp: "2025-12-12T00:00:00Z",
                        release_notes_url: 'https://example.com',
                        release_notes_text: 'New features'
                    },
                    update_available: true,
                    latest_news_url: "https://example.com",
                    last_check: "2025-12-12T14:18:01.063631023Z"
                })
            });
        });
    }
}