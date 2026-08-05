export interface SendInput {
  toEmail: string;
  firstName: string;
  lastName: string;
  subject: string;
  body: string;
}

export interface SendResult {
  provider: string;
  externalId: string | null;
  mailbox: string | null;
}

export interface SendProvider {
  name: string;
  send(input: SendInput): Promise<SendResult>;
}
