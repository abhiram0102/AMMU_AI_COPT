import React from 'react';

// Define a basic type for a plan step for now.
// You can expand this based on your actual data structure.
interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
}

interface AgentPlanTimelineProps {
  plan: PlanStep[];
}

const AgentPlanTimeline: React.FC<AgentPlanTimelineProps> = ({ plan }) => {
  if (!plan || plan.length === 0) {
    return null;
  }

  return (
    <div className="my-4 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Agent Plan</h3>
      <div className="space-y-2">
        {plan.map((step, index) => (
          <div key={step.id || index} className="text-xs flex items-center">
            <div className="w-4 h-4 rounded-full bg-gray-600 mr-2"></div>
            <span className="text-gray-400">{step.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentPlanTimeline;
