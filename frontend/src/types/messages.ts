export interface MessageParty {
  id: string;
  fullName: string;
}

export interface ConversationSummary {
  id: string;
  childId: string;
  childName: string;
  maintenanceArrangementId: string | null;
  parent: MessageParty;
  socialWorker: MessageParty;
  // False once the social worker is no longer assigned to the child: the history stays readable.
  canSend: boolean;
  unreadCount: number;
  lastMessage: { preview: string; senderId: string; createdAt: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface ContactArrangement {
  id: string;
  expectedAmount: number;
  frequency: string;
  status: string;
}

// Someone the signed-in user may start a conversation with, about one child.
export interface MessageContact {
  childId: string;
  childName: string;
  parent: MessageParty;
  socialWorker: MessageParty;
  conversationId: string | null;
  arrangements: ContactArrangement[];
}

export interface UnreadSummary {
  unreadCount: number;
  conversations: {
    conversationId: string;
    childName: string;
    senderName: string;
    unreadCount: number;
    lastMessageAt: string;
  }[];
}

export interface ConversationFilters {
  search?: string;
  childId?: string;
  unreadOnly?: boolean;
}
