export interface Report {
	id: string;
	title: string;
	department: string;
	report_date: string;
	filename: string;
	sample: number;
	created_at: string;
	preview: string;
	characters: number;
	markdown?: string;
}
export interface Source {
	id: string;
	reference: string;
	title: string;
	department: string;
	report_date: string;
	sha256: string;
}
export interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	sources: Source[];
	created_at: string;
}
export interface Conversation {
	id: string;
	title: string;
	report_ids: string[];
	created_at: string;
	messages?: Message[];
}
export interface Settings {
	mcpUrl: string;
	toolName: string;
	hasApiKey: boolean;
	flowUrl: string;
}
export interface Connection {
	connected: boolean;
	verification?: "discovery";
	server?: string;
	tools: { name: string; description?: string; compatible: boolean }[];
}
export interface Bootstrap {
	reports: Report[];
	conversations: Conversation[];
	settings: Settings;
}
export interface UploadResult extends Bootstrap {
	ids: string[];
}
