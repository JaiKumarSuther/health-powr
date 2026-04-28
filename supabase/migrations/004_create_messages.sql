-- Messaging between member and assigned organization
-- Scoped to a specific service request

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID UNIQUE
    REFERENCES public.service_requests(id) 
    ON DELETE CASCADE,
  member_id UUID NOT NULL
    REFERENCES public.profiles(id),
  organization_id UUID NOT NULL
    REFERENCES public.organizations(id),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL
    REFERENCES public.conversations(id) 
    ON DELETE CASCADE,
  sender_id UUID NOT NULL
    REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_update_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION 
  update_conversation_timestamp();

-- Indexes
CREATE INDEX idx_conversations_member 
  ON public.conversations(member_id);
CREATE INDEX idx_conversations_org 
  ON public.conversations(organization_id);
CREATE INDEX idx_messages_conversation 
  ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender 
  ON public.messages(sender_id);
CREATE INDEX idx_messages_unread 
  ON public.messages(conversation_id, is_read) 
  WHERE is_read = false;
