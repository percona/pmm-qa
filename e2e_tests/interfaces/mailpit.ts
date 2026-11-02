export interface MailpitAddress {
  Address: string;
  Name: string;
}

export interface MailpitMessageSummary {
  ID: string;
  Subject: string;
  To: MailpitAddress[];
}

export interface MailpitMessage extends MailpitMessageSummary {
  Text: string;
}
