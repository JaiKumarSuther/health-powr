import type { ReactNode } from 'react';
import { CBOMessagesView } from './CBOMessagesView';

export function InternalMessagingView({
  embedded: _embedded = false,
  leftTop: _leftTop,
}: {
  embedded?: boolean;
  leftTop?: ReactNode;
}) {
  return <CBOMessagesView defaultTopTab="team" />;
}

