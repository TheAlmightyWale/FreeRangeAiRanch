import { execFileSync } from "child_process";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Local narrowing helper — TextContent is not re-exported from the public extension API.
type TextBlock = { type: "text"; text: string };

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level: "info" | "warn" | "error", message: string, detail?: unknown): void {
    const prefix = `[GitWorkflow] [${level.toUpperCase()}]`;
    const args = detail !== undefined ? [prefix, message, detail] : [prefix, message];
    if (level === "error") console.error(...args);
    else if (level === "warn") console.warn(...args);
    else console.log(...args);
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

function git(args: string[], cwd: string): string {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function isGitRepo(cwd: string): boolean {
    try {
        git(["rev-parse", "--git-dir"], cwd);
        return true;
    } catch {
        return false;
    }
}

// Strips characters that are invalid in git branch names and enforces length.
export function sanitizeBranchName(name: string): string {
    const sanitized = name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[~^:?*[\\\x00-\x1f\x7f]/g, "")
        .replace(/\.{2,}/g, "-")
        .replace(/^[-./]+|[-./]+$/g, "")
        .slice(0, 100);
    return sanitized;
}

function generateBranchName(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `pi-session-${date}-${time}`;
}

// ─── Module-level state ───────────────────────────────────────────────────────

//TODO place into extension.details so that this is stored per conversation branch by PI
let pendingBranchName: string | null = null;

/**
 * Set the branch name to use when the next agent_start event fires.
 * The name is sanitized and consumed once; subsequent agent_start events
 * fall back to auto-generated names.
 */
//TODO rather than have a set function, instead take a Get funciton externally that returns a string we then sanitize
export function setNextBranchName(name: string): void {
    const sanitized = sanitizeBranchName(name);
    pendingBranchName = sanitized;
    log("info", `Next branch name queued: ${sanitized}`);
}

// ─── Extension factory ────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
    let activeBranch: string | null = null;
    // Cache the last cwd we confirmed is a git repo to avoid repeated subprocess calls.
    let confirmedRepoCwd: string | null = null;

    function checkRepo(cwd: string): boolean {
        if (confirmedRepoCwd === cwd) return true;
        if (!isGitRepo(cwd)) {
            log("warn", `No git repository found at "${cwd}" — GitWorkflow extension is disabled.`);
            return false;
        }
        confirmedRepoCwd = cwd;
        return true;
    }

    pi.on("agent_start", (_event, ctx) => {
        if (!checkRepo(ctx.cwd)) return;

        const branchName = pendingBranchName ?? generateBranchName();
        pendingBranchName = null;

        try {
            git(["checkout", "-b", branchName], ctx.cwd);
            activeBranch = branchName;
            log("info", `Branch created and checked out: ${branchName}`);
        } catch (err) {
            log("error", `Failed to create branch "${branchName}"`, err);
        }
    });

    pi.on("turn_end", (event, ctx) => {
        if (!checkRepo(ctx.cwd)) return;
        if (!activeBranch) {
            log("warn", "turn_end fired with no active branch — skipping commit.");
            return;
        }

        try {
            const status = git(["status", "--porcelain"], ctx.cwd);
            if (!status) {
                log("info", "No changes to commit.");
                return;
            }

            let commitTitle = "pi: auto-commit";
            const msgContent = (event.message as { content?: Array<{ type: string; text?: string }> }).content;
            const firstText = msgContent?.find((b): b is TextBlock => b.type === "text");
            if (firstText) {
                const firstLine = firstText.text.split("\n")[0].trim();
                if (firstLine) commitTitle = firstLine.slice(0, 72);
            }

            git(["add", "--all"], ctx.cwd);
            git(["commit", "--message", commitTitle], ctx.cwd);
            log("info", `Changes committed: "${commitTitle}"`);
        } catch (err) {
            log("error", "Failed to commit changes.", err);
        }
    });

}
