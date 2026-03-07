export { ALL_TOOLS, getToolsForScope } from './toolDefinitions';

// AGENT_TOOLS re-exports tools filtered to the 'agent' scope.
// This is kept for backward compatibility with existing imports.
export { getToolsForScope as AGENT_TOOLS_FN } from './toolDefinitions';

import { getToolsForScope } from './toolDefinitions';

/** All tools available to the agent executor. */
export const AGENT_TOOLS = getToolsForScope('agent');
