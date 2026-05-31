import 'dotenv/config';
import express from 'express';
import {
  InteractionResponseType,
  InteractionType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { DiscordRequest } from './utils.js';
import { TaskQueue, TaskStatus } from './TaskQueue.js';
import { startAgent } from './agent.js';

const app = express();
const PORT = process.env.PORT || 3000;

const queue = new TaskQueue();

// All mutable state for the currently running task. Null when no task is running.
// Shape: { threadId, session, signalComplete }
let activeTask = null;

queue.on('task:start', async (task) => {
  let fired = false;
  function signalComplete(status) {
    if (fired) return;
    fired = true;
    activeTask = null;
    queue.complete(status);
  }

  activeTask = {
    threadId: task.threadId,
    session: null,
    signalComplete,
  };

  try {
    const session = await startAgent(task, {
      onToolStart: async (toolName) => {
        await postToThread(task.threadId, `Running \`${toolName}\`...`).catch(console.error);
      },
      onToolEnd: async (toolName) => {
        await postToThread(task.threadId, `\`${toolName}\` complete.`).catch(console.error);
      },
      onReportResult: async ({ summary, urls, notes }) => {
        let content = `**Summary:** ${summary}`;
        if (urls?.length) content += '\n' + urls.map(u => `- ${u}`).join('\n');
        if (notes) content += `\n**Notes:** ${notes}`;
        await postToThread(task.threadId, content).catch(console.error);
      },
      onComplete: async () => {
        await postToThread(task.threadId, 'Agent finished.').catch(console.error);
        signalComplete(TaskStatus.COMPLETE);
      },
      onError: async (err) => {
        console.error('[agent] Error:', err);
        await postToThread(task.threadId, `**Agent error:** ${err.message}`).catch(console.error);
        signalComplete(TaskStatus.FAILED);
      },
    });

    if (activeTask) activeTask.session = session;
  } catch (err) {
    // Synchronous configuration error (e.g. AGENT_WORK_DIR not set)
    console.error('[agent] Configuration error:', err.message);
    await postToThread(task.threadId, `**Configuration error:** ${err.message}`).catch(console.error);
    signalComplete(TaskStatus.FAILED);
  }
});

/**
 * Discord interactions endpoint.
 * verifyKeyMiddleware handles body parsing for this route.
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  const { type, data } = req.body;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'Bot is online.' },
      });
    }

    if (name === 'task') {
      const description = data.options.find(o => o.name === 'description').value;
      const channelId = req.body.channel_id;
      const submittedBy = req.body.member?.user?.id ?? req.body.user?.id;

      // Enforce channel restriction
      if (process.env.CHANNEL_ID && channelId !== process.env.CHANNEL_ID) {
        return res.status(200).send({ type: InteractionResponseType.PONG });
      }

      res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `Task queued: **${description}**` },
      });

      try {
        const threadRes = await DiscordRequest(`channels/${channelId}/threads`, {
          method: 'POST',
          body: {
            name: description.slice(0, 100),
            type: 11, // GUILD_PUBLIC_THREAD
            auto_archive_duration: 60,
          },
        });
        const thread = await threadRes.json();

        const task = queue.enqueue({ description, threadId: thread.id, channelId, submittedBy });

        const { size } = queue.getStatus();
        const waitMsg = task.status === TaskStatus.RUNNING
          ? 'Starting now...'
          : `Position in queue: ${size}`;

        await DiscordRequest(`channels/${thread.id}/messages`, {
          method: 'POST',
          body: { content: `Task received. ${waitMsg}` },
        });
      } catch (err) {
        console.error('Failed to create thread or enqueue task:', err);
      }

      return;
    }

    if (name === 'queue') {
      const { current, pending, size } = queue.getStatus();

      let content = '';

      if (current) {
        const elapsedSec = Math.floor((Date.now() - current.startedAt.getTime()) / 1000);
        const mins = Math.floor(elapsedSec / 60);
        const secs = elapsedSec % 60;
        const elapsed = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        const desc = current.description.length > 80
          ? current.description.slice(0, 80) + '…'
          : current.description;
        content += `**Running:** ${desc} _(${elapsed})_\n`;
      } else {
        content += '**Running:** nothing\n';
      }

      content += `**Queued:** ${size} task${size !== 1 ? 's' : ''}`;

      if (pending.length > 0) {
        content += '\n' + pending.map((t, i) => {
          const desc = t.description.length > 80
            ? t.description.slice(0, 80) + '…'
            : t.description;
          return `${i + 1}. ${desc}`;
        }).join('\n');
      }

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content },
      });
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

async function postToThread(threadId, content) {
  await DiscordRequest(`channels/${threadId}/messages`, {
    method: 'POST',
    body: { content },
  });
}

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});