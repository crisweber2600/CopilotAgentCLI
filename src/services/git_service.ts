import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitServiceOptions {
  cwd?: string;
  defaultRemote?: string;
  defaultBranch?: string;
}

export interface CheckpointInfo {
  headRef: string;
  log: string[];
}

export interface CommitOptions {
  paths: string[];
  message: string;
}

export class GitService {
  private readonly cwd: string;
  private readonly remote: string;
  private readonly baseBranch: string;

  constructor(options: GitServiceOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.remote = options.defaultRemote ?? 'origin';
    this.baseBranch = options.defaultBranch ?? process.env.BASE_BRANCH ?? 'main';
  }

  getBaseBranch(): string {
    return this.baseBranch;
  }

  async remoteBranchExists(remote: string, branch: string): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('git', ['ls-remote', '--heads', remote, branch], {
        cwd: this.cwd,
      });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: this.cwd });
    return stdout.trim().length > 0;
  }

  async pushBranch(remote: string, branch: string): Promise<void> {
    await execFileAsync('git', ['push', remote, branch], { cwd: this.cwd });
  }

  async createCheckpointBranch(options: {
    remote: string;
    commitMessage: string;
  }): Promise<CheckpointInfo> {
    const timestamp = new Date().toISOString().replace(/[:]/g, '-');
    const checkpoint = `copilot/cli-${timestamp}`;

    await execFileAsync('git', ['checkout', '-b', checkpoint], { cwd: this.cwd });
    await execFileAsync('git', ['commit', '-am', options.commitMessage], { cwd: this.cwd });
    await execFileAsync('git', ['push', options.remote, checkpoint], { cwd: this.cwd });

    return {
      headRef: checkpoint,
      log: [
        `Created checkpoint branch ${checkpoint}.`,
        `Committed pending changes to ${checkpoint}.`,
        `Pushed ${checkpoint} to ${options.remote}.`,
      ],
    };
  }

  async commit(options: CommitOptions): Promise<void> {
    if (options.paths.length === 0) {
      return;
    }
    await execFileAsync('git', ['add', ...options.paths], { cwd: this.cwd });
    await execFileAsync('git', ['commit', '--allow-empty', '-m', options.message], {
      cwd: this.cwd,
    });
  }

  async push(branch?: string): Promise<void> {
    const targetBranch = branch ?? (await this.currentBranch());
    await execFileAsync('git', ['push', this.remote, targetBranch], { cwd: this.cwd });
  }

  async currentBranch(): Promise<string> {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: this.cwd,
    });
    return stdout.trim();
  }
}
