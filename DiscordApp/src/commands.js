import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

const TEST_COMMAND = {
  name: 'test',
  description: 'Check that the bot is online',
  type: 1,
  integration_types: [0],
  contexts: [0],
};

const TASK_COMMAND = {
  name: 'task',
  description: 'Send a task to the Qwen Code agent',
  options: [
    {
      type: 3,
      name: 'description',
      description: 'What should the agent do?',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0],
  contexts: [0],
};

const QUEUE_COMMAND = {
  name: 'queue',
  description: 'Show the current task queue status',
  type: 1,
  integration_types: [0],
  contexts: [0],
};

const ALL_COMMANDS = [TEST_COMMAND, TASK_COMMAND, QUEUE_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
