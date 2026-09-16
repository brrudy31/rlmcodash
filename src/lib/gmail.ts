import { getValidAccessToken } from './google-calendar';

export interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  isUnread: boolean;
}

export async function getUnreadEmails(userId: number): Promise<GmailMessage[]> {
  const token = await getValidAccessToken(userId);
  if (!token) return [];

  try {
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread%20is:inbox&maxResults=10',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) return [];
    const listData = await listRes.json();
    const messages: { id: string }[] = listData.messages ?? [];
    if (!messages.length) return [];

    const details = await Promise.all(
      messages.map(async ({ id }) => {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!r.ok) return null;
        return r.json();
      })
    );

    return details
      .filter(Boolean)
      .map((msg) => {
        const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
        const get = (name: string) => headers.find((h) => h.name === name)?.value ?? '';
        return {
          id: msg.id,
          subject: get('Subject') || '(no subject)',
          from: get('From'),
          snippet: msg.snippet ?? '',
          date: get('Date'),
          isUnread: (msg.labelIds ?? []).includes('UNREAD'),
        };
      });
  } catch {
    return [];
  }
}
