Manual migration required: add boolean column vote_counter_opt_in to users table.
Suggested SQL:
ALTER TABLE users ADD COLUMN vote_counter_opt_in BOOLEAN DEFAULT 0;

Manual migration required: add boolean column can_publish_news to users table.
Suggested SQL:
ALTER TABLE users ADD COLUMN can_publish_news BOOLEAN DEFAULT 0;

Manual migration required: add columns authors (TEXT) and year (INTEGER) to submissions table.
Suggested SQL:
ALTER TABLE submissions ADD COLUMN authors TEXT;
ALTER TABLE submissions ADD COLUMN year INTEGER;
