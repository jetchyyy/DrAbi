import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient } from '../../../app/query-client';
import { queryKeys } from '../../../lib/query-keys';
import { chatService } from '../services/chat-service';

export function useChatContacts(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.chatContacts(userId),
    queryFn: async () => {
      if (!userId) {
        return [];
      }

      return chatService.getDerivedContacts(userId);
    },
    enabled: Boolean(userId),
  });
}

export function useChatThreads(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.chatThreads(userId),
    queryFn: async () => {
      if (!userId) {
        return [];
      }

      return chatService.listThreadsForUser(userId);
    },
    enabled: Boolean(userId),
  });
}

export function useOpenOrCreateDirectThread(userId: string | null) {
  return useMutation({
    mutationFn: async (input: {
      contactUserId: string;
      linkedReferralId?: string | null;
      linkedAppointmentId?: string | null;
    }) => {
      if (!userId) {
        throw new Error('Cannot open chat thread without a signed-in user.');
      }

      return chatService.openOrCreateThread({
        currentUserId: userId,
        contactUserId: input.contactUserId,
        linkedReferralId: input.linkedReferralId,
        linkedAppointmentId: input.linkedAppointmentId,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chatThreads(userId) });
    },
  });
}
