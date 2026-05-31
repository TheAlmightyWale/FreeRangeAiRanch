import { defineTool, type ExtensionAPI } from '@earendil-works/pi-coding-agent';

interface SummarizedOutputDetails {
    summary?: string;
    bullet_points: string[];
}

/*
    Summarize Tool
*/
const summarizedOutputTool = defineTool({
    name: "summarized_output",
    label: "Summarized Output",
    description: "Summarizes output into a set of bullet points and a short description. Should occur at the end of every task",
    promptSnippet: "Emit a final summary of the task",
    promptGuidelines: [
        "Always use summarized_output for the final output of a task",
        "Summarize the output into 3-5 concise bullet points",
        "You can optionally include a one or two sentence description summarizing the overall outcome of the task. Do this if the task was fairly long or took multiple turns",
        "Use clear and concise language in the bullet points and description",
    ],
    parameters: Type.Object({
        summary: Type.String({ description: "A short one or two lines summarizing the overall outcome of the task. Optional, but recommended for longer tasks." }),
        bullet_points: Type.Array(Type.String(), { description: "3-5 concise bullet points summarizing the key results or findings from the task" }),
    }),

    async execute(_toolCallId, params) {
        return {
            content: [{ type: "text", text: params.summary }],
            details: {
                bullet_points: params.bullet_points,
                summary: params.summary
            } satisfies SummarizedOutputDetails,
            terminate: true,
        };
    },
});

/*
    Summarize Extension
*/
export default function (pi: ExtensionAPI): void {
    pi.registerTool(summarizedOutputTool);
}
