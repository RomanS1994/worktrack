WITH ranked_reactions AS (
  SELECT ctid,
         ROW_NUMBER() OVER (
           PARTITION BY message_id, membership_id
           ORDER BY created_at DESC, emoji DESC
         ) AS row_number
    FROM chat_message_reactions
)
DELETE FROM chat_message_reactions r
 USING ranked_reactions ranked
 WHERE r.ctid = ranked.ctid
   AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS chat_message_reactions_message_membership_key
  ON chat_message_reactions (message_id, membership_id);
