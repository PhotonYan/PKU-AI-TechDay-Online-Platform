Manual migration required: add boolean column vote_counter_opt_in to users table.
Suggested SQL:
ALTER TABLE users ADD COLUMN vote_counter_opt_in BOOLEAN DEFAULT 0;
