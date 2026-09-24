-- Genesis SQLite schema (generated from genesis/db/models.py; do not edit by hand)

CREATE TABLE automation_runs (
	id INTEGER NOT NULL, 
	job VARCHAR(40) NOT NULL, 
	status VARCHAR(12) NOT NULL, 
	detail TEXT NOT NULL, 
	started_at DATETIME NOT NULL, 
	duration_ms FLOAT NOT NULL, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_automation_runs_job ON automation_runs (job);

CREATE TABLE documents (
	id INTEGER NOT NULL, 
	filename VARCHAR(255) NOT NULL, 
	content_hash VARCHAR(64) NOT NULL, 
	chunks INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (content_hash)
);

CREATE TABLE emotion_states (
	id INTEGER NOT NULL, 
	"values" JSON NOT NULL, 
	mood VARCHAR(20) NOT NULL, 
	"trigger" VARCHAR(200) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_emotion_states_created_at ON emotion_states (created_at);

CREATE TABLE entities (
	id INTEGER NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	normalized_name VARCHAR(120) NOT NULL, 
	entity_type VARCHAR(32) NOT NULL, 
	description TEXT NOT NULL, 
	mention_count INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (normalized_name, entity_type)
);
CREATE INDEX ix_entities_normalized_name ON entities (normalized_name);

CREATE TABLE notes (
	id INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	body TEXT NOT NULL, 
	tags JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE personality_profile (
	"key" VARCHAR(40) NOT NULL, 
	value JSON NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY ("key")
);

CREATE TABLE personality_traits (
	id INTEGER NOT NULL, 
	name VARCHAR(32) NOT NULL, 
	value FLOAT NOT NULL, 
	baseline FLOAT NOT NULL, 
	description TEXT NOT NULL, 
	drift_date VARCHAR(10), 
	drift_today FLOAT NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE proactive_messages (
	id INTEGER NOT NULL, 
	kind VARCHAR(24) NOT NULL, 
	content TEXT NOT NULL, 
	dedupe_key VARCHAR(120) NOT NULL, 
	delivered BOOLEAN NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (dedupe_key)
);
CREATE INDEX ix_proactive_messages_delivered ON proactive_messages (delivered);

CREATE TABLE reflections (
	id INTEGER NOT NULL, 
	question TEXT NOT NULL, 
	content TEXT NOT NULL, 
	insights JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_reflections_created_at ON reflections (created_at);

CREATE TABLE settings (
	"key" VARCHAR(64) NOT NULL, 
	value JSON NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY ("key")
);

CREATE TABLE tasks (
	id INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	due_at DATETIME, 
	done BOOLEAN NOT NULL, 
	reminded BOOLEAN NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_tasks_due_at ON tasks (due_at);

CREATE TABLE tool_logs (
	id INTEGER NOT NULL, 
	tool_name VARCHAR(64) NOT NULL, 
	arguments JSON NOT NULL, 
	ok BOOLEAN NOT NULL, 
	result TEXT NOT NULL, 
	duration_ms FLOAT NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_tool_logs_created_at ON tool_logs (created_at);
CREATE INDEX ix_tool_logs_tool_name ON tool_logs (tool_name);

CREATE TABLE users (
	id INTEGER NOT NULL, 
	display_name VARCHAR(120) NOT NULL, 
	last_seen_at DATETIME, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE conversations (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	summary TEXT, 
	topics JSON NOT NULL, 
	started_at DATETIME NOT NULL, 
	last_message_at DATETIME NOT NULL, 
	summarized_at DATETIME, 
	message_count INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_conversations_last_message_at ON conversations (last_message_at);
CREATE INDEX ix_conversations_user_id ON conversations (user_id);

CREATE TABLE interests (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	category VARCHAR(40) NOT NULL, 
	strength FLOAT NOT NULL, 
	mention_count INTEGER NOT NULL, 
	last_mentioned DATETIME NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, name), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_interests_user_id ON interests (user_id);

CREATE TABLE journal_entries (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	period VARCHAR(10) NOT NULL, 
	period_start DATETIME NOT NULL, 
	period_end DATETIME NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	content TEXT NOT NULL, 
	highlights JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, period, period_start), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE knowledge_links (
	id INTEGER NOT NULL, 
	source_id INTEGER NOT NULL, 
	target_id INTEGER NOT NULL, 
	relation VARCHAR(64) NOT NULL, 
	confidence FLOAT NOT NULL, 
	weight INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (source_id, target_id, relation), 
	FOREIGN KEY(source_id) REFERENCES entities (id) ON DELETE CASCADE, 
	FOREIGN KEY(target_id) REFERENCES entities (id) ON DELETE CASCADE
);
CREATE INDEX ix_knowledge_links_source_id ON knowledge_links (source_id);
CREATE INDEX ix_knowledge_links_target_id ON knowledge_links (target_id);

CREATE TABLE memories (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	content TEXT NOT NULL, 
	memory_type VARCHAR(20) NOT NULL, 
	category VARCHAR(32) NOT NULL, 
	tier VARCHAR(10) NOT NULL, 
	importance_score FLOAT NOT NULL, 
	confidence FLOAT NOT NULL, 
	source VARCHAR(32) NOT NULL, 
	source_ref VARCHAR(120), 
	emotional_score FLOAT NOT NULL, 
	retrieval_count INTEGER NOT NULL, 
	last_recalled DATETIME, 
	tags JSON NOT NULL, 
	content_hash VARCHAR(64) NOT NULL, 
	embedding_model VARCHAR(80), 
	"indexed" BOOLEAN NOT NULL, 
	archived BOOLEAN NOT NULL, 
	superseded_by INTEGER, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (importance_score >= 0 AND importance_score <= 1), 
	CHECK (confidence >= 0 AND confidence <= 1), 
	CHECK (emotional_score >= -1 AND emotional_score <= 1), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(superseded_by) REFERENCES memories (id) ON DELETE SET NULL
);
CREATE INDEX ix_memories_category ON memories (category);
CREATE INDEX ix_memories_content_hash ON memories (content_hash);
CREATE INDEX ix_memories_indexed ON memories ("indexed");
CREATE INDEX ix_memories_memory_type ON memories (memory_type);
CREATE INDEX ix_memories_user_active ON memories (user_id, archived);

CREATE TABLE profile_fields (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	field VARCHAR(64) NOT NULL, 
	value TEXT NOT NULL, 
	confidence FLOAT NOT NULL, 
	source VARCHAR(32) NOT NULL, 
	history JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, field), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_profile_fields_user_id ON profile_fields (user_id);

CREATE TABLE relationships (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	trust FLOAT NOT NULL, 
	familiarity FLOAT NOT NULL, 
	interaction_count INTEGER NOT NULL, 
	shared_experiences INTEGER NOT NULL, 
	conversation_depth FLOAT NOT NULL, 
	support_level FLOAT NOT NULL, 
	level VARCHAR(32) NOT NULL, 
	days_active INTEGER NOT NULL, 
	last_interaction_date VARCHAR(10), 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE timeline_events (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT NOT NULL, 
	category VARCHAR(32) NOT NULL, 
	event_date DATETIME NOT NULL, 
	importance VARCHAR(10) NOT NULL, 
	source VARCHAR(32) NOT NULL, 
	title_hash VARCHAR(64) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	UNIQUE (title_hash)
);
CREATE INDEX ix_timeline_events_event_date ON timeline_events (event_date);

CREATE TABLE goals (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT NOT NULL, 
	goal_type VARCHAR(32) NOT NULL, 
	horizon VARCHAR(10) NOT NULL, 
	owner VARCHAR(12) NOT NULL, 
	status VARCHAR(12) NOT NULL, 
	progress FLOAT NOT NULL, 
	follow_up_interval_days FLOAT NOT NULL, 
	last_follow_up_at DATETIME, 
	next_follow_up_at DATETIME, 
	last_mentioned_at DATETIME, 
	source_memory_id INTEGER, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (progress >= 0 AND progress <= 100), 
	CHECK (status in ('active','paused','completed','abandoned')), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(source_memory_id) REFERENCES memories (id) ON DELETE SET NULL
);
CREATE INDEX ix_goals_next_follow_up_at ON goals (next_follow_up_at);
CREATE INDEX ix_goals_status ON goals (status);
CREATE INDEX ix_goals_user_id ON goals (user_id);

CREATE TABLE knowledge_items (
	id INTEGER NOT NULL, 
	statement TEXT NOT NULL, 
	statement_hash VARCHAR(64) NOT NULL, 
	subject_id INTEGER, 
	predicate VARCHAR(64), 
	object_id INTEGER, 
	source VARCHAR(32) NOT NULL, 
	confidence FLOAT NOT NULL, 
	evidence JSON NOT NULL, 
	retrieval_count INTEGER NOT NULL, 
	memory_id INTEGER, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (confidence >= 0 AND confidence <= 1), 
	UNIQUE (statement_hash), 
	FOREIGN KEY(subject_id) REFERENCES entities (id) ON DELETE SET NULL, 
	FOREIGN KEY(object_id) REFERENCES entities (id) ON DELETE SET NULL, 
	FOREIGN KEY(memory_id) REFERENCES memories (id) ON DELETE SET NULL
);

CREATE TABLE memory_links (
	id INTEGER NOT NULL, 
	source_id INTEGER NOT NULL, 
	target_id INTEGER NOT NULL, 
	relation VARCHAR(32) NOT NULL, 
	strength FLOAT NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (source_id, target_id, relation), 
	CHECK (source_id != target_id), 
	FOREIGN KEY(source_id) REFERENCES memories (id) ON DELETE CASCADE, 
	FOREIGN KEY(target_id) REFERENCES memories (id) ON DELETE CASCADE
);
CREATE INDEX ix_memory_links_source_id ON memory_links (source_id);
CREATE INDEX ix_memory_links_target_id ON memory_links (target_id);

CREATE TABLE messages (
	id INTEGER NOT NULL, 
	conversation_id INTEGER NOT NULL, 
	role VARCHAR(16) NOT NULL, 
	content TEXT NOT NULL, 
	created_at DATETIME NOT NULL, 
	meta JSON NOT NULL, 
	learned BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (role in ('user','assistant','system','tool')), 
	FOREIGN KEY(conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
);
CREATE INDEX ix_messages_conversation_id ON messages (conversation_id);
CREATE INDEX ix_messages_created_at ON messages (created_at);

CREATE TABLE goal_updates (
	id INTEGER NOT NULL, 
	goal_id INTEGER NOT NULL, 
	note TEXT NOT NULL, 
	progress FLOAT, 
	status VARCHAR(12), 
	source VARCHAR(32) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(goal_id) REFERENCES goals (id) ON DELETE CASCADE
);
CREATE INDEX ix_goal_updates_goal_id ON goal_updates (goal_id);
