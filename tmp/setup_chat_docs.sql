-- 1. Create the chat_documents table to store inline user uploads
CREATE TABLE IF NOT EXISTS chat_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768), -- Uses 768 dimensions to match our setup
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector searching
CREATE INDEX IF NOT EXISTS chat_documents_embedding_idx 
ON chat_documents USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Row-level security for chat_documents
ALTER TABLE chat_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own chat documents" 
ON chat_documents FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat documents" 
ON chat_documents FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat documents" 
ON chat_documents FOR DELETE 
USING (auth.uid() = user_id);

-- 2. Create the RPC function for matching chat documents via RAG
CREATE OR REPLACE FUNCTION match_chat_documents(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  filename text,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    cd.id,
    cd.filename,
    cd.content,
    1 - (cd.embedding <=> query_embedding) AS similarity
  FROM chat_documents cd
  WHERE 
    cd.user_id = p_user_id AND
    1 - (cd.embedding <=> query_embedding) > match_threshold
  ORDER BY cd.embedding <=> query_embedding
  LIMIT match_count;
$$;
