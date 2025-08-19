import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean, uuid, real, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("analyst"), // "owner", "analyst"
  preferences: jsonb("preferences").$type<{
    theme?: string;
    voiceEnabled?: boolean;
    emotionalBondingEnabled?: boolean;
    dataResidency?: "local" | "cloud";
    riskTolerance?: "low" | "medium" | "high";
    preferredTools?: string[];
  }>().default({}),
  emotionalState: jsonb("emotional_state").$type<{
    bondLevel: number;
    currentMood: string;
    trustLevel: number;
    personalityTraits: string[];
    preferredCommunicationStyle: string;
  }>().default({ bondLevel: 0, currentMood: "neutral", trustLevel: 0.5, personalityTraits: [], preferredCommunicationStyle: "professional" }),
  createdAt: timestamp("created_at").defaultNow(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull(), // "pdf", "markdown", "log", "image"
  content: text("content"),
  tags: text("tags").array().default([]),
  filePath: text("file_path"),
  metadata: jsonb("metadata").$type<{
    size?: number;
    mimeType?: string;
    extractedText?: string;
    ocrProcessed?: boolean;
  }>().default({}),
  embeddedAt: timestamp("embedded_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  ownerIdx: index("documents_owner_idx").on(table.ownerId),
  typeIdx: index("documents_type_idx").on(table.type),
}));

export const chunks = pgTable("chunks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: real("embedding").array(),
  metadata: jsonb("metadata").$type<{
    pageNumber?: number;
    startOffset?: number;
    endOffset?: number;
    chunkIndex?: number;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  docIdx: index("chunks_document_idx").on(table.documentId),
}));

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  mode: text("mode").notNull(), // "chat", "coding", "redteam", "osint", "reports"
  context: jsonb("context").$type<{
    workspace?: string;
    activeTools?: string[];
    currentGoal?: string;
  }>().default({}),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
}, (table) => ({
  ownerIdx: index("sessions_owner_idx").on(table.ownerId),
  modeIdx: index("sessions_mode_idx").on(table.mode),
}));

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user", "assistant", "system", "tool"
  content: text("content").notNull(),
  toolCalls: jsonb("tool_calls").$type<{
    toolName?: string;
    arguments?: Record<string, any>;
    result?: Record<string, any>;
    status?: "pending" | "approved" | "executed" | "failed";
    riskLevel?: "low" | "medium" | "high";
  }[]>().default([]),
  metadata: jsonb("metadata").$type<{
    voiceInput?: boolean;
    emotionalTone?: string;
    confidence?: number;
    sources?: string[];
    ragUsed?: boolean;
    error?: boolean;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  sessionIdx: index("messages_session_idx").on(table.sessionId),
  roleIdx: index("messages_role_idx").on(table.role),
}));

export const memories = pgTable("memories", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "episodic", "semantic", "procedural", "emotional"
  content: jsonb("content").$type<{
    summary?: string;
    details?: Record<string, any>;
    triggers?: string[];
    importance?: number;
    emotionalWeight?: number;
  }>().notNull(),
  strength: real("strength").notNull().default(1.0),
  lastAccessed: timestamp("last_accessed").defaultNow(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  ownerIdx: index("memories_owner_idx").on(table.ownerId),
  typeIdx: index("memories_type_idx").on(table.type),
}));

export const toolRuns = pgTable("tool_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  arguments: jsonb("arguments").notNull().default({}),
  result: jsonb("result").default({}),
  status: text("status").notNull().default("pending"), // "pending", "approved", "running", "completed", "failed"
  riskLevel: text("risk_level").notNull().default("low"),
  approvalRequired: boolean("approval_required").notNull().default(false),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  executedAt: timestamp("executed_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  auditLog: jsonb("audit_log").default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  sessionIdx: index("tool_runs_session_idx").on(table.sessionId),
  statusIdx: index("tool_runs_status_idx").on(table.status),
}));

export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  severity: text("severity").notNull(), // "info", "low", "medium", "high", "critical"
  mitreTags: text("mitre_tags").array().default([]),
  summary: text("summary").notNull(),
  details: text("details"),
  evidence: jsonb("evidence").$type<{
    toolOutputs?: Record<string, any>;
    screenshots?: string[];
    logs?: string[];
    artifacts?: string[];
  }>().default({}),
  status: text("status").notNull().default("new"), // "new", "investigating", "confirmed", "remediated", "false_positive"
  assignedTo: uuid("assigned_to").references(() => users.id),
  remediationSteps: text("remediation_steps").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  sessionIdx: index("findings_session_idx").on(table.sessionId),
  severityIdx: index("findings_severity_idx").on(table.severity),
}));

export const voiceInteractions = pgTable("voice_interactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  transcription: text("transcription").notNull(),
  audioData: text("audio_data"), // Base64 encoded audio
  confidence: real("confidence").notNull().default(0.0),
  emotionalTone: text("emotional_tone"),
  voicePattern: jsonb("voice_pattern").$type<{
    pitch?: number;
    speed?: number;
    energy?: number;
    characteristics?: string[];
  }>().default({}),
  wakeWordDetected: boolean("wake_word_detected").notNull().default(false),
  processingTime: integer("processing_time"), // milliseconds
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  sessionIdx: index("voice_interactions_session_idx").on(table.sessionId),
  userIdx: index("voice_interactions_user_idx").on(table.userId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  sessions: many(sessions),
  memories: many(memories),
  voiceInteractions: many(voiceInteractions),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  owner: one(users, {
    fields: [documents.ownerId],
    references: [users.id],
  }),
  chunks: many(chunks),
}));

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, {
    fields: [chunks.documentId],
    references: [documents.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  owner: one(users, {
    fields: [sessions.ownerId],
    references: [users.id],
  }),
  messages: many(messages),
  toolRuns: many(toolRuns),
  findings: many(findings),
  voiceInteractions: many(voiceInteractions),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  session: one(sessions, {
    fields: [messages.sessionId],
    references: [sessions.id],
  }),
  toolRuns: many(toolRuns),
}));

export const memoriesRelations = relations(memories, ({ one }) => ({
  owner: one(users, {
    fields: [memories.ownerId],
    references: [users.id],
  }),
}));

export const toolRunsRelations = relations(toolRuns, ({ one }) => ({
  session: one(sessions, {
    fields: [toolRuns.sessionId],
    references: [sessions.id],
  }),
  message: one(messages, {
    fields: [toolRuns.messageId],
    references: [messages.id],
  }),
  approver: one(users, {
    fields: [toolRuns.approvedBy],
    references: [users.id],
  }),
}));

export const findingsRelations = relations(findings, ({ one }) => ({
  session: one(sessions, {
    fields: [findings.sessionId],
    references: [sessions.id],
  }),
  assignee: one(users, {
    fields: [findings.assignedTo],
    references: [users.id],
  }),
}));

export const voiceInteractionsRelations = relations(voiceInteractions, ({ one }) => ({
  session: one(sessions, {
    fields: [voiceInteractions.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [voiceInteractions.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, lastActiveAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertChunkSchema = createInsertSchema(chunks).omit({ id: true, createdAt: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, startedAt: true, lastMessageAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertMemorySchema = createInsertSchema(memories).omit({ id: true, createdAt: true, lastAccessed: true });
export const insertToolRunSchema = createInsertSchema(toolRuns).omit({ id: true, createdAt: true });
export const insertFindingSchema = createInsertSchema(findings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVoiceInteractionSchema = createInsertSchema(voiceInteractions).omit({ id: true, createdAt: true });

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Chunk = typeof chunks.$inferSelect;
export type InsertChunk = z.infer<typeof insertChunkSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Memory = typeof memories.$inferSelect;
export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type ToolRun = typeof toolRuns.$inferSelect;
export type InsertToolRun = z.infer<typeof insertToolRunSchema>;
export type Finding = typeof findings.$inferSelect;
export type InsertFinding = z.infer<typeof insertFindingSchema>;
export type VoiceInteraction = typeof voiceInteractions.$inferSelect;
export type InsertVoiceInteraction = z.infer<typeof insertVoiceInteractionSchema>;
