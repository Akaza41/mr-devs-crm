-- =============================================================================
-- PHASE 4B: GROUP CHANNELS, @MENTIONS ARRAY, AND PER-CHANNEL UNREAD TRACKING
-- =============================================================================

-- 1. EXTEND CHAT_CHANNELS TYPE TO INCLUDE 'group'
ALTER TABLE public.chat_channels 
  DROP CONSTRAINT IF EXISTS chat_channels_type_check;

ALTER TABLE public.chat_channels 
  ADD CONSTRAINT chat_channels_type_check 
  CHECK (type IN ('team', 'lead_thread', 'direct', 'group'));

-- 2. ADD MENTIONED_USER_IDS TO CHAT_MESSAGES
ALTER TABLE public.chat_messages 
  ADD COLUMN IF NOT EXISTS mentioned_user_ids UUID[] DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_chat_messages_mentions 
  ON public.chat_messages USING GIN (mentioned_user_ids);

-- 3. ADD LAST_READ_AT TO CHANNEL_MEMBERS FOR UNREAD TRACKING
ALTER TABLE public.channel_members 
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 4. FUNCTION TO FETCH UNREAD MENTIONS FOR CURRENT USER
CREATE OR REPLACE FUNCTION public.get_unread_mentions(p_user_id UUID)
RETURNS TABLE (
  message_id UUID,
  channel_id UUID,
  channel_name TEXT,
  channel_type TEXT,
  sender_id UUID,
  sender_name TEXT,
  sender_avatar TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS message_id,
    m.channel_id,
    c.name AS channel_name,
    c.type AS channel_type,
    m.sender_id,
    COALESCE(p.full_name, p.email) AS sender_name,
    p.avatar_url AS sender_avatar,
    m.content,
    m.created_at
  FROM public.chat_messages m
  JOIN public.chat_channels c ON c.id = m.channel_id
  JOIN public.profiles p ON p.id = m.sender_id
  LEFT JOIN public.channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = p_user_id
  WHERE p_user_id = ANY(m.mentioned_user_ids)
    AND m.sender_id != p_user_id
    AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
  ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
