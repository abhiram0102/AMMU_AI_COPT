# AI Copilot - Cybersecurity Command Center

## Overview

The AI Copilot is an advanced cybersecurity assistant named "Ammu" that combines voice interaction, emotional intelligence, and enterprise-grade security tools. The system provides a command center interface for cybersecurity professionals, featuring AI-powered capabilities including voice activation, RAG (Retrieval-Augmented Generation) document processing, emotional bonding, and integrated security tools.

The application serves as a comprehensive cybersecurity workspace with multiple operational areas: Chat/RAG, Coding, Red Team operations, OSINT, and Reports. It's designed to learn user preferences, adapt communication styles, and provide intelligent assistance for security assessments and operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, built using Vite for development and bundling
- **Styling**: Tailwind CSS with custom cybersecurity theme colors (cyber-blue, cyber-green, cyber-amber, cyber-red)
- **UI Components**: Radix UI primitives with shadcn/ui components for consistent design system
- **State Management**: Zustand stores for chat, voice, and emotional state management
- **Routing**: Wouter for lightweight client-side routing
- **Data Fetching**: TanStack Query for server state management with custom API client

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints with middleware-based authentication
- **File Processing**: Multer for file uploads with memory storage
- **Authentication**: JWT-based with bcrypt for password hashing
- **Session Management**: Express sessions with PostgreSQL store

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Connection**: Neon serverless PostgreSQL with connection pooling
- **Schema Design**: Comprehensive schema including users, documents, chunks (for RAG), sessions, messages, memories, tool runs, findings, and voice interactions
- **Vector Storage**: ChromaDB integration for RAG document embeddings and similarity search

### Authentication and Authorization
- **Strategy**: JWT token-based authentication with role-based access control
- **Roles**: Owner and Analyst roles with different permission levels
- **Session Management**: Persistent sessions stored in PostgreSQL
- **Middleware**: Custom authentication middleware for protected routes
- **Security**: Bcrypt password hashing with configurable rounds

### AI and ML Integration
- **Primary AI**: OpenAI GPT-4o for chat completions and reasoning
- **Alternative AI**: Google Gemini AI support for redundancy
- **Voice Processing**: OpenAI Whisper for speech-to-text transcription
- **Emotional AI**: Custom emotional bonding system with mood tracking and personality adaptation
- **Agent System**: Multi-step planning with approval workflows for high-risk operations
- **RAG System**: Document ingestion with text extraction, chunking, and vector embeddings

### Voice and Audio Processing
- **Wake Word Detection**: "Hey Ammu" wake word activation
- **Speech Recognition**: Web Speech API with fallback support
- **Audio Visualization**: Real-time audio level monitoring and waveform display
- **Voice Synthesis**: Text-to-speech with emotional tone adaptation
- **Audio Recording**: MediaRecorder API with configurable quality settings

### Security Tools Integration
- **Network Scanning**: Sandboxed Nmap wrappers with target restrictions
- **OSINT Tools**: Domain research, DNS lookups, subdomain enumeration
- **Vulnerability Research**: CVE database integration and exploit chain mapping
- **MITRE ATT&CK**: Technique mapping and attack chain visualization
- **Risk Assessment**: Multi-level risk evaluation (low/medium/high) for all operations

### Memory and Learning Systems
- **Episodic Memory**: Session-based conversation history with context preservation
- **Semantic Memory**: User preferences, learned facts, and domain knowledge
- **Procedural Memory**: Successful workflow patterns and automation templates
- **Emotional Memory**: Relationship building, trust development, and communication style adaptation

## External Dependencies

### Core AI Services
- **OpenAI API**: GPT-4o for chat completions, Whisper for speech-to-text, embeddings for RAG
- **Google AI API**: Gemini models as alternative AI backend for redundancy

### Database and Storage
- **Neon PostgreSQL**: Serverless PostgreSQL database with connection pooling
- **ChromaDB**: Vector database for RAG document embeddings and similarity search

### Security and Networking
- **Nmap**: Network scanning tool (sandboxed execution for security)
- **DNS Resolution**: System DNS tools for OSINT operations
- **Certificate Analysis**: TLS/SSL certificate inspection tools

### Development and Build Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Type system for both frontend and backend
- **Drizzle Kit**: Database migration and schema management
- **ESBuild**: Backend bundling for production deployment

### UI and Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless UI primitives for accessibility
- **Lucide React**: Icon system for consistent iconography
- **React Hook Form**: Form validation and management

### Audio and Media Processing
- **Web APIs**: MediaRecorder, Web Speech API, AudioContext for browser-based audio processing
- **File Processing**: PDF parsing, image OCR, text extraction from various document formats

### Authentication and Security
- **JSON Web Tokens (JWT)**: Token-based authentication
- **bcryptjs**: Password hashing and verification
- **Express Session**: Session management with PostgreSQL storage