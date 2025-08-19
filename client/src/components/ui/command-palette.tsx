import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useChat } from "@/store/chat";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Command {
  id: string;
  name: string;
  description: string;
  icon: string;
  shortcut?: string;
  category: string;
  action: () => void | Promise<void>;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const { sendMessage } = useChat();
  const { toast } = useToast();

  const executeUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.md,.txt,.log,.png,.jpg,.jpeg';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsExecuting(true);
      try {
        await api.uploadFile('/api/protected/rag/ingest', file, {
          title: file.name,
          tags: []
        });
        
        toast({
          title: "Document uploaded",
          description: `${file.name} has been processed and added to the knowledge base`,
        });
      } catch (error) {
        toast({
          title: "Upload failed",
          description: error instanceof Error ? error.message : "Failed to upload document",
          variant: "destructive"
        });
      } finally {
        setIsExecuting(false);
      }
    };
    input.click();
  }, [toast]);

  const commands: Command[] = [
    {
      id: "upload",
      name: "Upload Document",
      description: "Upload a document to the knowledge base",
      icon: "fas fa-upload",
      shortcut: "⌘U",
      category: "Files",
      action: executeUpload
    },
    {
      id: "nmap-scan",
      name: "Run Nmap Scan",
      description: "Execute network scanning with Nmap",
      icon: "fas fa-terminal",
      category: "Tools",
      action: async () => {
        await sendMessage("Run an nmap scan on localhost to check for open ports");
      }
    },
    {
      id: "domain-intel",
      name: "Domain Intelligence",
      description: "Gather intelligence on a domain",
      icon: "fas fa-globe",
      category: "OSINT",
      action: async () => {
        await sendMessage("Perform domain intelligence gathering on example.com");
      }
    },
    {
      id: "mitre-report",
      name: "Generate MITRE Report",
      description: "Create a MITRE ATT&CK framework report",
      icon: "fas fa-shield-alt",
      category: "Reports",
      action: async () => {
        await sendMessage("Generate a MITRE ATT&CK report for the current session findings");
      }
    },
    {
      id: "search-memory",
      name: "Search Memory",
      description: "Search through AI memory and knowledge base",
      icon: "fas fa-search",
      category: "Memory",
      action: async () => {
        await sendMessage("Search your memory for recent cybersecurity threats");
      }
    },
    {
      id: "voice-toggle",
      name: "Toggle Voice Assistant",
      description: "Enable or disable voice interaction",
      icon: "fas fa-microphone",
      category: "Voice",
      action: () => {
        // This would trigger voice toggle
        document.dispatchEvent(new CustomEvent('toggle-voice'));
      }
    },
    {
      id: "new-session",
      name: "New Chat Session",
      description: "Start a new conversation",
      icon: "fas fa-plus",
      category: "Chat",
      action: () => {
        window.location.reload(); // Simple new session
      }
    }
  ];

  const filteredCommands = commands.filter(command =>
    command.name.toLowerCase().includes(query.toLowerCase()) ||
    command.description.toLowerCase().includes(query.toLowerCase()) ||
    command.category.toLowerCase().includes(query.toLowerCase())
  );

  const groupedCommands = filteredCommands.reduce((groups, command) => {
    const category = command.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(command);
    return groups;
  }, {} as Record<string, Command[]>);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
        e.preventDefault();
        executeUpload();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [executeUpload]);

  const handleCommandSelect = async (command: Command) => {
    if (isExecuting) return;
    
    setIsExecuting(true);
    try {
      await command.action();
      setIsOpen(false);
      setQuery("");
    } catch (error) {
      toast({
        title: "Command failed",
        description: error instanceof Error ? error.message : "Failed to execute command",
        variant: "destructive"
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="glass border-white/20 max-w-2xl p-0" data-testid="command-palette">
        <div className="p-4 border-b border-white/10">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full bg-transparent text-white placeholder-gray-400 border-none outline-none text-lg"
            autoFocus
            data-testid="command-search"
          />
        </div>
        
        <div className="max-h-80 overflow-y-auto">
          {Object.keys(groupedCommands).length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400">
              No commands found for "{query}"
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, categoryCommands]) => (
              <div key={category} className="p-2">
                <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {category}
                </div>
                {categoryCommands.map((command) => (
                  <button
                    key={command.id}
                    onClick={() => handleCommandSelect(command)}
                    disabled={isExecuting}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded hover:bg-white/5 cursor-pointer text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid={`command-${command.id}`}
                  >
                    <i className={`${command.icon} text-cyber-blue w-4`} />
                    <div className="flex-1">
                      <div className="font-medium text-white">{command.name}</div>
                      <div className="text-xs text-gray-400">{command.description}</div>
                    </div>
                    {command.shortcut && (
                      <span className="text-xs text-gray-400 bg-white/10 px-2 py-1 rounded">
                        {command.shortcut}
                      </span>
                    )}
                    {isExecuting && (
                      <i className="fas fa-spinner animate-spin text-cyber-blue" />
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
