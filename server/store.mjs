import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export function createStore(filename) {
	if (filename !== ":memory:")
		mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
	const db = new DatabaseSync(filename);
	if (filename !== ":memory:") chmodSync(filename, 0o600);
	db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, department TEXT NOT NULL,
      report_date TEXT NOT NULL, filename TEXT NOT NULL, markdown TEXT NOT NULL,
      sample INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, report_ids TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL, content TEXT NOT NULL, sources TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
	return {
		db,
		listReports: () =>
			db
				.prepare(`SELECT id,title,department,report_date,filename,sample,created_at,
      substr(markdown,1,160) AS preview,length(markdown) AS characters
      FROM reports ORDER BY report_date DESC,created_at DESC`)
				.all(),
		getReport: (id) => db.prepare("SELECT * FROM reports WHERE id=?").get(id),
		addReports(reports) {
			const statement = db.prepare(
				"INSERT INTO reports VALUES (?,?,?,?,?,?,?,?)",
			);
			db.exec("BEGIN");
			try {
				const inserted = reports.map((report) => {
					const id = randomUUID();
					statement.run(
						id,
						report.title,
						report.department,
						report.report_date,
						report.filename,
						report.markdown,
						report.sample ? 1 : 0,
						new Date().toISOString(),
					);
					return id;
				});
				db.exec("COMMIT");
				return inserted;
			} catch (error) {
				db.exec("ROLLBACK");
				throw error;
			}
		},
		deleteReport: (id) =>
			db.prepare("DELETE FROM reports WHERE id=?").run(id).changes,
		listConversations: () =>
			db
				.prepare(
					"SELECT * FROM conversations ORDER BY created_at DESC LIMIT 100",
				)
				.all()
				.map((row) => ({ ...row, report_ids: JSON.parse(row.report_ids) })),
		getConversation(id) {
			const row = db.prepare("SELECT * FROM conversations WHERE id=?").get(id);
			if (!row) return null;
			return {
				...row,
				report_ids: JSON.parse(row.report_ids),
				messages: db
					.prepare(
						"SELECT * FROM messages WHERE conversation_id=? ORDER BY rowid",
					)
					.all(id)
					.map((message) => ({
						...message,
						sources: JSON.parse(message.sources),
					})),
			};
		},
		saveTurn({ conversationId, reportIds, question, answer, sources }) {
			const now = new Date().toISOString();
			db.exec("BEGIN");
			try {
				db.prepare("INSERT OR IGNORE INTO conversations VALUES (?,?,?,?)").run(
					conversationId,
					question.slice(0, 60),
					JSON.stringify(reportIds),
					now,
				);
				const statement = db.prepare(
					"INSERT INTO messages VALUES (?,?,?,?,?,?)",
				);
				statement.run(
					randomUUID(),
					conversationId,
					"user",
					question,
					"[]",
					now,
				);
				statement.run(
					randomUUID(),
					conversationId,
					"assistant",
					answer,
					JSON.stringify(sources),
					now,
				);
				db.exec("COMMIT");
			} catch (error) {
				db.exec("ROLLBACK");
				throw error;
			}
			return this.getConversation(conversationId);
		},
		getSetting: (key) =>
			db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value,
		setSettings(values) {
			db.exec("BEGIN");
			try {
				const statement = db.prepare(
					"INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
				);
				for (const [key, value] of Object.entries(values))
					statement.run(key, value);
				db.exec("COMMIT");
			} catch (error) {
				db.exec("ROLLBACK");
				throw error;
			}
		},
		close: () => db.close(),
	};
}
