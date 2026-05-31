import { createAgentSession, SessionManager, defineTool } from '@earendil-works/pi-coding-agent';
import summarizeOutputTool from '../../PiTooling/extensions/summarize.ts';

export async function startAgent(task, { onToolStart, onToolEnd, onReportResult, onComplete, onError }) {
  if (!process.env.AGENT_WORK_DIR) {
    throw new Error('AGENT_WORK_DIR is not set — agent working directory must be explicitly configured');
  }

  //TODO - Construct systemprompt from some configuration and add default PI system prompt tool in parent tooling
  const systemPrompt = process.env.AGENT_SYSTEM_PROMPT
    ? `${process.env.AGENT_SYSTEM_PROMPT}\n\n When you complete a task, call the summarize_output tool with a summary of what you did or the results of any questions asked.`
    : 'When you complete a task, call the summarize_output tool with a summary of what you did or the results of any questions asked.';

  const sessionResult = await createAgentSession({
    sessionManager: SessionManager.inMemory(),
    cwd: process.env.AGENT_WORK_DIR,
    //model: leave out as default is set under ~/.pi/models.json
    systemPrompt,
    customTools: [summarizeOutputTool],
  });

  const session = sessionResult.session;
  session.subscribe((event) => {
    switch (event.type) {
      case 'tool_execution_start':
        onToolStart(event.toolName);
        break;
      case 'tool_execution_end':
        onToolEnd(event.toolName);
        break;
      case 'agent_end':
        onComplete();
        break;
    }
  });

  session.prompt(task.description).catch(onError);

  return session;
}