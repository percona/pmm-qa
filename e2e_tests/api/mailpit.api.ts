import { APIRequestContext, expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

interface MailpitAddress {
  Address: string;
  Name: string;
}

interface MailpitMessageSummary {
  ID: string;
  Subject: string;
  To: MailpitAddress[];
}

interface MailpitMessage extends MailpitMessageSummary {
  Text: string;
}

// The SMTP sink PMM Server sends to in docker-compose.yml.
export default class MailpitApi {
  private readonly url = (process.env.MAILPIT_URL || 'http://127.0.0.1:8025').replace(/\/$/, '');

  constructor(private request: APIRequestContext) {}

  getMessage = async (id: string): Promise<MailpitMessage> => {
    const response = await this.request.get(`${this.url}/api/v1/message/${id}`);

    expect(response.status(), await response.text()).toEqual(200);

    const message = (await response.json()) as MailpitMessage;

    return { ...message, Text: message.Text.replace(/\r\n/g, '\n') };
  };

  messagesTo = async (address: string): Promise<MailpitMessageSummary[]> => {
    const response = await this.request.get(`${this.url}/api/v1/search`, {
      params: { query: `to:"${address}"` },
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { messages: MailpitMessageSummary[] }).messages;
  };

  static recipient = (label: string) =>
    `qa-${label}-${Date.now()}-${Math.floor(Math.random() * 1_000)}@example.com`;

  waitForMessageTo = async (address: string): Promise<MailpitMessage> => {
    let messages: MailpitMessageSummary[] = [];

    await expect
      .poll(async () => (messages = await this.messagesTo(address)).length, {
        message: `No email reached ${address}`,
        timeout: Timeouts.ONE_MINUTE,
      })
      .toBeGreaterThan(0);

    return await this.getMessage(messages[0].ID);
  };
}
