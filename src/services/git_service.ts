import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const execFileAsync = promisify(execFile);

export interface GitServiceOptions {
  cwd?: string;
  defaultRemote?: string;
  defaultBranch?: string;
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
    this.baseBranch = options.defaultBranch ?? process.env['BASE_BRANCH'] ?? 'main';
  }

  getBaseBranch(): string {
    return this.baseBranch;
  }

  async commit(options: CommitOptions): Promise<void> {
    if (options.paths.length === 0) {
      return;
    }
    await this.runGit(['add', ...options.paths]);
    await this.runGit(['commit', '--allow-empty', '-m', options.message]);
  }

  async push(branch?: string): Promise<void> {
    const targetBranch = branch ?? (await this.currentBranch());
    await this.runGit(['push', this.remote, targetBranch]);
  }

  async currentBranch(): Promise<string> {
    const { stdout } = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    return stdout.trim();
  }

  async ensureRepo(): Promise<void> {
    const gitDir = join(this.cwd, '.git');
    if (!existsSync(gitDir)) {
      throw new Error(`No git repository at ${this.cwd}`);
    }
  }

  private async runGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
    await this.ensureRepo();
    return execFileAsync('git', args, { cwd: this.cwd });
  }
}
