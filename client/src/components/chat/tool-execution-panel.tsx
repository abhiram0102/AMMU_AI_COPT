import React from 'react';

interface ToolCall {
  id: string;
  name: string;
  args: any;
  status: 'running' | 'success' | 'error';
  result?: any;
}

interface ToolExecutionPanelProps {
  toolCalls: ToolCall[];
  messageId: string;
}

const ToolExecutionPanel: React.FC<ToolExecutionPanelProps> = ({ toolCalls, messageId }) => {
  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  return (
    <div className="my-4 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Tool Calls</h3>
      <div className="space-y-2">
        {toolCalls.map((toolCall) => (
          <div key={toolCall.id} className="text-xs p-2 rounded bg-gray-900/70">
            <p className="font-mono text-cyan-400">{toolCall.name}</p>
            {/* Basic display, can be expanded */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ToolExecutionPanel;
